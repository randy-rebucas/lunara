import './preload-env';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { assertProductionJwtSecrets } from './common/config/jwt-config';
import { assertProductionCorsOrigins, getAllowedOrigins } from './common/config/cors-config';
import { assertProductionPaymentConfig } from './common/config/payment-config';
import { assertProductionMongoUri, assertProductionRedisUrl } from './common/config/database-config';

async function bootstrap() {
  assertProductionJwtSecrets();
  assertProductionCorsOrigins();
  assertProductionPaymentConfig();
  assertProductionMongoUri();
  assertProductionRedisUrl();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Behind a reverse proxy/load balancer in production, trust the first hop's X-Forwarded-For
  // so req.ip (used by rate limiting and IP logging) reflects the real client, not the proxy.
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.setGlobalPrefix('api/v1');
  app.use(
    helmet({
      // This is a JSON API, not an HTML-serving app — CSP has no document to protect here.
      contentSecurityPolicy: false,
      // Frontend apps (admin-web/customer-web/partner-web) run on separate origins and load
      // uploaded images directly from this API — the default same-origin policy would block that.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.enableCors({ origin: getAllowedOrigins(), credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  Logger.log(`Lunara API running on http://localhost:${port}/api/v1`, 'Bootstrap');
}

bootstrap();
