import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformSettings, PlatformSettingsSchema } from './schemas/platform-settings.schema';
import { SettingsController } from './settings.controller';
import { AppVersionController } from './app-version.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PlatformSettings.name, schema: PlatformSettingsSchema }]),
  ],
  controllers: [SettingsController, AppVersionController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
