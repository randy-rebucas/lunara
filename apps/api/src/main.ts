import './preload-env';

import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { assertProductionJwtSecrets } from './common/config/jwt-config';
import { ensureUploadDirectories } from './common/uploads/ensure-upload-dirs';
import {
  AVATAR_UPLOAD_DIR,
  CATALOG_ADDON_UPLOAD_DIR,
  MESSAGE_ATTACHMENT_UPLOAD_DIR,
  PARTNER_BRAND_UPLOAD_DIR,
  REMITTANCE_PROOF_UPLOAD_DIR,
} from './common/uploads/upload-paths';

async function bootstrap() {
  assertProductionJwtSecrets();
  ensureUploadDirectories();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.setGlobalPrefix('api/v1');
  // Avatars only — rider documents and task photos require JWT via MediaController.
  app.useStaticAssets(AVATAR_UPLOAD_DIR, { prefix: '/api/v1/uploads/avatars/' });
  app.useStaticAssets(CATALOG_ADDON_UPLOAD_DIR, { prefix: '/api/v1/uploads/catalog-addons/' });
  app.useStaticAssets(PARTNER_BRAND_UPLOAD_DIR, { prefix: '/api/v1/uploads/partner-brands/' });
  app.useStaticAssets(REMITTANCE_PROOF_UPLOAD_DIR, { prefix: '/api/v1/uploads/remittance-proofs/' });
  app.useStaticAssets(MESSAGE_ATTACHMENT_UPLOAD_DIR, { prefix: '/api/v1/uploads/message-attachments/' });
  app.use(cookieParser());
  app.enableCors({ origin: true, credentials: true });
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
