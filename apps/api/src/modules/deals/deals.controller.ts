import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PromotionsService } from '../promotions/promotions.service';

@Controller('deals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DealsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  @Roles(UserRole.CUSTOMER)
  async listActive(@Req() req: { user: { sub: string } }) {
    const data = await this.promotionsService.listDealsForCustomer(req.user.sub);
    return { success: true, data };
  }
}
