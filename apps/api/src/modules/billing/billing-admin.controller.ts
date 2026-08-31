import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { BillingPromotionService } from './billing-promotion.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { RedeemPromotionDto } from './dto/redeem-promotion.dto';
import { LedgerService } from '../ledger/ledger.service';
import { PaymentsService } from '../payments/payments.service';

@Controller('admin/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class BillingAdminController {
  constructor(
    private readonly planService: PlanService,
    private readonly subscriptionService: SubscriptionService,
    private readonly promotionService: BillingPromotionService,
    private readonly ledgerService: LedgerService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get('metrics')
  async getMetrics() {
    const [metrics, revenueTrend] = await Promise.all([
      this.subscriptionService.getMetrics(),
      this.ledgerService.getSubscriptionRevenueTrend(6),
    ]);
    return { success: true, data: { ...metrics, revenueTrend } };
  }

  @Get('reconciliation')
  async getReconciliation() {
    const [staleSubscriptions, subscriptionFeeDrift, webhookEvents] = await Promise.all([
      this.subscriptionService.getStaleSubscriptions(),
      this.ledgerService.getSubscriptionFeeDrift(),
      this.paymentsService.getWebhookEventStats(),
    ]);
    return { success: true, data: { staleSubscriptions, subscriptionFeeDrift, webhookEvents } };
  }

  @Get('plans')
  async listPlans(@Query('includeInactive') includeInactive?: string) {
    return { success: true, data: await this.planService.list(includeInactive === 'true') };
  }

  @Post('plans')
  async createPlan(@Body() dto: CreatePlanDto) {
    return { success: true, data: await this.planService.create(dto) };
  }

  @Patch('plans/:id')
  async updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return { success: true, data: await this.planService.update(id, dto) };
  }

  @Get('subscriptions')
  async listSubscriptions() {
    return { success: true, data: await this.subscriptionService.list() };
  }

  @Patch('subscriptions/:partnerId')
  async updateSubscription(@Param('partnerId') partnerId: string, @Body() dto: UpdateSubscriptionDto) {
    return { success: true, data: await this.subscriptionService.adminUpdate(partnerId, dto) };
  }

  @Get('promotions')
  async listPromotions() {
    return { success: true, data: await this.promotionService.list() };
  }

  @Post('promotions')
  async createPromotion(@Body() dto: CreatePromotionDto) {
    return { success: true, data: await this.promotionService.create(dto) };
  }

  @Patch('promotions/:id')
  async updatePromotion(@Param('id') id: string, @Body() dto: UpdatePromotionDto) {
    return { success: true, data: await this.promotionService.update(id, dto) };
  }

  @Post('subscriptions/:partnerId/promotion')
  async redeemPromotion(@Param('partnerId') partnerId: string, @Body() dto: RedeemPromotionDto) {
    return { success: true, data: await this.promotionService.redeem(partnerId, dto.code) };
  }

  @Delete('subscriptions/:partnerId/promotion')
  async removePromotion(@Param('partnerId') partnerId: string) {
    return { success: true, data: await this.promotionService.remove(partnerId) };
  }
}
