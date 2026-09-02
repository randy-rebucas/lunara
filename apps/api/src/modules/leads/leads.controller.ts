import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LeadsService } from './leads.service';
import { CreatePartnerLeadDto, UpdatePartnerLeadStatusDto } from './dto/partner-lead.dto';

const LEAD_SUBMIT_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

/** Unauthenticated by design — prospective partners submit interest before having an account. */
@Controller('public/leads')
export class PublicLeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @Throttle(LEAD_SUBMIT_THROTTLE)
  async create(@Body() dto: CreatePartnerLeadDto) {
    const lead = await this.leadsService.create(dto);
    return { success: true, data: lead };
  }
}

@Controller('admin/leads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminLeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  async list() {
    const leads = await this.leadsService.listAll();
    return { success: true, data: leads };
  }

  @Patch(':id/status')
  async setStatus(@Param('id') id: string, @Body() dto: UpdatePartnerLeadStatusDto) {
    const lead = await this.leadsService.setStatus(id, dto.status);
    return { success: true, data: lead };
  }
}
