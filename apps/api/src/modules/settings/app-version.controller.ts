import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('app-version')
export class AppVersionController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getAppVersion(@Query('app') app?: string) {
    if (app !== 'customer' && app !== 'rider') {
      throw new BadRequestException('Query param "app" must be "customer" or "rider"');
    }
    const data = await this.settingsService.getAppVersionForApp(app);
    return { success: true, data };
  }
}
