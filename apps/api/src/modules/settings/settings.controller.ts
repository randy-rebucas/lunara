import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateDeliveryFeeDto } from './dto/update-delivery-fee.dto';
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
}
