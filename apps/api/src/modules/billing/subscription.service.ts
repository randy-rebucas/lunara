import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BillingSubscription, SubscriptionDocument, SubscriptionStatus, SUBSCRIPTION_STATUSES } from './schemas/subscription.schema';
import { PlanService } from './plan.service';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { PaymongoService } from '../payments/paymongo.service';

export interface AutoChargeResult {
  success: boolean;
  providerReference?: string;
  failureReason?: string;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectModel(BillingSubscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    private planService: PlanService,
    private paymongoService: PaymongoService,
  ) {}

  async findByPartnerId(partnerId: string) {
    return this.subscriptionModel.findOne({ partnerId: new Types.ObjectId(partnerId) });
  }

  async list() {
    return this.subscriptionModel.find().sort({ createdAt: -1 }).lean();
  }

  /** Subscriptions whose billing cycle ended more than `days` ago but are still in a status
   * that should have been processed by the weekly invoice cron or daily dunning sweep by now —
   * signals a stuck job or a bug, not normal operation (a healthy system never accumulates
   * these, since createInvoice advances the period every time a cycle is actually processed). */
  async getStaleSubscriptions(days = 3) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.subscriptionModel
      .find({
        status: { $in: ['active', 'past_due', 'grace_period', 'suspended'] },
        currentPeriodEnd: { $lt: cutoff },
      })
      .sort({ currentPeriodEnd: 1 })
      .lean();
  }

  /** Admin manual override: reassign plan and/or force a status/period change. Generates no
   * ledger entries itself — billing effects flow through PartnerOperationsService.createInvoice
   * the next time a fee is actually due. */
  async adminUpdate(partnerId: string, dto: UpdateSubscriptionDto) {
    const subscription = await this.findByPartnerId(partnerId);
    if (!subscription) throw new NotFoundException('Subscription not found for this partner');

    if (dto.planId) {
      const plan = await this.planService.findById(dto.planId);
      if (!plan) throw new NotFoundException('Plan not found');
      subscription.planId = plan._id as Types.ObjectId;
      subscription.priceSnapshot = plan.monthlyPrice;
    }
    if (dto.status) subscription.status = dto.status;
    if (dto.currentPeriodEnd) subscription.currentPeriodEnd = new Date(dto.currentPeriodEnd);
    if (dto.cancelAtPeriodEnd !== undefined) subscription.cancelAtPeriodEnd = dto.cancelAtPeriodEnd;
    if (dto.adminNote !== undefined) subscription.adminNote = dto.adminNote;
    if (dto.status === 'cancelled' && !subscription.cancelledAt) subscription.cancelledAt = new Date();

    await subscription.save();
    return subscription;
  }

  /** Advances the billing period by one month and flips trialing -> active once a fee has
   * actually been charged. Mirrors the previous `planRenewsAt += 1 month` mutation that used
   * to happen directly on User in PartnerOperationsService.createInvoice. */
  async advancePeriod(subscriptionId: Types.ObjectId) {
    const subscription = await this.subscriptionModel.findById(subscriptionId);
    if (!subscription) return;
    const next = new Date(subscription.currentPeriodEnd);
    next.setMonth(next.getMonth() + 1);
    subscription.currentPeriodStart = subscription.currentPeriodEnd;
    subscription.currentPeriodEnd = next;
    if (subscription.status === 'trialing') subscription.status = 'active';

    // A free-months promo covered this cycle's fee — count it down, clearing the promo once
    // exhausted so the next cycle bills at full price with no separate expiry job.
    if (subscription.promotionDiscountType === 'free_months' && (subscription.promotionFreeMonthsRemaining ?? 0) > 0) {
      subscription.promotionFreeMonthsRemaining = (subscription.promotionFreeMonthsRemaining ?? 0) - 1;
      if (subscription.promotionFreeMonthsRemaining === 0) {
        subscription.activePromotionId = undefined;
        subscription.promotionCode = undefined;
        subscription.promotionDiscountType = undefined;
        subscription.promotionDiscountValue = undefined;
        subscription.promotionFreeMonthsRemaining = undefined;
      }
    }

    await subscription.save();
  }

  /** Pure state transition — no notification/audit side effects, those belong to the caller
   * (the dunning cron, or the reactivation hook in PartnerOperationsService.markInvoicePaid) so
   * this stays reusable from multiple call sites without duplicating side-effect logic. */
  async transitionStatus(subscription: SubscriptionDocument, newStatus: SubscriptionStatus) {
    const previous = subscription.status;
    subscription.status = newStatus;
    if (newStatus === 'past_due' && !subscription.pastDueAt) subscription.pastDueAt = new Date();
    if (newStatus === 'grace_period' && !subscription.gracePeriodStartedAt) subscription.gracePeriodStartedAt = new Date();
    if (newStatus === 'suspended' && !subscription.suspendedAt) subscription.suspendedAt = new Date();
    if (newStatus === 'active') {
      subscription.pastDueAt = undefined;
      subscription.gracePeriodStartedAt = undefined;
      subscription.suspendedAt = undefined;
    }
    await subscription.save();
    return { subscription, previous };
  }

  /** Saves a card for future auto-charge attempts. Validates the Payment Method actually
   * exists and is a card (GCash/Maya are one-time redirect flows, not reusable for
   * unattended charging) before attaching it. */
  async attachPaymentMethod(partnerId: string, paymongoPaymentMethodId: string) {
    const subscription = await this.findByPartnerId(partnerId);
    if (!subscription) throw new NotFoundException('Subscription not found for this partner');

    const method = await this.paymongoService.getPaymentMethod(paymongoPaymentMethodId);
    if (method.type !== 'card') {
      throw new BadRequestException('Only card payment methods can be saved for auto-charge');
    }

    subscription.provider = 'paymongo';
    subscription.paymentMethodOnFile = true;
    subscription.paymongoPaymentMethodId = method.id;
    subscription.cardBrand = method.brand;
    subscription.cardLast4 = method.last4;
    await subscription.save();
    return subscription;
  }

  async removePaymentMethod(partnerId: string) {
    const subscription = await this.findByPartnerId(partnerId);
    if (!subscription) throw new NotFoundException('Subscription not found for this partner');

    subscription.provider = 'manual';
    subscription.paymentMethodOnFile = false;
    subscription.paymongoPaymentMethodId = undefined;
    subscription.cardBrand = undefined;
    subscription.cardLast4 = undefined;
    await subscription.save();
    return subscription;
  }

  /** Attempts an unattended charge against the subscription's saved card. Never throws —
   * callers (invoice creation) must be able to fall back to the manual invoice flow on any
   * failure without the failure interrupting invoice creation itself. */
  async attemptAutoCharge(
    subscription: SubscriptionDocument,
    amountPhp: number,
    description: string,
  ): Promise<AutoChargeResult> {
    if (!subscription.paymongoPaymentMethodId) {
      return { success: false, failureReason: 'No saved payment method' };
    }
    try {
      const intent = await this.paymongoService.createPaymentIntent(amountPhp, description, {
        lunara_purpose: 'subscription_fee',
        lunara_subscription_id: (subscription._id as Types.ObjectId).toString(),
      });
      const attached = await this.paymongoService.attachPaymentIntent(intent.id, subscription.paymongoPaymentMethodId);
      if (attached.status === 'succeeded') {
        return { success: true, providerReference: attached.id };
      }
      return { success: false, failureReason: `Payment intent status: ${attached.status}` };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown PayMongo error';
      this.logger.warn(`Auto-charge failed for subscription ${subscription._id}: ${reason}`);
      return { success: false, failureReason: reason };
    }
  }

  /** Point-in-time subscription metrics for the admin billing dashboard: MRR/ARR (from
   * `active` subscriptions' priceSnapshot), status counts, revenue by plan, and a simple
   * 30-day churn rate. Historical actually-collected revenue lives in
   * LedgerService.getSubscriptionRevenueTrend instead — this method is a snapshot, not a trend. */
  async getMetrics() {
    const statusCounts = await this.subscriptionModel.aggregate<{ _id: SubscriptionStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byStatus = Object.fromEntries(SUBSCRIPTION_STATUSES.map((s) => [s, 0])) as Record<SubscriptionStatus, number>;
    for (const row of statusCounts) byStatus[row._id] = row.count;

    const [mrrAgg] = await this.subscriptionModel.aggregate<{ mrr: number }>([
      { $match: { status: 'active' } },
      { $group: { _id: null, mrr: { $sum: '$priceSnapshot' } } },
    ]);
    const mrr = mrrAgg?.mrr ?? 0;

    const revenueByPlan = await this.subscriptionModel.aggregate<{ _id: Types.ObjectId; revenue: number; count: number }>([
      { $match: { status: 'active' } },
      { $group: { _id: '$planId', revenue: { $sum: '$priceSnapshot' }, count: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
    ]);
    const plans = await this.planService.list(true);
    const planById = new Map(plans.map((p) => [p._id.toString(), p]));
    const revenueByPlanNamed = revenueByPlan.map((r) => ({
      planKey: planById.get(r._id.toString())?.key ?? 'unknown',
      planName: planById.get(r._id.toString())?.name ?? 'Unknown',
      revenue: r.revenue,
      subscriberCount: r.count,
    }));

    // Simple 30-day churn: cancelled in the last 30 days vs. (active now + cancelled in the window).
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const cancelledLast30d = await this.subscriptionModel.countDocuments({ cancelledAt: { $gte: since } });
    const churnRatePercent =
      byStatus.active + cancelledLast30d > 0
        ? Math.round((cancelledLast30d / (byStatus.active + cancelledLast30d)) * 1000) / 10
        : 0;

    return {
      mrr,
      arr: mrr * 12,
      statusCounts: byStatus,
      revenueByPlan: revenueByPlanNamed,
      churnRatePercent,
      cancelledLast30d,
    };
  }
}
