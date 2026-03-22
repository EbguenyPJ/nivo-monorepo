import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api/v1');

  // Serve uploaded files statically (e.g. ticket attachments)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      const allowed = [
        process.env.POS_ADMIN_URL || 'http://localhost:3001',
        process.env.STOREFRONT_URL || 'http://localhost:3002',
      ];

      // Allow exact matches
      if (allowed.includes(origin)) return callback(null, true);

      // Allow any subdomain of localhost:3001 (tenant subdomains in dev)
      if (/^https?:\/\/[a-z0-9-]+\.localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      // Allow any subdomain of the configured domains in production
      // e.g. mizapateria.nivo.com when POS_ADMIN_URL=https://nivo.com
      for (const url of allowed) {
        try {
          const { protocol, hostname, port } = new URL(url);
          const portSuffix = port ? `:${port}` : '';
          const subdomainPattern = new RegExp(
            `^${protocol}//[a-z0-9-]+\\.${hostname.replace('.', '\\.')}${portSuffix.replace('.', '\\.')}$`
          );
          if (subdomainPattern.test(origin)) return callback(null, true);
        } catch { /* skip invalid URLs */ }
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Nivo API')
    .setDescription('Nivo SaaS POS System - API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Nivo API running on http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
