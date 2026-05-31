import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { assertProductionJwtSecrets } from './common/config/jwt-config';
import { ensureUploadDirectories } from './common/uploads/ensure-upload-dirs';
import { UPLOADS_ROOT } from './common/uploads/upload-paths';

async function bootstrap() {
  assertProductionJwtSecrets();
  ensureUploadDirectories();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useStaticAssets(UPLOADS_ROOT, { prefix: '/api/v1/uploads/' });
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
