import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const uploadDir = resolve(process.env.UPLOAD_DIR || './uploads');
  mkdirSync(uploadDir, { recursive: true });

  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
  // Uploaded and seeded images. The web app proxies /uploads/* here.
  app.useStaticAssets(uploadDir, { prefix: '/uploads/', maxAge: '7d' });
  app.enableCors({ origin: process.env.WEB_URL || 'http://localhost:3000', credentials: true });
  app.enableShutdownHooks();

  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  console.log(`Haat API listening on http://localhost:${port}/api`);
}

bootstrap();
