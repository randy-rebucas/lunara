import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Connection, Model, Types } from 'mongoose';
import { OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '@lunara/types';
import {
  computePickupSla,
  formatPartnerPreProcessingLabel,
  getInitialProcessingStepForOrder,
  getProcessingStep,
  isPartnerLaundryProcessingStatus,
  LAUNDRY_PROCESSING_STATUSES,
  normalizeProcessingStepId,
} from '@lunara/utils';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { UserProfile, UserProfileDocument } from '../users/schemas/user-profile.schema';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { RiderAssignmentService } from '../riders/rider-assignment.service';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';
import { ShopInventoryDocument, ShopInventoryItem } from './schemas/shop-inventory.schema';
import {
  PartnerSettlement,
  PartnerSettlementDocument,
} from './schemas/partner-settlement.schema';
import {
  PartnerInvoice,
  PartnerInvoiceDocument,
} from './schemas/partner-invoice.schema';
import { PartnerInvoicePdfService } from './partner-invoice-pdf.service';
import { EmailService } from '../../common/email/email.service';
import { SubscriptionService } from '../billing/subscription.service';
import { PlanService } from '../billing/plan.service';
import { EntitlementService } from '../billing/entitlement.service';
import { NotificationDispatchService } from '../push/notification-dispatch.service';
import { SubscriptionDocument } from '../billing/schemas/subscription.schema';
import {
  Branch,
  BranchDocument,
  DEFAULT_PARTNER_PORTAL_SETTINGS,
} from '../branches/schemas/branch.schema';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AssignStaffBranchDto } from './dto/assign-staff-branch.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { CreateRiderDto } from '../admin/dto/create-rider.dto';
import { UpdateRiderByPartnerDto } from './dto/update-rider.dto';
import { isRiderCompliant } from '../riders/rider-compliance';
import { applyStaffBranchFilter, assertOrderPortalAccess, resolvePortalBranchId } from './partner-access';
import { PartnerOrderNotificationService } from '../push/partner-order-notification.service';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import {
  buildOrderPaymentSummary,
  buildPartnerPaymentLabel,
  loadLatestOrderPaymentsByOrderId,
} from '../payments/payment-summary';
import { LedgerService } from '../ledger/ledger.service';

const INCOMING_STATUSES = [
  OrderStatus.SHOP_ASSIGNED,
  OrderStatus.CONFIRMED,
  OrderStatus.RIDER_ASSIGNED_PICKUP,
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT_TO_SHOP,
  OrderStatus.RECEIVED_AT_SHOP,
  OrderStatus.RECEIVED,
  OrderStatus.SORTING,
  OrderStatus.WASHING,
  OrderStatus.DRYING,
  OrderStatus.FOLDING,
  OrderStatus.IRONING,
  OrderStatus.QUALITY_CHECK,
  OrderStatus.READY_FOR_DELIVERY,
];

const COMPLETED_STATUSES = [OrderStatus.DELIVERED, OrderStatus.COMPLETED];

/** Orders in pickup / intake before laundry processing. */
const DASHBOARD_INCOMING_STATUSES = [
  OrderStatus.SHOP_ASSIGNED,
  OrderStatus.CONFIRMED,
  OrderStatus.RIDER_ASSIGNED_PICKUP,
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT_TO_SHOP,
  OrderStatus.RECEIVED_AT_SHOP,
];

const DASHBOARD_IN_PROCESSING_STATUSES = LAUNDRY_PROCESSING_STATUSES.filter(
  (s) => s !== OrderStatus.READY_FOR_DELIVERY,
);

const DEFAULT_INVENTORY = [
  { sku: 'DET-001', name: 'Liquid detergent', category: 'detergent', quantity: 48, unit: 'L', lowStockThreshold: 10, usagePerKg: 0.03 },
  { sku: 'DET-002', name: 'Fabric softener', category: 'detergent', quantity: 32, unit: 'L', lowStockThreshold: 8, usagePerKg: 0.02 },
  { sku: 'BAG-001', name: 'Customer laundry bags', category: 'supplies', quantity: 200, unit: 'pcs', lowStockThreshold: 50, usagePerOrder: 1 },
  { sku: 'TAG-001', name: 'Order tag rolls', category: 'supplies', quantity: 15, unit: 'rolls', lowStockThreshold: 3 },
  { sku: 'HGR-001', name: 'Hangers', category: 'supplies', quantity: 120, unit: 'pcs', lowStockThreshold: 30 },
  { sku: 'FIL-001', name: 'Lint filters', category: 'maintenance', quantity: 24, unit: 'pcs', lowStockThreshold: 6 },
];

@Injectable()
export class PartnerOperationsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    @InjectModel(ShopInventoryItem.name) private inventoryModel: Model<ShopInventoryDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(PartnerSettlement.name) private settlementModel: Model<PartnerSettlementDocument>,
    @InjectModel(PartnerInvoice.name) private invoiceModel: Model<PartnerInvoiceDocument>,
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfileDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectConnection() private connection: Connection,
    private trackingGateway: TrackingGateway,
    private riderAssignmentService: RiderAssignmentService,
    private partnerOrderNotifications: PartnerOrderNotificationService,
    private ledgerService: LedgerService,
    private invoicePdfService: PartnerInvoicePdfService,
    private emailService: EmailService,
    private subscriptionService: SubscriptionService,
    private planService: PlanService,
    private entitlementService: EntitlementService,
    private notificationDispatchService: NotificationDispatchService,
  ) {}

  /** Concurrency-safe sequential invoice number (INV-<year>-<seq>), backed by a `counters`
   * collection findOneAndUpdate — safe even when the weekly cron invoices many branches
   * near-simultaneously. */
  private async nextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const counterId = `partner_invoice_${year}`;
    const result = await this.connection.collection('counters').findOneAndUpdate(
      { _id: counterId as unknown as never },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    const seq = (result as unknown as { seq?: number } | null)?.seq ?? 1;
    return `INV-${year}-${String(seq).padStart(6, '0')}`;
  }

  /**
   * Lunara's cut of a single order. Orders placed through the shop-markup flow (customer
   * pays basePrice x1.30 up front) already have that cut baked into subtotal - baseSubtotal,
   * so settlement doesn't re-apply commissionRate on top of it. Orders with no pricingModel
   * (everything created before this flow shipped) fall back to that order's own branch's
   * commissionRate-of-subtotal formula - a partner can own several branches with different
   * rates, so the rate must be looked up per order rather than assumed to be one flat number.
   *
   * `total` already has `discount` subtracted (see booking.ts combineServiceQuotes), and
   * `partnerPayout = total - lunaraFee` downstream — so a discount always drains the partner's
   * payout unless this fee is adjusted to compensate. Platform-funded discounts (admin promos,
   * signup codes) get subtracted back out of the fee here so Lunara — not the partner — eats the
   * cost; partner-funded discounts (the partner's own coupon) are left alone, since the partner
   * funding their own promo out of their own payout is exactly the intended effect.
   */
  private computeOrderFee(
    order: {
      subtotal?: number;
      total: number;
      baseSubtotal?: number;
      pricingModel?: string;
      branchId?: Types.ObjectId;
      discount?: number;
      discountFundedBy?: string;
    },
    commissionRateByBranchId: Map<string, number>,
    fallbackRate = 0.20,
  ): number {
    const platformFundedDiscount =
      order.discountFundedBy === 'partner' ? 0 : Math.max(0, order.discount ?? 0);

    if (
      (order.pricingModel === 'shop_markup' || order.pricingModel === 'commission') &&
      order.baseSubtotal != null
    ) {
      const fee = (order.subtotal ?? order.total) - order.baseSubtotal;
      return Math.max(0, fee - platformFundedDiscount);
    }
    const rate = commissionRateByBranchId.get(order.branchId?.toString() ?? '') ?? fallbackRate;
    const fee = Math.round((order.subtotal ?? order.total) * rate);
    return Math.max(0, fee - platformFundedDiscount);
  }

  /**
   * Called by refunds.service.ts when a refunded order was already paid out in a
   * PartnerSettlement, and by PaymentsService.recordChargeback() when a chargeback lands on an
   * already-settled order. Either way the partner was already paid their share and the platform
   * already recognized its commission on this order — the reversal doesn't undo those on its own,
   * so this books it and records the clawback on the settlement for admins to net against the
   * partner's next payout (see createSettlement's recoverClawback option, and LEDGER.md).
   *
   * A refund and a chargeback differ in where the reversed cash actually lands: a refund credits
   * the customer's Lunara wallet (no cash leaves — `refund_expense` is the right P&L hit); a
   * chargeback means the card network already pulled real cash out of Lunara's account, so the
   * reversal credits `platform_cash` instead — that's genuinely lower cash on hand, not just a
   * liability swap.
   */
  async recordSettlementClawback(
    order: OrderDocument,
    refundAmount: number,
    kind: 'refund' | 'chargeback' = 'refund',
  ) {
    if (!order.settlementId || refundAmount <= 0) return;

    const settlement = await this.settlementModel.findById(order.settlementId);
    if (!settlement) return;

    const branch = order.branchId ? await this.branchModel.findById(order.branchId) : null;
    const commissionRateByBranchId = branch
      ? this.commissionRateMap([branch])
      : new Map<string, number>();
    const feeShare = Math.min(
      this.computeOrderFee(order, commissionRateByBranchId),
      refundAmount,
    );
    const payoutShare = refundAmount - feeShare;

    await this.settlementModel.updateOne(
      { _id: settlement._id },
      { $inc: { clawbackTotal: refundAmount, clawbackOrderCount: 1 } },
    );

    const label = kind === 'chargeback' ? 'chargeback' : 'refund';
    const creditAccount = kind === 'chargeback' ? ('platform_cash' as const) : ('refund_expense' as const);
    const entries = [] as Parameters<LedgerService['post']>[3];
    if (feeShare > 0) {
      entries.push({
        accountType: 'platform_revenue' as const,
        direction: 'debit' as const,
        amount: feeShare,
        description: `Commission reversed — order ${order._id.toString().slice(-6)} ${label} after settlement ${settlement._id.toString().slice(-6)}`,
      });
    }
    if (payoutShare > 0) {
      entries.push({
        accountType: 'cash_out' as const,
        direction: 'debit' as const,
        amount: payoutShare,
        description: `Partner payout owed back — order ${order._id.toString().slice(-6)} ${label} after settlement ${settlement._id.toString().slice(-6)}`,
      });
    }
    if (entries.length > 0) {
      entries.push({
        accountType: creditAccount,
        direction: 'credit' as const,
        amount: feeShare + payoutShare,
        description:
          kind === 'chargeback'
            ? `Cash pulled back by chargeback on order ${order._id.toString().slice(-6)} (already settled)`
            : `Post-settlement refund clawback for order ${order._id.toString().slice(-6)}`,
      });
      await this.ledgerService.post(
        `${kind === 'chargeback' ? 'chargeback-clawback' : 'settlement-clawback'}:${order._id.toString()}`,
        kind === 'chargeback' ? 'chargeback' : 'settlement_clawback',
        order._id.toString(),
        entries,
      );
    }
  }

  /**
   * The invoicing-era counterpart of recordSettlementClawback, called by refunds.service.ts and
   * PaymentsService.recordChargeback() for an order that was already claimed by a PartnerInvoice.
   * Under the invoicing model the partner collects payment directly, so Lunara never held a
   * "payout share" to claw back — only the commission Lunara already recognized on this order
   * needs reversing. Credited to the invoice's own creditTotal so a later invoice can net it off.
   */
  async recordInvoiceCredit(
    order: OrderDocument,
    refundAmount: number,
    kind: 'refund' | 'chargeback' = 'refund',
  ) {
    if (!order.invoiceId || refundAmount <= 0) return;

    const invoice = await this.invoiceModel.findById(order.invoiceId);
    if (!invoice) return;

    const branch = order.branchId ? await this.branchModel.findById(order.branchId) : null;
    const commissionRateByBranchId = branch
      ? this.commissionRateMap([branch])
      : new Map<string, number>();
    const feeShare = Math.min(
      this.computeOrderFee(order, commissionRateByBranchId),
      refundAmount,
    );
    if (feeShare <= 0) return;

    await this.invoiceModel.updateOne(
      { _id: invoice._id },
      { $inc: { creditTotal: feeShare, creditOrderCount: 1 } },
    );

    const label = kind === 'chargeback' ? 'chargeback' : 'refund';
    const creditAccount = kind === 'chargeback' ? ('platform_cash' as const) : ('refund_expense' as const);
    await this.ledgerService.post(
      `${kind === 'chargeback' ? 'chargeback-invoice-credit' : 'invoice-credit'}:${order._id.toString()}`,
      'invoice_credit',
      order._id.toString(),
      [
        {
          accountType: 'platform_revenue',
          direction: 'debit',
          amount: feeShare,
          description: `Commission reversed — order ${order._id.toString().slice(-6)} ${label} after invoice ${invoice.invoiceNumber}`,
        },
        {
          accountType: creditAccount,
          direction: 'credit',
          amount: feeShare,
          description:
            kind === 'chargeback'
              ? `Cash pulled back by chargeback on order ${order._id.toString().slice(-6)} (already invoiced)`
              : `Post-invoice refund credit for order ${order._id.toString().slice(-6)}`,
        },
      ],
    );
  }

  /** All branches a user manages orders/revenue for: every branch under a partner's account, or the one representative branch shown to admins by default. */
  private async resolvePartnerBranches(userId: string, role: UserRole): Promise<BranchDocument[]> {
    if (role === UserRole.ADMIN) {
      const branch = await this.branchModel.findOne({ branchType: 'partner_shop' }).sort({ name: 1 });
      return branch ? [branch] : [];
    }
    return this.branchModel.find({ partnerUserId: new Types.ObjectId(userId) });
  }

  private commissionRateMap(branches: BranchDocument[]): Map<string, number> {
    return new Map(branches.map((b) => [b._id.toString(), b.commissionRate ?? 0.2]));
  }

  /** Whether this partner's flat platform subscription fee is due to be billed right now —
   * trial/cancelled/expired subscriptions are never charged, and a paid partner is only
   * charged once per renewal cycle (currentPeriodEnd in the past counts as due). Reads the
   * billing.Subscription record (see BillingModule) rather than the deprecated
   * User.subscriptionPlan/planPrice/planRenewsAt fields it superseded. */
  /** Whether this subscription's billing cycle has ended and needs processing — independent of
   * the resulting fee amount, since a free-months promo can discount that to ₱0 while the cycle
   * (and its period-advance/promo-countdown) still needs to happen. */
  private isCycleDue(subscription: SubscriptionDocument | null): boolean {
    if (!subscription) return false;
    if (subscription.status === 'trialing' || subscription.status === 'cancelled' || subscription.status === 'expired') {
      return false;
    }
    if (!subscription.priceSnapshot || subscription.priceSnapshot <= 0) return false;
    return subscription.currentPeriodEnd.getTime() <= Date.now();
  }

  private computeDueSubscriptionFee(subscription: SubscriptionDocument | null): number {
    if (!subscription || !this.isCycleDue(subscription)) return 0;
    return this.applyPromotionDiscount(subscription, subscription.priceSnapshot);
  }

  private applyPromotionDiscount(subscription: SubscriptionDocument, amount: number): number {
    if (subscription.promotionDiscountType === 'free_months' && (subscription.promotionFreeMonthsRemaining ?? 0) > 0) {
      return 0;
    }
    if (subscription.promotionDiscountType === 'percentage') {
      return Math.max(0, Math.round(amount * (1 - (subscription.promotionDiscountValue ?? 0) / 100)));
    }
    if (subscription.promotionDiscountType === 'fixed') {
      return Math.max(0, amount - (subscription.promotionDiscountValue ?? 0));
    }
    return amount;
  }

  /** Used by the weekly invoicing sweep to decide whether a partner with no uninvoiced orders
   * still needs a subscription-only invoice this cycle — true whenever the cycle is due, even
   * if a promo discounts the resulting fee to ₱0 (the cycle still needs to advance and the
   * promo's free-months counter still needs to count down). */
  async isSubscriptionFeeDue(partnerId: string): Promise<boolean> {
    const subscription = await this.subscriptionService.findByPartnerId(partnerId);
    return this.isCycleDue(subscription);
  }

  async ensureInventorySeeded(branchId: Types.ObjectId) {
    const count = await this.inventoryModel.countDocuments({ branchId });
    if (count === 0) {
      await this.inventoryModel.insertMany(
        DEFAULT_INVENTORY.map((item) => ({ ...item, branchId })),
      );
    }
  }

  private async dashboardScopeFilter(
    userId: string,
    role: UserRole,
  ): Promise<{ filter: Record<string, unknown>; shop?: { name: string; code: string } }> {
    const filter: Record<string, unknown> = {};
    if (role === UserRole.PARTNER) {
      const branches = await this.resolvePartnerBranches(userId, role);
      if (branches.length === 0) return { filter };
      filter.branchId = { $in: branches.map((b) => b._id) };
      filter.partnerId = new Types.ObjectId(userId);
      const shopName = branches.length > 1 ? `${branches.length} shops` : branches[0].name;
      const shopCode = branches.length > 1 ? branches.map((b) => b.code).join(', ') : branches[0].code;
      return { filter, shop: { name: shopName, code: shopCode } };
    }
    if (role === UserRole.ADMIN) {
      const branch = await this.branchModel.findOne({ branchType: 'partner_shop' }).sort({ name: 1 });
      if (branch) {
        filter.branchId = branch._id;
        return { filter, shop: { name: branch.name, code: branch.code } };
      }
    }
    return { filter };
  }

  async getDashboard(userId: string, role: UserRole) {
    const { filter: scopeFilter, shop } = await this.dashboardScopeFilter(userId, role);
    const revenueFilter = await this.revenueOrderFilter(userId, role);

    const incomingBase = {
      status: { $in: DASHBOARD_INCOMING_STATUSES },
      dispatchStatus: 'dispatched',
      ...scopeFilter,
    };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfDay);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const weekStart = new Date(startOfDay);
    weekStart.setDate(weekStart.getDate() - 6);

    let staffBranchIds: Types.ObjectId[] | undefined;
    let partnerBranches: BranchDocument[] = [];
    if (role !== UserRole.ADMIN) {
      partnerBranches = await this.resolvePartnerBranches(userId, role);
      staffBranchIds = partnerBranches.map((b) => b._id);
      await Promise.all(staffBranchIds.map((branchId) => this.ensureInventorySeeded(branchId)));
    }

    const [
      incoming,
      awaitingAccept,
      inProcessing,
      ready,
      completedToday,
      weekOrders,
      staffCount,
      lowStock,
      recent,
      todayCreated,
      incomingYesterday,
      completedYesterday,
      staffCountYesterday,
    ] = await Promise.all([
      this.orderModel.countDocuments(incomingBase),
      this.orderModel.countDocuments({
        ...incomingBase,
        partnerAcceptedAt: { $exists: false },
      }),
      this.orderModel.countDocuments({
        status: { $in: DASHBOARD_IN_PROCESSING_STATUSES },
        ...scopeFilter,
      }),
      this.orderModel.countDocuments({
        status: OrderStatus.READY_FOR_DELIVERY,
        ...scopeFilter,
      }),
      this.orderModel.find({ ...revenueFilter, updatedAt: { $gte: startOfDay } }),
      this.orderModel.find({ ...revenueFilter, updatedAt: { $gte: weekStart } }),
      staffBranchIds
        ? this.userModel.countDocuments({ role: UserRole.STAFF, isActive: true, branchId: { $in: staffBranchIds } })
        : this.userModel.countDocuments({ role: UserRole.STAFF, isActive: true }),
      this.inventoryModel.countDocuments({
        $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
        ...(staffBranchIds ? { branchId: { $in: staffBranchIds } } : {}),
      }),
      this.orderModel.find(incomingBase).sort({ updatedAt: -1 }).limit(8),
      this.orderModel.countDocuments({
        ...scopeFilter,
        createdAt: { $gte: startOfDay },
      }),
      this.orderModel.countDocuments({
        ...scopeFilter,
        createdAt: { $gte: startOfYesterday, $lt: startOfDay },
      }),
      this.orderModel.find({ ...revenueFilter, updatedAt: { $gte: startOfYesterday, $lt: startOfDay } }),
      staffBranchIds
        ? this.userModel.countDocuments({
            role: UserRole.STAFF,
            isActive: true,
            branchId: { $in: staffBranchIds },
            createdAt: { $lt: startOfDay },
          })
        : this.userModel.countDocuments({ role: UserRole.STAFF, isActive: true, createdAt: { $lt: startOfDay } }),
    ]);

    const commissionRateByBranchId =
      role === UserRole.ADMIN
        ? this.commissionRateMap(await this.resolvePartnerBranches(userId, role))
        : this.commissionRateMap(partnerBranches);
    const periodPayout = (
      orders: {
        total: number;
        subtotal?: number;
        baseSubtotal?: number;
        pricingModel?: string;
        branchId?: Types.ObjectId;
      }[],
    ) => {
      const gross = orders.reduce((s, o) => s + o.total, 0);
      const fee = Math.round(
        orders.reduce((s, o) => s + this.computeOrderFee(o, commissionRateByBranchId), 0),
      );
      return { gross, payout: gross - fee };
    };

    const todayBreakdown = periodPayout(completedToday);
    const weekBreakdown = periodPayout(weekOrders);
    const yesterdayBreakdown = periodPayout(completedYesterday);

    const deltaPct = (todayValue: number, yesterdayValue: number): number | null =>
      yesterdayValue > 0 ? Math.round(((todayValue - yesterdayValue) / yesterdayValue) * 100) : null;

    const revenueSeries: { date: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date(startOfDay);
      day.setDate(day.getDate() - i);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const dayRevenue = weekOrders
        .filter((o) => o.updatedAt >= day && o.updatedAt < nextDay)
        .reduce((s, o) => s + o.total, 0);
      revenueSeries.push({ date: day.toISOString().slice(0, 10), revenue: dayRevenue });
    }

    const SERVICE_LABELS: Record<string, string> = {
      wash_fold: 'Wash & Fold',
      wash_dry: 'Wash & Dry',
      wash_dry_fold: 'Wash, Dry & Fold',
      wash_dry_fold_iron: 'Wash, Dry, Fold & Iron',
      dry_cleaning: 'Dry Cleaning',
      ironing: 'Ironing',
    };
    const serviceCounts = new Map<string, number>();
    for (const o of weekOrders) {
      const key = o.bookingType ?? 'other';
      serviceCounts.set(key, (serviceCounts.get(key) ?? 0) + 1);
    }
    const sortedServices = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1]);
    const topServices = sortedServices.slice(0, 4);
    const otherCount = sortedServices.slice(4).reduce((s, [, count]) => s + count, 0);
    const services = topServices.map(([key, count]) => ({
      key,
      label: SERVICE_LABELS[key] ?? key.replace(/_/g, ' '),
      count,
    }));
    if (otherCount > 0) services.push({ key: 'other', label: 'Other', count: otherCount });

    return {
      success: true,
      data: {
        shop,
        counts: {
          incoming,
          awaitingAccept,
          inProcessing,
          readyForDelivery: ready,
          completedToday: completedToday.length,
          staffMembers: staffCount,
          lowStockItems: lowStock,
        },
        trends: {
          ordersToday: { value: todayCreated, deltaPct: deltaPct(todayCreated, incomingYesterday) },
          completedToday: {
            value: completedToday.length,
            deltaPct: deltaPct(completedToday.length, completedYesterday.length),
          },
          revenueToday: { value: todayBreakdown.payout, deltaPct: deltaPct(todayBreakdown.payout, yesterdayBreakdown.payout) },
          staffMembers: { value: staffCount, deltaPct: deltaPct(staffCount, staffCountYesterday) },
        },
        services,
        revenue: {
          today: todayBreakdown.gross,
          week: weekBreakdown.gross,
          todayOrders: completedToday.length,
          weekOrders: weekOrders.length,
          series: revenueSeries,
          todayPayout: todayBreakdown.payout,
          weekPayout: weekBreakdown.payout,
        },
        recentOrders: await this.summarizeIncomingBatch(recent),
      },
    };
  }

  async acceptPartnerOrder(orderId: string, partnerUserId: string, role: UserRole) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    if (!INCOMING_STATUSES.includes(order.status)) {
      throw new BadRequestException('Order is no longer available to accept');
    }
    if (!order.branchId) {
      throw new BadRequestException('Order has not been assigned to a shop yet');
    }
    const branchId = await resolvePortalBranchId(this.userModel, partnerUserId, role);
    assertOrderPortalAccess(order, partnerUserId, role, branchId);
    if (order.partnerAcceptedAt) {
      throw new BadRequestException('Order already accepted by the shop');
    }

    order.partnerAcceptedAt = new Date();
    order.partnerAcceptedBy = new Types.ObjectId(partnerUserId);
    order.statusHistory.push({
      status: order.status,
      timestamp: new Date(),
      note: 'Partner shop accepted the order',
      updatedBy: partnerUserId,
    });
    await order.save();

    this.trackingGateway.emitOrderEvent(orderId, 'partnerAccepted', {
      message: `${order.branchName ?? 'Your laundry partner'} accepted your order`,
    });
    this.trackingGateway.emitPartnerPipelineUpdated({
      orderId,
      status: order.status,
      partnerId: order.partnerId?.toString(),
      branchId: order.branchId?.toString(),
    });

    await this.riderAssignmentService.autoAssignPickupRiderIfConfigured(orderId).catch(() => {});

    return { success: true, data: await this.summarizeIncoming(order) };
  }

  async requestPickup(orderId: string, partnerUserId: string, role: UserRole) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    if (role === UserRole.PARTNER && order.partnerId?.toString() !== partnerUserId) {
      throw new BadRequestException('Not your order');
    }
    if (!order.partnerAcceptedAt) {
      throw new BadRequestException('Accept the order before requesting pickup');
    }
    if (order.pickupRiderId) {
      throw new BadRequestException('Pickup rider already assigned');
    }

    order.pickupRequestedAt = new Date();
    order.statusHistory.push({
      status: order.status,
      timestamp: new Date(),
      note: 'Partner requested pickup rider',
      updatedBy: partnerUserId,
    });
    await order.save();

    this.trackingGateway.emitDispatchQueueUpdated({
      reason: 'pickup_requested',
      orderId,
    });

    void this.partnerOrderNotifications.notifyPickupRequested(orderId, partnerUserId);

    return { success: true, data: { orderId, pickupRequestedAt: order.pickupRequestedAt } };
  }

  async requestDelivery(orderId: string, partnerUserId: string, role: UserRole) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const branchId = await resolvePortalBranchId(this.userModel, partnerUserId, role);
    assertOrderPortalAccess(order, partnerUserId, role, branchId);
    if (order.status !== OrderStatus.READY_FOR_DELIVERY) {
      throw new BadRequestException('Order must be ready for delivery');
    }

    order.deliveryRequestedAt = new Date();
    order.statusHistory.push({
      status: order.status,
      timestamp: new Date(),
      note: 'Partner requested delivery rider',
      updatedBy: partnerUserId,
    });
    await order.save();

    void this.partnerOrderNotifications.notifyDeliveryRequested(orderId);

    return { success: true, data: { orderId, deliveryRequestedAt: order.deliveryRequestedAt } };
  }

  async notifyDeliveryDispatch(orderId: string) {
    return this.riderAssignmentService.notifyAwaitingDeliveryDispatch(orderId);
  }

  async getIncomingOrders(partnerUserId?: string, role?: UserRole) {
    const filter: Record<string, unknown> = {
      status: { $in: INCOMING_STATUSES },
      dispatchStatus: 'dispatched',
      branchId: { $exists: true, $ne: null },
    };
    let allowStaffRequestDelivery = true;
    if (role === UserRole.PARTNER && partnerUserId) {
      filter.partnerId = new Types.ObjectId(partnerUserId);
      const branch = await this.branchModel.findOne({
        partnerUserId: new Types.ObjectId(partnerUserId),
      });
      allowStaffRequestDelivery =
        branch?.portalSettings?.allowStaffToRequestDelivery ??
        DEFAULT_PARTNER_PORTAL_SETTINGS.allowStaffToRequestDelivery;
    }
    if (role === UserRole.STAFF && partnerUserId) {
      const branchId = await resolvePortalBranchId(this.userModel, partnerUserId, role);
      applyStaffBranchFilter(filter, role, branchId);
      if (branchId) {
        const branch = await this.branchModel.findById(branchId);
        allowStaffRequestDelivery =
          branch?.portalSettings?.allowStaffToRequestDelivery ??
          DEFAULT_PARTNER_PORTAL_SETTINGS.allowStaffToRequestDelivery;
      }
    }
    if (role === UserRole.ADMIN) {
      const branch = await this.branchModel.findOne({ branchType: 'partner_shop' }).sort({ name: 1 });
      allowStaffRequestDelivery =
        branch?.portalSettings?.allowStaffToRequestDelivery ??
        DEFAULT_PARTNER_PORTAL_SETTINGS.allowStaffToRequestDelivery;
    }

    const items = await this.orderModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100);

    return {
      success: true,
      data: {
        items: await this.summarizeIncomingBatch(items, {
          allowStaffRequestDelivery,
          viewerRole: role,
        }),
      },
    };
  }

  async getOrderHistory(userId: string, role: UserRole, status?: string, customerId?: string) {
    const HISTORY_STATUSES = [
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
      OrderStatus.CUSTOMER_PICKUP,
      OrderStatus.CANCELLED,
    ];
    const filter: Record<string, unknown> = {
      status: status && HISTORY_STATUSES.includes(status as OrderStatus)
        ? status
        : { $in: HISTORY_STATUSES },
    };
    if (role === UserRole.PARTNER) {
      filter.partnerId = new Types.ObjectId(userId);
    } else if (role === UserRole.STAFF) {
      const branchId = await resolvePortalBranchId(this.userModel, userId, role);
      applyStaffBranchFilter(filter, role, branchId);
    }
    if (customerId && Types.ObjectId.isValid(customerId)) {
      filter.customerId = new Types.ObjectId(customerId);
    }
    const orders = await this.orderModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    const paymentsByOrderId = await loadLatestOrderPaymentsByOrderId(
      this.paymentModel,
      orders.map((o) => o._id),
    );
    const customers = await this.customerModel
      .find({ userId: { $in: orders.map((o) => o.customerId) } })
      .select('userId firstName lastName')
      .lean();
    const customerNameById = new Map(
      customers.map((c) => [c.userId.toString(), [c.firstName, c.lastName].filter(Boolean).join(' ')]),
    );
    return {
      success: true,
      data: orders.map((o) => {
        const payment = paymentsByOrderId.get(o._id.toString());
        return {
          _id: o._id,
          status: o.status,
          customerName: customerNameById.get(o.customerId.toString()) || null,
          totalAmount: o.total,
          paymentMethod: payment?.method ?? null,
          createdAt: o.createdAt,
          completedAt: o.updatedAt,
        };
      }),
    };
  }

  /** The partner account (User with role PARTNER) that owns riders/branches for this request —
   * riders are scoped to this id, shared across every branch the partner owns. */
  private async resolvePartnerId(userId: string, role: UserRole): Promise<Types.ObjectId> {
    if (role === UserRole.PARTNER) return new Types.ObjectId(userId);
    const branchId = await this.resolvePartnerBranchId(userId, role);
    const branch = await this.branchModel.findById(branchId).select('partnerUserId');
    if (!branch) throw new NotFoundException('Partner shop branch not found');
    return branch.partnerUserId;
  }

  private formatOwnedRider(
    rider: RiderDocument,
    user?: Pick<UserDocument, '_id' | 'email' | 'phone' | 'isActive'> | null,
  ) {
    return {
      _id: rider._id.toString(),
      userId: rider.userId.toString(),
      email: user?.email,
      phone: user?.phone,
      isActive: user?.isActive ?? true,
      firstName: rider.firstName,
      lastName: rider.lastName,
      vehicleType: rider.vehicleType,
      plateNumber: rider.plateNumber,
      orCrNumber: rider.orCrNumber,
      employmentType: rider.employmentType,
      fixedWageAmount: rider.fixedWageAmount,
      wageFrequency: rider.wageFrequency,
      isOnline: rider.isOnline,
      shiftStatus: rider.shiftStatus,
      verificationStatus: isRiderCompliant(rider, user ?? null).verificationStatus,
    };
  }

  /** Riders this partner has added themselves (partnerId-scoped) — distinct from
   * listAssignedRiders(), which shows each branch's single default pickup/delivery rider. */
  async listOwnedRiders(userId: string, role: UserRole) {
    const partnerId = await this.resolvePartnerId(userId, role);
    const riders = await this.riderModel.find({ partnerId }).sort({ createdAt: -1 });
    const users = await this.userModel
      .find({ _id: { $in: riders.map((r) => r.userId) } })
      .select('email phone isActive');
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    return {
      success: true,
      data: riders.map((r) => this.formatOwnedRider(r, userMap.get(r.userId.toString()))),
    };
  }

  async createOwnedRider(userId: string, role: UserRole, dto: CreateRiderDto) {
    const partnerId = await this.resolvePartnerId(userId, role);
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone?.trim();

    const duplicateFilter: Record<string, unknown>[] = [{ email }];
    if (phone) duplicateFilter.push({ phone });
    const existing = await this.userModel.findOne({ $or: duplicateFilter });
    if (existing) {
      throw new ConflictException('A user with this email or phone already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.create({
      email,
      phone,
      passwordHash,
      role: UserRole.RIDER,
      isActive: true,
    });

    const rider = await this.riderModel.create({
      userId: user._id,
      partnerId,
      firstName: dto.firstName?.trim(),
      lastName: dto.lastName?.trim(),
      vehicleType: dto.vehicleType ?? 'motorcycle',
      documents: [],
      isOnline: false,
      shiftStatus: 'offline',
      currentLocation: { type: 'Point', coordinates: [0, 0] },
    });

    return { success: true, data: this.formatOwnedRider(rider, user) };
  }

  async updateOwnedRider(userId: string, role: UserRole, riderUserId: string, dto: UpdateRiderByPartnerDto) {
    const partnerId = await this.resolvePartnerId(userId, role);
    const rider = await this.riderModel.findOne({ userId: new Types.ObjectId(riderUserId), partnerId });
    if (!rider) throw new NotFoundException('Rider not found');

    if (dto.firstName !== undefined) rider.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) rider.lastName = dto.lastName.trim();
    if (dto.vehicleType !== undefined) rider.vehicleType = dto.vehicleType;
    if (dto.plateNumber !== undefined) rider.plateNumber = dto.plateNumber.trim();
    if (dto.orCrNumber !== undefined) rider.orCrNumber = dto.orCrNumber.trim();
    if (dto.employmentType !== undefined) rider.employmentType = dto.employmentType;
    if (dto.fixedWageAmount !== undefined) rider.fixedWageAmount = dto.fixedWageAmount;
    if (dto.wageFrequency !== undefined) rider.wageFrequency = dto.wageFrequency;
    if (dto.homeAddress) {
      rider.homeAddress = { ...(rider.homeAddress ?? {}), ...dto.homeAddress };
    }
    await rider.save();

    const user = await this.userModel.findById(riderUserId).select('email phone isActive');
    return { success: true, data: this.formatOwnedRider(rider, user) };
  }

  async removeOwnedRider(userId: string, role: UserRole, riderUserId: string) {
    const partnerId = await this.resolvePartnerId(userId, role);
    const rider = await this.riderModel.findOne({ userId: new Types.ObjectId(riderUserId), partnerId });
    if (!rider) throw new NotFoundException('Rider not found');

    const activeTasks = await this.orderModel.countDocuments({
      $or: [{ pickupRiderId: rider.userId }, { deliveryRiderId: rider.userId }],
      status: { $nin: [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
    });
    if (activeTasks > 0) {
      throw new BadRequestException("Reassign this rider's active tasks before removing them");
    }

    await this.userModel.updateOne({ _id: rider.userId }, { $set: { isActive: false } });
    return { success: true };
  }

  private async resolvePartnerBranchId(userId: string, role: UserRole): Promise<Types.ObjectId> {
    if (role === UserRole.ADMIN) {
      const branch = await this.branchModel.findOne({ branchType: 'partner_shop' }).sort({ name: 1 });
      if (!branch) throw new NotFoundException('Partner shop branch not found');
      return branch._id;
    }
    const branch = await this.branchModel.findOne({ partnerUserId: new Types.ObjectId(userId) });
    if (!branch) throw new NotFoundException('Partner shop branch not found');
    return branch._id;
  }

  /** All branches owned by this partner user. Empty for non-PARTNER roles (ADMIN has no owned branches). */
  private async listOwnedBranchIds(userId: string, role: UserRole): Promise<Types.ObjectId[]> {
    if (role !== UserRole.PARTNER) return [];
    const branches = await this.branchModel
      .find({ partnerUserId: new Types.ObjectId(userId) })
      .select('_id');
    return branches.map((b) => b._id);
  }

  /** Throws if `branchId` isn't a branch owned by this partner user (mirrors BranchesService.assertBranchOwnedByPartner). */
  private async resolveOwnedBranchId(
    userId: string,
    role: UserRole,
    branchId: string,
  ): Promise<Types.ObjectId> {
    const branch = await this.branchModel.findById(branchId);
    if (!branch) throw new NotFoundException('Branch not found');
    if (role === UserRole.PARTNER && branch.partnerUserId.toString() !== userId) {
      throw new NotFoundException('Branch not found');
    }
    return branch._id;
  }

  private async staffActiveJobCounts(branchId?: Types.ObjectId, branchIds?: Types.ObjectId[]) {
    const match: Record<string, unknown> = {
      'laundryProcessing.assignedStaffId': { $exists: true, $ne: null },
      status: { $nin: [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
    };
    if (branchId) match.branchId = branchId;
    else if (branchIds) match.branchId = { $in: branchIds };

    const activeJobs = await this.orderModel.aggregate([
      { $match: match },
      { $group: { _id: '$laundryProcessing.assignedStaffId', count: { $sum: 1 } } },
    ]);
    return new Map(activeJobs.map((j) => [j._id.toString(), j.count as number]));
  }

  private formatStaffMember(
    user: Pick<UserDocument, '_id' | 'email' | 'phone' | 'createdAt' | 'branchId' | 'canManageSettings'>,
    jobMap: Map<string, number>,
    profileMap?: Map<string, Pick<UserProfile, 'displayName' | 'avatarUrl'>>,
    branchMap?: Map<string, { name: string; code: string }>,
  ) {
    const profile = profileMap?.get(user._id.toString());
    const branch = branchMap?.get(user.branchId?.toString() ?? '');
    return {
      _id: user._id.toString(),
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt?.toISOString(),
      activeJobs: jobMap.get(user._id.toString()) ?? 0,
      displayName: profile?.displayName,
      avatarUrl: profile?.avatarUrl,
      branchId: user.branchId?.toString(),
      branchName: branch?.name,
      branchCode: branch?.code,
      canManageSettings: user.canManageSettings ?? false,
    };
  }

  async listStaff(userId: string, role: UserRole) {
    const ownedBranchIds = await this.listOwnedBranchIds(userId, role);
    const branchFilter =
      role === UserRole.PARTNER ? { $in: ownedBranchIds } : await this.resolvePartnerBranchId(userId, role);
    const staff = await this.userModel
      .find({ role: UserRole.STAFF, isActive: true, branchId: branchFilter })
      .select('email phone createdAt branchId canManageSettings')
      .sort({ email: 1 });

    const branchIdsForJobs = role === UserRole.PARTNER ? ownedBranchIds : undefined;
    const jobMap = await this.staffActiveJobCounts(
      role === UserRole.PARTNER ? undefined : (branchFilter as Types.ObjectId),
      branchIdsForJobs,
    );
    const profiles = await this.userProfileModel
      .find({ userId: { $in: staff.map((s) => s._id) } })
      .lean();
    const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

    let branchMap: Map<string, { name: string; code: string }> | undefined;
    if (role === UserRole.PARTNER) {
      const branches = await this.branchModel.find({ _id: { $in: ownedBranchIds } }).select('name code');
      branchMap = new Map(branches.map((b) => [b._id.toString(), { name: b.name, code: b.code }]));
    }

    return {
      success: true,
      data: staff.map((s) => this.formatStaffMember(s, jobMap, profileMap, branchMap)),
    };
  }

  /** Riders are hired/onboarded by admin, then assigned to a branch as its default pickup/delivery rider.
   * This lists that assignment so partners can see who's working their shop(s). */
  async listAssignedRiders(userId: string, role: UserRole) {
    const ownedBranchIds = await this.listOwnedBranchIds(userId, role);
    const branchFilter =
      role === UserRole.PARTNER ? { $in: ownedBranchIds } : await this.resolvePartnerBranchId(userId, role);
    const branches = await this.branchModel
      .find({ _id: branchFilter })
      .select('name code assignedRiderId')
      .sort({ name: 1 });

    const riderUserIds = branches
      .map((b) => b.assignedRiderId)
      .filter((id): id is Types.ObjectId => Boolean(id));

    const [riderUsers, riderProfiles] = await Promise.all([
      this.userModel.find({ _id: { $in: riderUserIds } }).select('email phone'),
      this.riderModel
        .find({ userId: { $in: riderUserIds } })
        .select('userId firstName lastName vehicleType plateNumber isOnline shiftStatus'),
    ]);
    const userMap = new Map(riderUsers.map((u) => [u._id.toString(), u]));
    const profileMap = new Map(riderProfiles.map((p) => [p.userId.toString(), p]));

    return {
      success: true,
      data: branches.map((b) => {
        const riderId = b.assignedRiderId?.toString();
        const riderUser = riderId ? userMap.get(riderId) : undefined;
        const riderProfile = riderId ? profileMap.get(riderId) : undefined;
        return {
          branchId: b._id.toString(),
          branchName: b.name,
          branchCode: b.code,
          rider: riderId
            ? {
                _id: riderId,
                email: riderUser?.email,
                phone: riderUser?.phone,
                firstName: riderProfile?.firstName,
                lastName: riderProfile?.lastName,
                vehicleType: riderProfile?.vehicleType,
                plateNumber: riderProfile?.plateNumber,
                isOnline: riderProfile?.isOnline ?? false,
                shiftStatus: riderProfile?.shiftStatus,
              }
            : null,
        };
      }),
    };
  }

  async createStaff(userId: string, role: UserRole, dto: CreateStaffDto) {
    const branchId = dto.branchId
      ? await this.resolveOwnedBranchId(userId, role, dto.branchId)
      : await this.resolvePartnerBranchId(userId, role);

    // Suspended partners can't add staff. A staff-with-permission acting on behalf of a
    // partner is resolved to the owning partner's id via the branch; the partner themself is
    // already that id.
    const ownerPartnerId =
      role === UserRole.PARTNER
        ? userId
        : branchId
          ? (await this.branchModel.findById(branchId).select('partnerUserId').lean())?.partnerUserId?.toString()
          : undefined;
    if (ownerPartnerId) await this.entitlementService.assertNotSuspended(ownerPartnerId);

    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone?.trim();

    const duplicateFilter: Record<string, unknown>[] = [{ email }];
    if (phone) duplicateFilter.push({ phone });

    const existing = await this.userModel.findOne({ $or: duplicateFilter });
    if (existing) {
      throw new ConflictException('A user with this email or phone already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.create({
      email,
      phone,
      passwordHash,
      role: UserRole.STAFF,
      branchId,
      isActive: true,
      canManageSettings: dto.canManageSettings ?? false,
    });

    const displayName = dto.displayName?.trim();
    let profileMap: Map<string, Pick<UserProfile, 'displayName' | 'avatarUrl'>> | undefined;
    if (displayName) {
      const profile = await this.userProfileModel.create({ userId: user._id, displayName });
      profileMap = new Map([[user._id.toString(), profile]]);
    }

    const branch = await this.branchModel.findById(branchId).select('name code');
    const branchMap = branch
      ? new Map([[branch._id.toString(), { name: branch.name, code: branch.code }]])
      : undefined;

    return {
      success: true,
      data: this.formatStaffMember(user, new Map(), profileMap, branchMap),
    };
  }

  async reassignStaffBranch(
    userId: string,
    role: UserRole,
    staffId: string,
    dto: AssignStaffBranchDto,
  ) {
    const targetBranchId = await this.resolveOwnedBranchId(userId, role, dto.branchId);
    const ownedBranchIds = await this.listOwnedBranchIds(userId, role);

    const staff = await this.userModel.findOne({
      _id: staffId,
      role: UserRole.STAFF,
      ...(role === UserRole.PARTNER ? { branchId: { $in: ownedBranchIds } } : {}),
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    staff.branchId = targetBranchId;
    await staff.save();

    const branch = await this.branchModel.findById(targetBranchId).select('name code');
    const branchMap = branch
      ? new Map([[branch._id.toString(), { name: branch.name, code: branch.code }]])
      : undefined;
    const jobMap = await this.staffActiveJobCounts(targetBranchId);
    const profile = await this.userProfileModel.findOne({ userId: staff._id }).lean();
    const profileMap = profile ? new Map([[staff._id.toString(), profile]]) : undefined;

    return {
      success: true,
      data: this.formatStaffMember(staff, jobMap, profileMap, branchMap),
    };
  }

  async removeStaff(userId: string, role: UserRole, staffId: string) {
    const ownedBranchIds = await this.listOwnedBranchIds(userId, role);

    const staff = await this.userModel.findOne({
      _id: staffId,
      role: UserRole.STAFF,
      ...(role === UserRole.PARTNER ? { branchId: { $in: ownedBranchIds } } : {}),
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    const activeJobs = await this.orderModel.countDocuments({
      'laundryProcessing.assignedStaffId': staff._id,
      status: { $nin: [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
    });
    if (activeJobs > 0) {
      throw new BadRequestException('Reassign this staff member\'s active jobs before removing them');
    }

    staff.isActive = false;
    await staff.save();

    return { success: true };
  }

  async assignStaff(orderId: string, staffId: string, partnerUserId: string, role: UserRole) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    if (role === UserRole.PARTNER && order.partnerId && order.partnerId.toString() !== partnerUserId) {
      throw new NotFoundException('Order not found');
    }

    if (!INCOMING_STATUSES.includes(order.status)) {
      throw new BadRequestException('Order is not available for staff assignment');
    }

    const staff = await this.userModel.findById(staffId);
    if (!staff || staff.role !== UserRole.STAFF || !staff.isActive) {
      throw new NotFoundException('Staff member not found');
    }
    if (order.branchId && staff.branchId?.toString() !== order.branchId.toString()) {
      throw new BadRequestException('Staff member is not assigned to this shop');
    }

    if (!order.laundryProcessing) {
      order.laundryProcessing = { completedSteps: [], ironingSkipped: false };
    }

    order.laundryProcessing.assignedStaffId = new Types.ObjectId(staffId);
    order.laundryProcessing.assignedAt = new Date();
    order.laundryProcessing.assignedBy = new Types.ObjectId(partnerUserId);
    if (!order.partnerId) order.partnerId = new Types.ObjectId(partnerUserId);
    await order.save();

    this.trackingGateway.emitOrderEvent(orderId, 'staffAssigned', {
      message: `Assigned to ${staff.email ?? 'staff'}`,
      staffId,
    });
    this.trackingGateway.emitPartnerPipelineUpdated({
      orderId,
      status: order.status,
      partnerId: order.partnerId?.toString(),
      branchId: order.branchId?.toString(),
    });

    return {
      success: true,
      data: await this.summarizeIncoming(order),
    };
  }

  async getProgressMonitor(userId: string, role: UserRole) {
    const { filter: scopeFilter } = await this.dashboardScopeFilter(userId, role);
    const items = await this.orderModel
      .find({
        status: {
          $in: [
            OrderStatus.RECEIVED_AT_SHOP,
            OrderStatus.RECEIVED,
            OrderStatus.SORTING,
            OrderStatus.WASHING,
            OrderStatus.DRYING,
            OrderStatus.FOLDING,
            OrderStatus.IRONING,
            OrderStatus.QUALITY_CHECK,
            OrderStatus.READY_FOR_DELIVERY,
          ],
        },
        ...scopeFilter,
      })
      .sort({ updatedAt: -1 });

    return {
      success: true,
      data: {
        items: await this.summarizeIncomingBatch(items),
      },
    };
  }

  private formatInventoryItem(item: ShopInventoryDocument, branchLabel?: { name: string; code: string }) {
    return {
      _id: item._id.toString(),
      branchId: item.branchId?.toString(),
      branchName: branchLabel?.name,
      branchCode: branchLabel?.code,
      sku: item.sku,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      lowStockThreshold: item.lowStockThreshold,
      isLowStock: item.quantity <= item.lowStockThreshold,
      usagePerOrder: item.usagePerOrder,
      usagePerKg: item.usagePerKg,
    };
  }

  async getInventory(userId: string, role: UserRole) {
    const branches = await this.resolvePartnerBranches(userId, role);
    const branchIds = branches.map((b) => b._id);
    if (branchIds.length === 0) return { success: true, data: [] };
    await Promise.all(branchIds.map((branchId) => this.ensureInventorySeeded(branchId)));
    const items = await this.inventoryModel
      .find({ branchId: { $in: branchIds } })
      .sort({ category: 1, name: 1 });
    const branchById = new Map(branches.map((b) => [b._id.toString(), { name: b.name, code: b.code }]));
    return {
      success: true,
      data: items.map((i) => this.formatInventoryItem(i, branchById.get(i.branchId?.toString()))),
    };
  }

  async createInventoryItem(userId: string, role: UserRole, dto: CreateInventoryDto) {
    const branches = await this.resolvePartnerBranches(userId, role);
    if (branches.length === 0) throw new BadRequestException('No shop branch found for this account');
    const branch = dto.branchId ? branches.find((b) => b._id.toString() === dto.branchId) : branches[0];
    if (!branch) throw new ForbiddenException('Branch is not managed by this account');
    const branchId = branch._id;

    const existing = await this.inventoryModel.findOne({ branchId, sku: dto.sku });
    if (existing) throw new ConflictException('An item with this SKU already exists');

    const item = await this.inventoryModel.create({
      branchId,
      sku: dto.sku,
      name: dto.name,
      category: dto.category,
      unit: dto.unit ?? 'units',
      quantity: dto.quantity ?? 0,
      lowStockThreshold: dto.lowStockThreshold ?? 10,
      usagePerOrder: dto.usagePerOrder ?? 0,
      usagePerKg: dto.usagePerKg ?? 0,
    });
    return { success: true, data: this.formatInventoryItem(item, { name: branch.name, code: branch.code }) };
  }

  async deleteInventoryItem(userId: string, role: UserRole, itemId: string) {
    const branches = await this.resolvePartnerBranches(userId, role);
    const branchIds = new Set(branches.map((b) => b._id.toString()));
    const item = await this.inventoryModel.findById(itemId);
    if (!item || !branchIds.has(item.branchId?.toString())) {
      throw new NotFoundException('Inventory item not found');
    }
    await item.deleteOne();
    return { success: true, data: { _id: itemId } };
  }

  async updateInventory(userId: string, role: UserRole, itemId: string, dto: UpdateInventoryDto) {
    const branches = await this.resolvePartnerBranches(userId, role);
    const branchIds = new Set(branches.map((b) => b._id.toString()));
    const item = await this.inventoryModel.findById(itemId);
    if (!item || !branchIds.has(item.branchId?.toString())) {
      throw new NotFoundException('Inventory item not found');
    }
    const wasLow = item.quantity <= item.lowStockThreshold;
    if (dto.quantity != null) item.quantity = dto.quantity;
    if (dto.lowStockThreshold != null) item.lowStockThreshold = dto.lowStockThreshold;
    if (dto.usagePerOrder != null) item.usagePerOrder = dto.usagePerOrder;
    if (dto.usagePerKg != null) item.usagePerKg = dto.usagePerKg;
    await item.save();
    if (!wasLow && item.quantity <= item.lowStockThreshold) {
      void this.partnerOrderNotifications
        .notifyLowStock(item.branchId.toString(), {
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
        })
        .catch(() => {});
    }
    return { success: true, data: this.formatInventoryItem(item) };
  }

  /** Auto-deducts consumable stock (detergent/bags/etc.) for one completed order — called once
   * from ShopReceivingService.confirmItems, which already guards against being run twice for the
   * same order. Items with usagePerOrder/usagePerKg both 0 (the default) are left untouched.
   * No-ops entirely when the shop has turned inventory tracking off. */
  async deductInventoryForOrder(branchId: Types.ObjectId, verifiedWeightKg: number) {
    const branch = await this.branchModel.findById(branchId).select('portalSettings').lean();
    if (branch?.portalSettings?.inventoryEnabled === false) return;

    const items = await this.inventoryModel.find({
      branchId,
      $or: [{ usagePerOrder: { $gt: 0 } }, { usagePerKg: { $gt: 0 } }],
    });
    await Promise.all(
      items.map((item) => {
        const wasLow = item.quantity <= item.lowStockThreshold;
        const used = item.usagePerOrder + item.usagePerKg * verifiedWeightKg;
        item.quantity = Math.max(0, item.quantity - used);
        return item.save().then(() => {
          if (!wasLow && item.quantity <= item.lowStockThreshold) {
            return this.partnerOrderNotifications
              .notifyLowStock(branchId.toString(), {
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
              })
              .catch(() => {});
          }
        });
      }),
    );
  }

  async getReports(userId: string, role: UserRole, days = 7) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const { filter: scopeFilter } = await this.dashboardScopeFilter(userId, role);
    const orders = await this.orderModel.find({ updatedAt: { $gte: from }, ...scopeFilter });
    const completed = orders.filter((o) => COMPLETED_STATUSES.includes(o.status));
    const revenue = completed.reduce((sum, o) => sum + o.total, 0);

    const branches = await this.resolvePartnerBranches(userId, role);
    const commissionRateByBranchId = this.commissionRateMap(branches);
    const totalFee = completed.reduce(
      (sum, o) => sum + this.computeOrderFee(o, commissionRateByBranchId),
      0,
    );
    const payout = revenue - totalFee;

    const byStatus = orders.reduce(
      (acc, o) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const byBooking = completed.reduce(
      (acc, o) => {
        acc[o.bookingType] = (acc[o.bookingType] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Combined totals above already roll up across every branch this partner owns — this
    // breakdown just splits that same data back out per branch for multi-branch partners.
    let byBranch: {
      branchId: string;
      branchName: string;
      branchCode: string;
      totalOrders: number;
      completedOrders: number;
      revenue: number;
      payout: number;
    }[] = [];
    if (role === UserRole.PARTNER && branches.length > 1) {
      byBranch = branches.map((branch) => {
        const branchIdStr = branch._id.toString();
        const branchOrders = orders.filter((o) => o.branchId?.toString() === branchIdStr);
        const branchCompleted = branchOrders.filter((o) => COMPLETED_STATUSES.includes(o.status));
        const branchRevenue = branchCompleted.reduce((sum, o) => sum + o.total, 0);
        const branchFee = branchCompleted.reduce(
          (sum, o) => sum + this.computeOrderFee(o, commissionRateByBranchId),
          0,
        );
        return {
          branchId: branchIdStr,
          branchName: branch.name,
          branchCode: branch.code,
          totalOrders: branchOrders.length,
          completedOrders: branchCompleted.length,
          revenue: branchRevenue,
          payout: branchRevenue - branchFee,
        };
      });
    }

    return {
      success: true,
      data: {
        periodDays: days,
        from: from.toISOString(),
        totalOrders: orders.length,
        completedOrders: completed.length,
        revenue,
        payout,
        averageOrderValue: completed.length ? Math.round(revenue / completed.length) : 0,
        ordersByStatus: byStatus,
        completedByService: byBooking,
        byBranch,
      },
    };
  }

  private async revenueOrderFilter(userId: string, role: UserRole): Promise<Record<string, unknown>> {
    const filter: Record<string, unknown> = { status: { $in: COMPLETED_STATUSES } };
    if (role !== UserRole.ADMIN) {
      const branches = await this.resolvePartnerBranches(userId, role);
      filter.branchId = { $in: branches.map((b) => b._id) };
    }
    return filter;
  }

  async getRevenue(userId: string, role: UserRole) {
    const baseFilter = await this.revenueOrderFilter(userId, role);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
    const weekStart = new Date(startOfDay);
    weekStart.setDate(weekStart.getDate() - 6);

    const [week, month, recentCompleted, allTimeSummary] = await Promise.all([
      this.orderModel.find({ ...baseFilter, updatedAt: { $gte: weekStart } }),
      this.orderModel.find({ ...baseFilter, updatedAt: { $gte: startOfMonth } }),
      this.orderModel.find(baseFilter).sort({ updatedAt: -1 }).limit(200),
      // Grouped per branchId — a partner can own several branches with different commissionRate,
      // so the legacy-commission subtotal must stay bucketed until each branch's own rate is applied in JS below.
      this.orderModel.aggregate<{
        _id: Types.ObjectId | null;
        total: number;
        legacyCommissionSubtotalSum: number;
        shopMarkupFeeSum: number;
        count: number;
      }>([
        { $match: baseFilter },
        {
          $group: {
            _id: '$branchId',
            total: { $sum: '$total' },
            // Legacy orders (no pricingModel, or explicitly 'legacy_commission') settle via commissionRate * subtotal.
            legacyCommissionSubtotalSum: {
              $sum: {
                $cond: [
                  { $in: ['$pricingModel', ['shop_markup', 'commission']] },
                  0,
                  { $ifNull: ['$subtotal', '$total'] },
                ],
              },
            },
            // shop_markup/commission orders already have Lunara's cut baked in as subtotal - baseSubtotal.
            shopMarkupFeeSum: {
              $sum: {
                $cond: [
                  { $in: ['$pricingModel', ['shop_markup', 'commission']] },
                  { $subtract: [{ $ifNull: ['$subtotal', '$total'] }, { $ifNull: ['$baseSubtotal', 0] }] },
                  0,
                ],
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // `week` already covers today's range too (weekStart <= startOfDay always) — no need for a
    // separate query.
    const today = week.filter((o) => o.updatedAt >= startOfDay);
    const todayTotal = today.reduce((s, o) => s + o.total, 0);
    const weekTotal = week.reduce((s, o) => s + o.total, 0);
    const monthTotal = month.reduce((s, o) => s + o.total, 0);
    const allTimeRevenue = allTimeSummary.reduce((s, r) => s + r.total, 0);
    const allTimeCompletedOrders = allTimeSummary.reduce((s, r) => s + r.count, 0);

    const branches = await this.resolvePartnerBranches(userId, role);
    const commissionRateByBranchId = this.commissionRateMap(branches);

    // Commission/markup breakdown helper — consistent with createSettlement rounding
    const periodBreakdown = (
      orders: {
        total: number;
        subtotal?: number;
        baseSubtotal?: number;
        pricingModel?: string;
        branchId?: Types.ObjectId;
      }[],
    ) => {
      const gross = orders.reduce((s, o) => s + o.total, 0);
      const fee = Math.round(
        orders.reduce((s, o) => s + this.computeOrderFee(o, commissionRateByBranchId), 0),
      );
      return { gross, fee, payout: gross - fee };
    };

    const last7: { date: string; revenue: number; payout: number; orders: number; _dayOrders: { total: number; subtotal?: number; baseSubtotal?: number; pricingModel?: string; branchId?: Types.ObjectId }[] }[] = [];
    // `week` (fetched above) already spans this exact 7-day window — partition it in memory by
    // the same [d, next) boundaries instead of re-querying the DB once per day.
    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfDay);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayOrders = week.filter((o) => o.updatedAt >= d && o.updatedAt < next);
      const dayRevenue = dayOrders.reduce((s, o) => s + o.total, 0);
      last7.push({
        date: d.toISOString().slice(0, 10),
        revenue: dayRevenue,
        payout: 0, // filled in below now that commissionRateByBranchId is known
        orders: dayOrders.length,
        _dayOrders: dayOrders,
      });
    }

    const paymentsByOrderId = await loadLatestOrderPaymentsByOrderId(
      this.paymentModel,
      recentCompleted.map((o) => o._id),
    );

    // Backfill daily payout now that commissionRateByBranchId is known (fee applied to subtotal, not total)
    for (const point of last7) {
      const dayFee = Math.round(
        point._dayOrders.reduce((s, o) => s + this.computeOrderFee(o, commissionRateByBranchId), 0),
      );
      point.payout = point.revenue - dayFee;
      delete (point as Partial<typeof point>)._dayOrders;
    }

    const todayBreakdown = periodBreakdown(today);
    const weekBreakdown = periodBreakdown(week);
    const monthBreakdown = periodBreakdown(month);
    const allTimeFee = Math.round(
      allTimeSummary.reduce(
        (s, r) =>
          s +
          r.legacyCommissionSubtotalSum * (commissionRateByBranchId.get(r._id?.toString() ?? '') ?? 0.2) +
          r.shopMarkupFeeSum,
        0,
      ),
    );
    const allTimePayout = allTimeRevenue - allTimeFee;

    const recentOrders = recentCompleted.map((o) => {
      const payment = paymentsByOrderId.get(o._id.toString());
      const isCash = payment?.method === PaymentMethod.CASH;
      const cashCollected = isCash && payment?.status === PaymentStatus.PAID;
      const subtotal = o.subtotal ?? o.total;
      const lunaraFee = this.computeOrderFee(o, commissionRateByBranchId);
      const partnerPayout = o.total - lunaraFee;
      const commissionRate = commissionRateByBranchId.get(o.branchId?.toString() ?? '') ?? 0.2;
      return {
        orderId: o._id.toString(),
        completedAt: o.updatedAt?.toISOString() ?? o.createdAt?.toISOString(),
        amount: o.total,
        subtotal,
        lunaraFee,
        partnerPayout,
        commissionRate,
        pricingModel: o.pricingModel ?? 'legacy_commission',
        bookingType: o.bookingType,
        paymentMethod: payment?.method ?? null,
        cashTiming: payment?.cashTiming ?? null,
        cashCollected,
        cashCollectedAt: cashCollected ? payment?.paidAt?.toISOString() : null,
        receiptCode: payment?.receiptCode ?? null,
      };
    });

    // Same month-to-date figures as `month`/`monthTotal` above, just split per branch for
    // multi-branch partners — the combined totals already roll up across all owned branches.
    let byBranch: {
      branchId: string;
      branchName: string;
      branchCode: string;
      monthOrders: number;
      monthRevenue: number;
      monthPayout: number;
    }[] = [];
    if (role === UserRole.PARTNER && branches.length > 1) {
      byBranch = branches.map((branch) => {
        const branchIdStr = branch._id.toString();
        const branchOrders = month.filter((o) => o.branchId?.toString() === branchIdStr);
        const breakdown = periodBreakdown(branchOrders);
        return {
          branchId: branchIdStr,
          branchName: branch.name,
          branchCode: branch.code,
          monthOrders: branchOrders.length,
          monthRevenue: breakdown.gross,
          monthPayout: breakdown.payout,
        };
      });
    }

    return {
      success: true,
      data: {
        today: todayTotal,
        todayFee: todayBreakdown.fee,
        todayPayout: todayBreakdown.payout,
        week: weekTotal,
        weekFee: weekBreakdown.fee,
        weekPayout: weekBreakdown.payout,
        month: monthTotal,
        monthFee: monthBreakdown.fee,
        monthPayout: monthBreakdown.payout,
        todayOrders: today.length,
        weekOrders: week.length,
        monthOrders: month.length,
        avgOrderToday: today.length ? Math.round(todayTotal / today.length) : 0,
        avgOrderMonth: month.length ? Math.round(monthTotal / month.length) : 0,
        allTimeCompletedOrders,
        allTimeRevenue,
        allTimeFee,
        allTimePayout,
        daily: last7,
        recentOrders,
        byBranch,
      },
    };
  }

  async getInvoices(userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) {
      const invoices = await this.invoiceModel.find().sort({ createdAt: -1 }).limit(100);
      return { success: true, data: invoices.map((i) => this.formatInvoice(i)) };
    }
    const invoices = await this.invoiceModel
      .find({ partnerId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 });
    return { success: true, data: invoices.map((i) => this.formatInvoice(i)) };
  }

  async getPartnerInvoicesForAdmin(partnerId: string) {
    const invoices = await this.invoiceModel
      .find({ partnerId: new Types.ObjectId(partnerId) })
      .sort({ createdAt: -1 });
    return { success: true, data: invoices.map((i) => this.formatInvoice(i)) };
  }

  /** Net amount this partner owes Lunara — sum of pending invoice amounts due. */
  async getReceivableBalance(partnerId: string) {
    const pendingInvoices = await this.invoiceModel.find({
      partnerId: new Types.ObjectId(partnerId),
      status: 'pending',
    });
    const receivableBalance = pendingInvoices.reduce((sum, i) => sum + i.amountDue, 0);
    return { success: true, data: { partnerId, receivableBalance } };
  }

  /** Response shape must stay compatible with PartnerSubscriptionInfo (packages/types) — the
   * partner-web "Plan" settings tab reads this directly and predates the billing.Subscription
   * model, so this maps the new Plan/Subscription records onto that same shape rather than
   * introducing a parallel endpoint. */
  async getSubscriptionInfo(partnerId: string) {
    const KNOWN_PLAN_KEYS = ['trial', 'basic', 'starter', 'professional'] as const;
    const subscription = await this.subscriptionService.findByPartnerId(partnerId);
    if (!subscription) {
      return {
        success: true,
        data: {
          subscriptionPlan: 'trial' as const,
          planPrice: 0,
          planRenewsAt: undefined,
          trialEndsAt: undefined,
          paymentMethodOnFile: false,
          cardBrand: undefined,
          cardLast4: undefined,
          promotionCode: undefined,
          promotionFreeMonthsRemaining: undefined,
        },
      };
    }
    const plan = await this.planService.findById(subscription.planId);
    const planKey = (plan && (KNOWN_PLAN_KEYS as readonly string[]).includes(plan.key) ? plan.key : 'trial') as
      (typeof KNOWN_PLAN_KEYS)[number];
    return {
      success: true,
      data: {
        subscriptionPlan: planKey,
        planPrice: subscription.priceSnapshot ?? 0,
        planRenewsAt: subscription.status === 'trialing' ? undefined : subscription.currentPeriodEnd,
        trialEndsAt: subscription.trialEndsAt,
        paymentMethodOnFile: subscription.paymentMethodOnFile,
        cardBrand: subscription.cardBrand,
        cardLast4: subscription.cardLast4,
        promotionCode: subscription.promotionCode,
        promotionFreeMonthsRemaining: subscription.promotionFreeMonthsRemaining,
      },
    };
  }

  async getUninvoicedOrders(partnerId: string) {
    const branches = await this.branchModel.find({
      partnerUserId: new Types.ObjectId(partnerId),
    });
    if (branches.length === 0) throw new NotFoundException('Partner branch not found');
    const commissionRateByBranchId = this.commissionRateMap(branches);

    const orders = await this.orderModel
      .find({
        branchId: { $in: branches.map((b) => b._id) },
        status: { $in: COMPLETED_STATUSES },
        invoiceId: { $exists: false },
      })
      .sort({ updatedAt: -1 });

    const paymentsByOrderId = await loadLatestOrderPaymentsByOrderId(
      this.paymentModel,
      orders.map((o) => o._id),
    );

    const data = orders.map((o) => {
      const payment = paymentsByOrderId.get(o._id.toString());
      const isCash = payment?.method === PaymentMethod.CASH;
      const cashCollected = isCash && payment?.status === PaymentStatus.PAID;
      const subtotal = o.subtotal ?? o.total;
      const commissionDue = this.computeOrderFee(o, commissionRateByBranchId);
      const commissionRate = commissionRateByBranchId.get(o.branchId?.toString() ?? '') ?? 0.2;
      return {
        orderId: o._id.toString(),
        completedAt: o.updatedAt?.toISOString() ?? o.createdAt?.toISOString(),
        amount: o.total,
        subtotal,
        commissionDue,
        commissionRate,
        pricingModel: o.pricingModel ?? 'legacy_commission',
        bookingType: o.bookingType,
        paymentMethod: payment?.method ?? null,
        cashTiming: payment?.cashTiming ?? null,
        cashCollected,
      };
    });

    return { success: true, data };
  }

  async getInvoiceOrders(userId: string, role: UserRole, invoiceId: string) {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');

    // For partners, scope to their own invoice only
    if (role !== UserRole.ADMIN) {
      if (invoice.partnerId.toString() !== userId) {
        throw new NotFoundException('Invoice not found');
      }
    }

    const branches = await this.branchModel.find({
      partnerUserId: new Types.ObjectId(invoice.partnerId),
    });
    if (branches.length === 0) throw new NotFoundException('Partner branch not found');

    const orders = await this.orderModel
      .find({ invoiceId: invoice._id })
      .sort({ updatedAt: -1 });

    const paymentsByOrderId = await loadLatestOrderPaymentsByOrderId(
      this.paymentModel,
      orders.map((o) => o._id),
    );

    // Use the commission rate snapshot from the invoice (a weighted average across whichever
    // branches contributed orders) for legacy orders, for exact historical reconciliation.
    // shop_markup orders ignore this and use their own baseSubtotal regardless (see computeOrderFee).
    const commissionRate = invoice.commissionRate ?? 0.20;
    const emptyBranchRateMap = new Map<string, number>();

    const data = orders.map((o) => {
      const payment = paymentsByOrderId.get(o._id.toString());
      const isCash = payment?.method === PaymentMethod.CASH;
      const cashCollected = isCash && payment?.status === PaymentStatus.PAID;
      const subtotal = o.subtotal ?? o.total;
      const commissionDue = this.computeOrderFee(o, emptyBranchRateMap, commissionRate);
      return {
        orderId: o._id.toString(),
        completedAt: o.updatedAt?.toISOString() ?? o.createdAt?.toISOString(),
        amount: o.total,
        subtotal,
        commissionDue,
        commissionRate,
        pricingModel: o.pricingModel ?? 'legacy_commission',
        bookingType: o.bookingType,
        paymentMethod: payment?.method ?? null,
        cashTiming: payment?.cashTiming ?? null,
        cashCollected,
        cashCollectedAt: cashCollected ? payment?.paidAt?.toISOString() : null,
        receiptCode: payment?.receiptCode ?? null,
      };
    });

    return { success: true, data };
  }

  /** Sum of creditTotal − creditRecovered across every invoice for this partner — how much is
   * still outstanding from post-invoice refund credits that were never actually applied to a
   * later invoice. Surfaced to admin before creating a new invoice so they can choose to net it. */
  async getOutstandingCreditBalance(partnerId: string) {
    const [result] = await this.invoiceModel.aggregate<{ outstanding: number }>([
      { $match: { partnerId: new Types.ObjectId(partnerId) } },
      {
        $group: {
          _id: null,
          outstanding: { $sum: { $subtract: ['$creditTotal', '$creditRecovered'] } },
        },
      },
    ]);
    return { success: true, data: { outstanding: Math.max(0, result?.outstanding ?? 0) } };
  }

  async createInvoice(
    adminUserId: string,
    partnerId: string,
    dto: { orderIds: string[]; adminNote?: string; applyCredit?: boolean },
  ) {
    const partner = await this.userModel.findById(partnerId);
    if (!partner) throw new NotFoundException('Partner not found');
    const subscription = await this.subscriptionService.findByPartnerId(partnerId);
    const cycleDue = this.isCycleDue(subscription);
    const subscriptionFeeDue = this.computeDueSubscriptionFee(subscription);
    const subscriptionPlanLabel = subscription
      ? (await this.planService.findById(subscription.planId))?.key ?? 'unknown'
      : 'trial';

    if ((!dto.orderIds || dto.orderIds.length === 0) && !cycleDue) {
      throw new BadRequestException('At least one order must be selected');
    }

    // Find all of the partner's branches — a partner account can own several shops, and orders
    // selected for this invoice may span any of them.
    const branches = await this.branchModel.find({
      partnerUserId: new Types.ObjectId(partnerId),
    });
    if (branches.length === 0) throw new NotFoundException('Partner branch not found');
    const commissionRateByBranchId = this.commissionRateMap(branches);

    // Pre-generate the invoice id and use it to atomically *claim* the selected orders before
    // computing any totals. The updateMany's filter re-asserts invoiceId is still unset, so two
    // concurrent createInvoice calls with overlapping order IDs can each only claim the orders
    // still unclaimed at the moment their write lands — MongoDB serializes per-document writes, so
    // the same order can never end up stamped into two invoices.
    const invoiceId = new Types.ObjectId();
    let completedOrders: OrderDocument[] = [];
    if (dto.orderIds && dto.orderIds.length > 0) {
      const claim = await this.orderModel.updateMany(
        {
          _id: { $in: dto.orderIds.map((id) => new Types.ObjectId(id)) },
          branchId: { $in: branches.map((b) => b._id) },
          status: { $in: COMPLETED_STATUSES },
          invoiceId: { $exists: false },
        },
        { $set: { invoiceId } },
      );

      if (claim.modifiedCount === 0) {
        throw new BadRequestException('No valid uninvoiced orders found for the selected IDs');
      }

      completedOrders = await this.orderModel.find({ invoiceId });
    }

    // Derive period from the selected orders' completion timestamps — a subscription-only
    // invoice (no orders) simply covers "now", since there's no order activity to bound it.
    const timestamps = completedOrders.map((o) => o.updatedAt?.getTime() ?? o.createdAt?.getTime() ?? Date.now());
    const start = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : new Date();
    const end = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : new Date();

    const paymentsByOrderId = await loadLatestOrderPaymentsByOrderId(
      this.paymentModel,
      completedOrders.map((o) => o._id),
    );

    let cashOrders = 0;
    let digitalOrders = 0;
    for (const order of completedOrders) {
      const payment = paymentsByOrderId.get(order._id.toString());
      if (payment?.method === PaymentMethod.CASH) {
        cashOrders++;
      } else {
        digitalOrders++;
      }
    }

    const totalCollected = completedOrders.reduce((s, o) => s + o.total, 0);
    // shop_markup orders already have Lunara's cut baked into the price the customer paid;
    // legacy orders take their own branch's commissionRate off the laundry subtotal (not the
    // delivery fee) — branches under the same partner can carry different rates, so this must
    // be computed per order rather than with one flat number.
    const commissionDue = Math.round(
      completedOrders.reduce((s, o) => s + this.computeOrderFee(o, commissionRateByBranchId), 0),
    );

    // The partner now collects the full customer-paid deliveryFee directly, but Lunara still
    // fronts the rider's pickup+delivery cost out of platform_cash — actual rider cost for these
    // orders (read from the ledger, not estimated — correctly ₱0 for orders an employee rider
    // handled) is billed back to the partner alongside the commission, additive rather than
    // capped (there's no payout to cap it against anymore).
    const riderCostByOrderId = await this.ledgerService.getRiderCostByOrderId(
      completedOrders.map((o) => o._id.toString()),
    );
    const riderCostDue = Math.max(
      0,
      completedOrders.reduce((s, o) => s + (riderCostByOrderId.get(o._id.toString()) ?? 0), 0),
    );

    // Opt-in: net this partner's outstanding balance from earlier post-invoice credits (refunds
    // on orders already invoiced) against this new invoice, and mark it recovered on the invoices
    // it came from so it isn't counted as outstanding twice.
    let creditApplied = 0;
    const creditSourceInvoices: { id: Types.ObjectId; apply: number }[] = [];
    if (dto.applyCredit) {
      const outstandingInvoices = await this.invoiceModel
        .find({
          partnerId: new Types.ObjectId(partnerId),
          $expr: { $gt: ['$creditTotal', '$creditRecovered'] },
        })
        .sort({ createdAt: 1 });
      let remainingCapacity = commissionDue + riderCostDue;
      for (const inv of outstandingInvoices) {
        if (remainingCapacity <= 0) break;
        const outstanding = inv.creditTotal - inv.creditRecovered;
        const apply = Math.min(outstanding, remainingCapacity);
        if (apply <= 0) continue;
        creditSourceInvoices.push({ id: inv._id, apply });
        creditApplied += apply;
        remainingCapacity -= apply;
      }
    }

    // Subscription fee is billed additively and never netted against credit — credit only offsets
    // what the partner's own order activity generated (commission + rider cost).
    const commissionAndRiderDue = Math.max(0, commissionDue + riderCostDue - creditApplied);
    const amountDue = commissionAndRiderDue + subscriptionFeeDue;

    // Stored commissionRate becomes a display-only weighted average across the legacy-priced
    // orders in this invoice (shop_markup/commission orders don't have a "rate" at all, their fee
    // is baked into baseSubtotal) — once an invoice can span branches with different rates, this
    // field is no longer the single source of truth for the fee; commissionDue (computed
    // per-order above) always is.
    const legacyOrders = completedOrders.filter(
      (o) => o.pricingModel !== 'shop_markup' && o.pricingModel !== 'commission',
    );
    const legacySubtotalSum = legacyOrders.reduce((s, o) => s + (o.subtotal ?? o.total), 0);
    const weightedCommissionRate =
      legacySubtotalSum > 0
        ? legacyOrders.reduce((s, o) => {
            const rate = commissionRateByBranchId.get(o.branchId?.toString() ?? '') ?? 0.2;
            return s + rate * (o.subtotal ?? o.total);
          }, 0) / legacySubtotalSum
        : 0.2;

    const invoiceNumber = await this.nextInvoiceNumber();
    const dueDate = new Date(end.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fullyCoveredByCredit = amountDue === 0 && creditApplied > 0;

    let invoice: PartnerInvoiceDocument;
    try {
      invoice = await this.invoiceModel.create({
        _id: invoiceId,
        partnerId: new Types.ObjectId(partnerId),
        invoiceNumber,
        periodStart: start,
        periodEnd: end,
        totalOrders: completedOrders.length,
        cashOrders,
        digitalOrders,
        totalCollected,
        commissionDue,
        riderCostDue,
        subscriptionFeeDue,
        amountDue,
        creditApplied,
        commissionRate: weightedCommissionRate,
        dueDate,
        status: fullyCoveredByCredit ? 'paid' : 'pending',
        ...(fullyCoveredByCredit ? { paidAt: new Date(), paidBy: new Types.ObjectId(adminUserId) } : {}),
        adminNote: dto.adminNote,
      });
    } catch (err) {
      // Release the claimed orders so they aren't stuck referencing an invoice that was never
      // actually created.
      await this.orderModel.updateMany(
        { invoiceId },
        { $unset: { invoiceId: 1 } },
      );
      throw err;
    }

    // Advance the subscription's billing period now that this cycle has been billed (even a
    // promo-discounted ₱0 fee still counts — the promo's free-months counter only decrements
    // here), so the next invoice run doesn't charge it again until the next cycle is due.
    if (cycleDue && subscription) {
      await this.subscriptionService.advancePeriod(subscription._id as Types.ObjectId);
    }

    // Mark the recovered credit as no longer outstanding on the invoices it came from — after
    // createInvoice's own document write succeeds, so a failure above never marks credit
    // recovered without an actual invoice to show for it.
    for (const src of creditSourceInvoices) {
      await this.invoiceModel.updateOne(
        { _id: src.id },
        { $inc: { creditRecovered: src.apply } },
      );
    }

    // Lunara never holds the collected cash under this model — only the receivable (what the
    // partner owes) and the revenue it represents are booked. creditApplied needs no separate
    // debit here: it was already expensed via refund_expense at credit time (recordInvoiceCredit),
    // so simply booking a smaller receivable here is what actually recovers it.
    if (commissionAndRiderDue > 0 || amountDue === 0) {
      await this.ledgerService.post(
        `invoice:${invoice._id.toString()}`,
        'invoice',
        invoice._id.toString(),
        [
          {
            accountType: 'partner_receivable',
            direction: 'debit',
            amount: commissionAndRiderDue,
            description: `Invoice ${invoiceNumber} issued to partner ${partnerId} (${start.toISOString().slice(0, 10)}..${end.toISOString().slice(0, 10)})`,
          },
          {
            accountType: 'platform_revenue',
            direction: 'credit',
            amount: commissionAndRiderDue,
            description: `Commission + rider cost billed to partner ${partnerId} via invoice ${invoiceNumber} (rate ${(weightedCommissionRate * 100).toFixed(1)}%)${riderCostDue > 0 ? `, incl. ₱${riderCostDue} rider delivery cost` : ''}${creditApplied > 0 ? `, net of ₱${creditApplied} applied credit` : ''}`,
          },
        ],
      );
    }

    if (subscriptionFeeDue > 0) {
      await this.ledgerService.post(
        `subscription_fee:${invoice._id.toString()}`,
        'subscription_fee',
        invoice._id.toString(),
        [
          {
            accountType: 'partner_receivable',
            direction: 'debit',
            amount: subscriptionFeeDue,
            description: `${subscriptionPlanLabel} plan subscription fee billed to partner ${partnerId} via invoice ${invoiceNumber}`,
          },
          {
            accountType: 'platform_revenue',
            direction: 'credit',
            amount: subscriptionFeeDue,
            description: `${subscriptionPlanLabel} plan subscription fee revenue from partner ${partnerId} via invoice ${invoiceNumber}`,
          },
        ],
      );
    }

    // If this is a subscription-fee-only invoice (no bundled commission/rider cost) and the
    // partner has a saved card, attempt to auto-charge it — on success the invoice is marked
    // paid immediately via the same path an admin uses for a manual bank/GCash settlement.
    // Any failure (no card, decline, 3DS required, PayMongo error) leaves the invoice pending,
    // identical to today's fully-manual behavior.
    if (
      subscriptionFeeDue > 0 &&
      dto.orderIds.length === 0 &&
      subscription?.paymentMethodOnFile &&
      subscription.provider === 'paymongo'
    ) {
      const charge = await this.subscriptionService.attemptAutoCharge(
        subscription,
        subscriptionFeeDue,
        `${subscriptionPlanLabel} plan subscription — invoice ${invoiceNumber}`,
      );
      if (charge.success) {
        await this.markInvoicePaid(adminUserId, invoice._id.toString(), {
          paymentReference: charge.providerReference,
          note: 'Auto-charged via saved card',
        });
      }
    }

    // Auto-email the PDF invoice to the partner — never fails invoice creation itself.
    try {
      const partnerUser = await this.userModel.findById(partnerId).select('email').lean();
      const pdfBuffer = await this.invoicePdfService.build(
        {
          invoiceNumber: invoice.invoiceNumber,
          periodStart: invoice.periodStart,
          periodEnd: invoice.periodEnd,
          dueDate: invoice.dueDate,
          totalCollected: invoice.totalCollected,
          commissionDue: invoice.commissionDue,
          riderCostDue: invoice.riderCostDue,
          subscriptionFeeDue: invoice.subscriptionFeeDue,
          creditApplied: invoice.creditApplied,
          amountDue: invoice.amountDue,
          status: invoice.status,
        },
        { name: branches[0]?.name ?? 'Partner', email: partnerUser?.email },
        completedOrders.map((o) => ({
          orderId: o._id.toString(),
          completedAt: (o.updatedAt ?? o.createdAt)?.toISOString(),
          amount: o.total,
          commissionDue: this.computeOrderFee(o, commissionRateByBranchId),
          paymentMethod: paymentsByOrderId.get(o._id.toString())?.method ?? undefined,
        })),
      );
      invoice.pdfGeneratedAt = new Date();
      if (partnerUser?.email) {
        const sent = await this.emailService.sendPartnerInvoice(
          partnerUser.email,
          { invoiceNumber: invoice.invoiceNumber, amountDue: invoice.amountDue, dueDate: invoice.dueDate },
          pdfBuffer,
        );
        if (sent) {
          invoice.emailedAt = new Date();
          invoice.emailError = undefined;
        } else {
          invoice.emailError = 'Email send failed or SMTP not configured';
        }
      } else {
        invoice.emailError = 'Partner has no email on file';
      }
      await invoice.save();
    } catch (err) {
      invoice.emailError = err instanceof Error ? err.message : 'Failed to generate/send invoice PDF';
      await invoice.save();
    }

    return { success: true, data: this.formatInvoice(invoice) };
  }

  /** Admin marks an invoice paid once the partner settles it through an offline channel
   * (bank transfer/GCash) — there's no in-app payment collection under this model. */
  async markInvoicePaid(adminUserId: string, invoiceId: string, dto: { paymentReference?: string; note?: string }) {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'pending') {
      throw new BadRequestException(`Invoice is already ${invoice.status}`);
    }

    invoice.status = 'paid';
    invoice.paidAt = new Date();
    invoice.paidBy = new Types.ObjectId(adminUserId);
    if (dto.paymentReference) invoice.paymentReference = dto.paymentReference;
    if (dto.note) invoice.adminNote = invoice.adminNote ? `${invoice.adminNote}\n${dto.note}` : dto.note;
    await invoice.save();

    if (invoice.amountDue > 0) {
      await this.ledgerService.post(
        `invoice-payment:${invoice._id.toString()}`,
        'invoice_payment',
        invoice._id.toString(),
        [
          {
            accountType: 'platform_cash',
            direction: 'debit',
            amount: invoice.amountDue,
            description: `Cash received from partner ${invoice.partnerId.toString()} for invoice ${invoice.invoiceNumber}${dto.paymentReference ? ` (ref ${dto.paymentReference})` : ''}`,
          },
          {
            accountType: 'partner_receivable',
            direction: 'credit',
            amount: invoice.amountDue,
            description: `Receivable cleared for invoice ${invoice.invoiceNumber}`,
          },
        ],
      );
    }

    // If this payment resolves a subscription fee that had pushed the partner into dunning,
    // reactivate them immediately — covers both the admin manual-pay button and the dunning
    // cron's own successful retry charge (which also calls this method).
    if (invoice.subscriptionFeeDue > 0) {
      const subscription = await this.subscriptionService.findByPartnerId(invoice.partnerId.toString());
      if (subscription && ['past_due', 'grace_period', 'suspended'].includes(subscription.status)) {
        await this.subscriptionService.transitionStatus(subscription, 'active');
        await this.notificationDispatchService.dispatch({
          userId: invoice.partnerId.toString(),
          title: 'Subscription reactivated',
          body: `Your payment for invoice ${invoice.invoiceNumber} was received — your account is fully active again.`,
          data: { type: 'billing_reactivated', subscriptionId: (subscription._id as Types.ObjectId).toString() },
        });
      }
    }

    return { success: true, data: this.formatInvoice(invoice) };
  }

  /** Admin records a subscription payment received outside the normal invoice cycle (e.g. a
   * suspended/past-due partner pays to reactivate before their next weekly invoice would bill
   * them) — advances the billing period by one month and reactivates the subscription
   * immediately, mirroring what markInvoicePaid does when a subscription-fee invoice is settled,
   * but without requiring a pending invoice to exist first. */
  async recordSubscriptionPayment(
    adminUserId: string,
    partnerId: string,
    dto: { amountPhp: number; paymentReference?: string; note?: string },
  ) {
    const subscription = await this.subscriptionService.findByPartnerId(partnerId);
    if (!subscription) throw new NotFoundException('Subscription not found for this partner');

    const wasDunning = ['past_due', 'grace_period', 'suspended'].includes(subscription.status);

    // advancePeriod loads/saves its own document instance, so re-fetch before transitionStatus
    // rather than reusing the now-stale `subscription` handle above — saving that stale instance
    // would otherwise report (though not actually persist, since currentPeriodEnd was never
    // marked modified on it) an out-of-date currentPeriodEnd back to the caller.
    await this.subscriptionService.advancePeriod(subscription._id as Types.ObjectId);
    const refreshed = await this.subscriptionService.findByPartnerId(partnerId);
    if (!refreshed) throw new NotFoundException('Subscription not found for this partner');
    const { subscription: updated } = await this.subscriptionService.transitionStatus(refreshed, 'active');
    if (dto.note) {
      updated.adminNote = updated.adminNote ? `${updated.adminNote}\n${dto.note}` : dto.note;
      await updated.save();
    }

    const subscriptionId = (updated._id as Types.ObjectId).toString();
    await this.ledgerService.post(
      `manual-subscription-payment:${subscriptionId}:${Date.now()}`,
      'subscription_fee',
      subscriptionId,
      [
        {
          accountType: 'platform_cash',
          direction: 'debit',
          amount: dto.amountPhp,
          description: `Cash received directly from partner ${partnerId} for subscription fee${dto.paymentReference ? ` (ref ${dto.paymentReference})` : ''} — recorded by admin ${adminUserId}`,
        },
        {
          accountType: 'platform_revenue',
          direction: 'credit',
          amount: dto.amountPhp,
          description: `Subscription fee revenue from partner ${partnerId} (manual payment, no invoice)`,
        },
      ],
    );

    if (wasDunning) {
      await this.notificationDispatchService.dispatch({
        userId: partnerId,
        title: 'Subscription reactivated',
        body: 'Your payment was recorded — your account is fully active again.',
        data: { type: 'billing_reactivated', subscriptionId },
      });
    }

    return { success: true, data: updated };
  }

  /** Regenerates the invoice PDF on demand (no storage — cheap and deterministic from the
   * invoice + its claimed orders) for partner-web/admin-web download buttons. */
  async downloadInvoicePdf(userId: string, role: UserRole, invoiceId: string): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (role !== UserRole.ADMIN && invoice.partnerId.toString() !== userId) {
      throw new NotFoundException('Invoice not found');
    }

    const branches = await this.branchModel.find({ partnerUserId: invoice.partnerId });
    const partnerUser = await this.userModel.findById(invoice.partnerId).select('email').lean();
    const orders = await this.orderModel.find({ invoiceId: invoice._id }).sort({ updatedAt: -1 });
    const paymentsByOrderId = await loadLatestOrderPaymentsByOrderId(this.paymentModel, orders.map((o) => o._id));
    const emptyBranchRateMap = new Map<string, number>();

    const buffer = await this.invoicePdfService.build(
      {
        invoiceNumber: invoice.invoiceNumber,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        dueDate: invoice.dueDate,
        totalCollected: invoice.totalCollected,
        commissionDue: invoice.commissionDue,
        riderCostDue: invoice.riderCostDue,
        subscriptionFeeDue: invoice.subscriptionFeeDue,
        creditApplied: invoice.creditApplied,
        amountDue: invoice.amountDue,
        status: invoice.status,
      },
      { name: branches[0]?.name ?? 'Partner', email: partnerUser?.email },
      orders.map((o) => ({
        orderId: o._id.toString(),
        completedAt: (o.updatedAt ?? o.createdAt)?.toISOString(),
        amount: o.total,
        commissionDue: this.computeOrderFee(o, emptyBranchRateMap, invoice.commissionRate),
        paymentMethod: paymentsByOrderId.get(o._id.toString())?.method ?? undefined,
      })),
    );

    return { buffer, filename: `${invoice.invoiceNumber}.pdf` };
  }

  private formatInvoice(i: PartnerInvoiceDocument) {
    return {
      _id: i._id.toString(),
      partnerId: i.partnerId.toString(),
      invoiceNumber: i.invoiceNumber,
      periodStart: i.periodStart.toISOString(),
      periodEnd: i.periodEnd.toISOString(),
      totalOrders: i.totalOrders,
      cashOrders: i.cashOrders,
      digitalOrders: i.digitalOrders,
      totalCollected: i.totalCollected,
      commissionDue: i.commissionDue ?? 0,
      riderCostDue: i.riderCostDue ?? 0,
      amountDue: i.amountDue ?? 0,
      commissionRate: i.commissionRate ?? 0.20,
      status: i.status,
      dueDate: i.dueDate?.toISOString(),
      paidAt: i.paidAt?.toISOString(),
      paidBy: i.paidBy?.toString(),
      paymentReference: i.paymentReference,
      adminNote: i.adminNote,
      creditTotal: i.creditTotal ?? 0,
      creditOrderCount: i.creditOrderCount ?? 0,
      creditRecovered: i.creditRecovered ?? 0,
      creditApplied: i.creditApplied ?? 0,
      pdfGeneratedAt: i.pdfGeneratedAt?.toISOString(),
      emailedAt: i.emailedAt?.toISOString(),
      emailError: i.emailError,
      createdAt: i.createdAt.toISOString(),
    };
  }

  private async summarizeIncomingBatch(
    orders: OrderDocument[],
    options?: {
      allowStaffRequestDelivery?: boolean;
      viewerRole?: UserRole;
    },
  ) {
    const paymentsByOrderId = await loadLatestOrderPaymentsByOrderId(
      this.paymentModel,
      orders.map((o) => o._id),
    );
    const staffIds = [
      ...new Set(
        orders
          .map((o) => o.laundryProcessing?.assignedStaffId?.toString())
          .filter((id): id is string => !!id),
      ),
    ];
    const staffEmailById = staffIds.length
      ? new Map(
          (await this.userModel.find({ _id: { $in: staffIds } }).select('email'))
            .map((s) => [s._id.toString(), s.email] as const),
        )
      : undefined;
    return Promise.all(
      orders.map((o) => this.summarizeIncoming(o, options, paymentsByOrderId, staffEmailById)),
    );
  }

  private async summarizeIncoming(
    order: OrderDocument,
    options?: {
      allowStaffRequestDelivery?: boolean;
      viewerRole?: UserRole;
    },
    paymentsByOrderId?: Map<string, PaymentDocument>,
    staffEmailById?: Map<string, string | undefined>,
  ) {
    const storedStep = normalizeProcessingStepId(order.laundryProcessing?.currentStepId);
    const initialStep = getInitialProcessingStepForOrder(order.status);
    const currentStepId = storedStep ?? initialStep ?? null;
    const step = currentStepId
      ? getProcessingStep(currentStepId)
      : null;
    const currentStepLabel = step?.label
      ?? (isPartnerLaundryProcessingStatus(order.status)
        ? order.status.replace(/_/g, ' ')
        : formatPartnerPreProcessingLabel(order.status));
    let assignedStaffEmail: string | undefined;
    if (order.laundryProcessing?.assignedStaffId) {
      const staffId = order.laundryProcessing.assignedStaffId.toString();
      if (staffEmailById) {
        assignedStaffEmail = staffEmailById.get(staffId);
      } else {
        const staff = await this.userModel.findById(staffId).select('email');
        assignedStaffEmail = staff?.email;
      }
    }

    const sla = computePickupSla({
      status: order.status,
      scheduledPickupAt: order.slaPickupDueAt ?? order.scheduledPickupAt,
      dispatchStatus: order.dispatchStatus,
      partnerAcceptedAt: order.partnerAcceptedAt,
      pickupRiderId: order.pickupRiderId?.toString(),
      pickupCollectedAt: order.pickup?.collectedAt,
    });

    const paymentMap =
      paymentsByOrderId ??
      (await loadLatestOrderPaymentsByOrderId(this.paymentModel, [order._id]));
    const paymentSummary = buildOrderPaymentSummary(paymentMap.get(order._id.toString()));
    const paymentLabel = buildPartnerPaymentLabel(paymentSummary);

    return {
      _id: order._id.toString(),
      status: order.status,
      bookingType: order.bookingType,
      total: order.total,
      estimatedWeightKg: order.estimatedWeightKg,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      currentStepLabel,
      assignedStaffId: order.laundryProcessing?.assignedStaffId?.toString(),
      assignedStaffEmail,
      progress: order.laundryProcessing?.completedSteps?.length ?? 0,
      branchId: order.branchId?.toString(),
      branchCode: order.branchCode,
      branchName: order.branchName,
      partnerAcceptedAt: order.partnerAcceptedAt,
      pickupRequestedAt: order.pickupRequestedAt,
      deliveryRequestedAt: order.deliveryRequestedAt,
      pickupRiderId: order.pickupRiderId?.toString(),
      slaStatus: sla.status,
      slaLabel: sla.label,
      canAccept: !order.partnerAcceptedAt && order.dispatchStatus === 'dispatched',
      canRequestPickup:
        !!order.partnerAcceptedAt &&
        !order.pickupRiderId &&
        (order.status === OrderStatus.SHOP_ASSIGNED || order.status === OrderStatus.CONFIRMED),
      canRequestDelivery:
        order.status === OrderStatus.READY_FOR_DELIVERY &&
        !order.deliveryRiderId &&
        (options?.viewerRole !== UserRole.STAFF ||
          (options?.allowStaffRequestDelivery ?? true)),
      canReceiveAtShop:
        order.status === OrderStatus.IN_TRANSIT_TO_SHOP &&
        !!order.partnerAcceptedAt &&
        !order.shopReceiving?.itemsConfirmedAt,
      receivingStepLabel:
        order.status === OrderStatus.IN_TRANSIT_TO_SHOP && !order.shopReceiving?.receivedAt
          ? 'Awaiting receive'
          : order.status === OrderStatus.IN_TRANSIT_TO_SHOP
            ? 'Shop receiving in progress'
            : order.status === OrderStatus.RECEIVED_AT_SHOP
              ? 'Received at shop — start processing'
              : undefined,
      ...paymentSummary,
      paymentLabel,
      subscriptionId: order.subscriptionId?.toString(),
    };
  }
}
