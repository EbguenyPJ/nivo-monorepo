const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Force all react-native imports to resolve to mobile-b2c's version (0.81.5)
// This prevents pnpm's virtual store from pulling in react-native@0.76.x
// through transitive dependencies like expo-constants
const rnPath = fs.realpathSync(
  path.resolve(projectRoot, 'node_modules/react-native'),
);
const reactPath = fs.realpathSync(
  path.resolve(projectRoot, 'node_modules/react'),
);

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/')) {
    const resolved = path.resolve(projectRoot, moduleName.slice(2));
    return context.resolveRequest(
      { ...context, resolveRequest: undefined },
      resolved,
      platform,
    );
  }
  if (moduleName === 'react-native' || moduleName.startsWith('react-native/')) {
    const suffix = moduleName === 'react-native' ? '' : moduleName.slice('react-native'.length);
    const newPath = path.join(rnPath, suffix);
    return context.resolveRequest(
      { ...context, resolveRequest: undefined },
      newPath,
      platform,
    );
  }
  if (moduleName === 'react') {
    return context.resolveRequest(
      { ...context, resolveRequest: undefined },
      reactPath,
      platform,
    );
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(
    { ...context, resolveRequest: undefined },
    moduleName,
    platform,
  );
};

module.exports = withNativeWind(config, { input: './global.css' });
