import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateIncentiveCampaignDto, UpdateIncentiveCampaignDto } from './dto/incentive-campaign.dto';
import { IncentiveCampaignsService } from './incentive-campaigns.service';

@Controller('admin/incentive-campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminIncentiveCampaignsController {
  constructor(private readonly incentiveCampaignsService: IncentiveCampaignsService) {}

  @Get()
  list() {
    return this.incentiveCampaignsService.adminList();
  }

  @Post()
  create(@Body() dto: CreateIncentiveCampaignDto) {
    return this.incentiveCampaignsService.adminCreate(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateIncentiveCampaignDto) {
    return this.incentiveCampaignsService.adminUpdate(id, dto);
  }
}

@Controller('riders/incentive-campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RIDER)
export class RiderIncentiveCampaignsController {
  constructor(private readonly incentiveCampaignsService: IncentiveCampaignsService) {}

  @Get()
  listForRider(@Req() req: { user: { sub: string } }) {
    return this.incentiveCampaignsService.listForRider(req.user.sub);
  }
}
