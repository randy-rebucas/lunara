import './preload-env';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { assertProductionJwtSecrets } from './common/config/jwt-config';
import { ensureUploadDirectories } from './common/uploads/ensure-upload-dirs';
import { AVATAR_UPLOAD_DIR } from './common/uploads/upload-paths';

async function bootstrap() {
  assertProductionJwtSecrets();
  ensureUploadDirectories();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api/v1');
  // Avatars only — rider documents and task photos require JWT via MediaController.
  app.useStaticAssets(AVATAR_UPLOAD_DIR, { prefix: '/api/v1/uploads/avatars/' });
  app.enableCors({ origin: true, credentials: true });
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
