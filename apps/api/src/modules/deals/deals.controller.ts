import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminService } from '../admin/admin.service';

@Controller('deals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DealsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @Roles(UserRole.CUSTOMER)
  listActive() {
    return this.adminService.getActiveDeals();
  }
}
