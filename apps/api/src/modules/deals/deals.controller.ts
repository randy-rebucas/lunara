import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
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
  async listActive(
    @Req() req: { user: { sub: string }; headers: Record<string, string | undefined> },
  ) {
    // Same stale/malformed-header guard as booking's createOrder/quote — never crash the deals
    // list over a bad x-lunara-partner-id from an old app build.
    const rawPartnerId = req.headers['x-lunara-partner-id']?.trim() || undefined;
    const partnerId =
      rawPartnerId && Types.ObjectId.isValid(rawPartnerId) ? rawPartnerId : undefined;
    const data = await this.promotionsService.listDealsForCustomer(req.user.sub, partnerId);
    return { success: true, data };
  }
}
