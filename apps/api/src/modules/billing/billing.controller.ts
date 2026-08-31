import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SubscriptionService } from './subscription.service';
import { BillingPromotionService } from './billing-promotion.service';
import { AttachPaymentMethodDto } from './dto/attach-payment-method.dto';
import { RedeemPromotionDto } from './dto/redeem-promotion.dto';

@Controller('partner/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARTNER)
export class BillingController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly promotionService: BillingPromotionService,
  ) {}

  @Get('payment-method')
  async getPaymentMethod(@Req() req: { user: { sub: string } }) {
    const subscription = await this.subscriptionService.findByPartnerId(req.user.sub);
    return {
      success: true,
      data: {
        onFile: subscription?.paymentMethodOnFile ?? false,
        brand: subscription?.cardBrand,
        last4: subscription?.cardLast4,
      },
    };
  }

  @Post('payment-method')
  async attachPaymentMethod(@Req() req: { user: { sub: string } }, @Body() dto: AttachPaymentMethodDto) {
    return { success: true, data: await this.subscriptionService.attachPaymentMethod(req.user.sub, dto.paymongoPaymentMethodId) };
  }

  @Delete('payment-method')
  async removePaymentMethod(@Req() req: { user: { sub: string } }) {
    return { success: true, data: await this.subscriptionService.removePaymentMethod(req.user.sub) };
  }

  /** Self-service redemption only — removing an active promo is admin-only (a partner
   * shouldn't be able to give up someone else's discount decision on their own account). */
  @Post('promotion')
  async redeemPromotion(@Req() req: { user: { sub: string } }, @Body() dto: RedeemPromotionDto) {
    return { success: true, data: await this.promotionService.redeem(req.user.sub, dto.code) };
  }
}
