import './preload-env';

import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { assertProductionJwtSecrets } from './common/config/jwt-config';
import { assertProductionCorsOrigins, getAllowedOrigins } from './common/config/cors-config';
import { assertProductionPaymentConfig } from './common/config/payment-config';
import { assertProductionMongoUri } from './common/config/database-config';

async function bootstrap() {
  assertProductionJwtSecrets();
  assertProductionCorsOrigins();
  assertProductionPaymentConfig();
  assertProductionMongoUri();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.enableCors({ origin: getAllowedOrigins(), credentials: true });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Lunara API running on http://localhost:${port}/api/v1`);
}

bootstrap();
