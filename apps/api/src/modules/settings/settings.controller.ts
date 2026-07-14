import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateDeliveryFeeDto } from './dto/update-delivery-fee.dto';
import { UpdateAutomationSettingsDto } from './dto/update-automation-settings.dto';
import { UpdateRiderFeesDto } from './dto/update-rider-fees.dto';
import { UpdateAppVersionSettingsDto } from './dto/update-app-version-settings.dto';
import { SettingsService } from './settings.service';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('delivery-fee')
  getDeliveryFee() {
    return this.settingsService.getDeliveryFeeSettings();
  }

  @Patch('delivery-fee')
  updateDeliveryFee(@Body() dto: UpdateDeliveryFeeDto) {
    return this.settingsService.updateDeliveryFeeSettings(dto);
  }

  @Get('automation')
  getAutomationSettings() {
    return this.settingsService.getAutomationSettings();
  }

  @Patch('automation')
  updateAutomationSettings(@Body() dto: UpdateAutomationSettingsDto) {
    return this.settingsService.updateAutomationSettings(dto);
  }

  @Get('rider-fees')
  getRiderFees() {
    return this.settingsService.getRiderFeeSettings();
  }

  @Patch('rider-fees')
  updateRiderFees(@Body() dto: UpdateRiderFeesDto) {
    return this.settingsService.updateRiderFeeSettings(dto);
  }

  @Get('app-version')
  getAppVersionSettings() {
    return this.settingsService.getAppVersionSettings();
  }

  @Patch('app-version')
  updateAppVersionSettings(@Body() dto: UpdateAppVersionSettingsDto) {
    return this.settingsService.updateAppVersionSettings(dto);
  }
}
