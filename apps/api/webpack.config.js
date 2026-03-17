const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = (options) => {
  return {
    ...options,
    resolve: {
      ...options.resolve,
      extensions: ['.ts', '.js', '.json'],
      alias: {
        '@nivo/database': path.resolve(__dirname, '../../packages/database/src'),
        '@nivo/types': path.resolve(__dirname, '../../packages/types/src'),
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                configFile: path.resolve(__dirname, 'tsconfig.json'),
              },
            },
          ],
          exclude: /node_modules\/(?!@nivo)/,
        },
      ],
    },
    externals: [
      nodeExternals({
        allowlist: [/^@nivo\//],
        modulesDir: path.resolve(__dirname, '../../node_modules'),
      }),
      nodeExternals({
        allowlist: [/^@nivo\//],
        modulesDir: path.resolve(__dirname, 'node_modules'),
      }),
    ],
    ignoreWarnings: [/^(?!CriticalDependenciesWarning$)/],
  };
};
