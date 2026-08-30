import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
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
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfileDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    private trackingGateway: TrackingGateway,
    private riderAssignmentService: RiderAssignmentService,
    private partnerOrderNotifications: PartnerOrderNotificationService,
    private ledgerService: LedgerService,
  ) {}

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
    if (dto.quantity != null) item.quantity = dto.quantity;
    if (dto.lowStockThreshold != null) item.lowStockThreshold = dto.lowStockThreshold;
    if (dto.usagePerOrder != null) item.usagePerOrder = dto.usagePerOrder;
    if (dto.usagePerKg != null) item.usagePerKg = dto.usagePerKg;
    await item.save();
    return { success: true, data: this.formatInventoryItem(item) };
  }

  /** Auto-deducts consumable stock (detergent/bags/etc.) for one completed order — called once
   * from ShopReceivingService.confirmItems, which already guards against being run twice for the
   * same order. Items with usagePerOrder/usagePerKg both 0 (the default) are left untouched. */
  async deductInventoryForOrder(branchId: Types.ObjectId, verifiedWeightKg: number) {
    const items = await this.inventoryModel.find({
      branchId,
      $or: [{ usagePerOrder: { $gt: 0 } }, { usagePerKg: { $gt: 0 } }],
    });
    await Promise.all(
      items.map((item) => {
        const used = item.usagePerOrder + item.usagePerKg * verifiedWeightKg;
        item.quantity = Math.max(0, item.quantity - used);
        return item.save();
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

  async getSettlements(userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) {
      const settlements = await this.settlementModel
        .find()
        .sort({ createdAt: -1 })
        .limit(100);
      return { success: true, data: settlements.map((s) => this.formatSettlement(s)) };
    }
    const settlements = await this.settlementModel
      .find({ partnerId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 });
    return { success: true, data: settlements.map((s) => this.formatSettlement(s)) };
  }

  async getPartnerSettlementsForAdmin(partnerId: string) {
    const settlements = await this.settlementModel
      .find({ partnerId: new Types.ObjectId(partnerId) })
      .sort({ createdAt: -1 });
    return { success: true, data: settlements.map((s) => this.formatSettlement(s)) };
  }

  /** Net amount Lunara still owes this partner — sum of pending settlement payouts. */
  async getLedgerBalance(partnerId: string) {
    const pendingSettlements = await this.settlementModel.find({
      partnerId: new Types.ObjectId(partnerId),
      status: 'pending',
    });
    const payableBalance = pendingSettlements.reduce((sum, s) => sum + (s.partnerPayout ?? s.totalAmount), 0);
    return { success: true, data: { partnerId, payableBalance } };
  }

  async getUnsettledOrders(partnerId: string) {
    const branches = await this.branchModel.find({
      partnerUserId: new Types.ObjectId(partnerId),
    });
    if (branches.length === 0) throw new NotFoundException('Partner branch not found');
    const commissionRateByBranchId = this.commissionRateMap(branches);

    const orders = await this.orderModel
      .find({
        branchId: { $in: branches.map((b) => b._id) },
        status: { $in: COMPLETED_STATUSES },
        settlementId: { $exists: false },
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
      };
    });

    return { success: true, data };
  }

  async getSettlementOrders(userId: string, role: UserRole, settlementId: string) {
    const settlement = await this.settlementModel.findById(settlementId);
    if (!settlement) throw new NotFoundException('Settlement not found');

    // For partners, scope to their own settlement only
    if (role !== UserRole.ADMIN) {
      if (settlement.partnerId.toString() !== userId) {
        throw new NotFoundException('Settlement not found');
      }
    }

    const branches = await this.branchModel.find({
      partnerUserId: new Types.ObjectId(settlement.partnerId),
    });
    if (branches.length === 0) throw new NotFoundException('Partner branch not found');

    const orders = await this.orderModel
      .find({ settlementId: settlement._id })
      .sort({ updatedAt: -1 });

    const paymentsByOrderId = await loadLatestOrderPaymentsByOrderId(
      this.paymentModel,
      orders.map((o) => o._id),
    );

    // Use the commission rate snapshot from the settlement (a weighted average across whichever
    // branches contributed orders) for legacy orders, for exact historical reconciliation.
    // shop_markup orders ignore this and use their own baseSubtotal regardless (see computeOrderFee).
    const commissionRate = settlement.commissionRate ?? 0.20;
    const emptyBranchRateMap = new Map<string, number>();

    const data = orders.map((o) => {
      const payment = paymentsByOrderId.get(o._id.toString());
      const isCash = payment?.method === PaymentMethod.CASH;
      const cashCollected = isCash && payment?.status === PaymentStatus.PAID;
      const subtotal = o.subtotal ?? o.total;
      const lunaraFee = this.computeOrderFee(o, emptyBranchRateMap, commissionRate);
      const partnerPayout = o.total - lunaraFee;
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

    return { success: true, data };
  }

  /** Sum of clawbackTotal − clawbackRecovered across every settlement for this partner — how much
   * is still outstanding from post-settlement refunds that were never actually recovered from a
   * later payout. Surfaced to admin before creating a new settlement so they can choose to net it. */
  async getOutstandingClawbackBalance(partnerId: string) {
    const [result] = await this.settlementModel.aggregate<{ outstanding: number }>([
      { $match: { partnerId: new Types.ObjectId(partnerId) } },
      {
        $group: {
          _id: null,
          outstanding: { $sum: { $subtract: ['$clawbackTotal', '$clawbackRecovered'] } },
        },
      },
    ]);
    return { success: true, data: { outstanding: Math.max(0, result?.outstanding ?? 0) } };
  }

  async createSettlement(
    adminUserId: string,
    partnerId: string,
    dto: { orderIds: string[]; adminNote?: string; recoverClawback?: boolean },
  ) {
    if (!dto.orderIds || dto.orderIds.length === 0) {
      throw new BadRequestException('At least one order must be selected');
    }

    // Find all of the partner's branches — a partner account can own several shops, and orders
    // selected for this settlement may span any of them.
    const branches = await this.branchModel.find({
      partnerUserId: new Types.ObjectId(partnerId),
    });
    if (branches.length === 0) throw new NotFoundException('Partner branch not found');
    const commissionRateByBranchId = this.commissionRateMap(branches);

    // Pre-generate the settlement id and use it to atomically *claim* the selected orders before
    // computing any totals. The updateMany's filter re-asserts settlementId is still unset, so two
    // concurrent createSettlement calls with overlapping order IDs can each only claim the orders
    // still unclaimed at the moment their write lands — MongoDB serializes per-document writes, so
    // the same order can never end up stamped into two settlements (the previous find-then-updateMany
    // form had no such guard and could double-pay the same orders).
    const settlementId = new Types.ObjectId();
    const claim = await this.orderModel.updateMany(
      {
        _id: { $in: dto.orderIds.map((id) => new Types.ObjectId(id)) },
        branchId: { $in: branches.map((b) => b._id) },
        status: { $in: COMPLETED_STATUSES },
        settlementId: { $exists: false },
      },
      { $set: { settlementId } },
    );

    if (claim.modifiedCount === 0) {
      throw new BadRequestException('No valid unsettled orders found for the selected IDs');
    }

    const completedOrders = await this.orderModel.find({ settlementId });

    // Derive period from the selected orders' completion timestamps
    const timestamps = completedOrders.map((o) => o.updatedAt?.getTime() ?? o.createdAt?.getTime() ?? Date.now());
    const start = new Date(Math.min(...timestamps));
    const end = new Date(Math.max(...timestamps));

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

    const totalAmount = completedOrders.reduce((s, o) => s + o.total, 0);
    // shop_markup orders already have Lunara's cut baked into the price the customer paid;
    // legacy orders take their own branch's commissionRate off the laundry subtotal (not the
    // delivery fee) — branches under the same partner can carry different rates, so this must
    // be computed per order rather than with one flat number.
    const lunaraFee = Math.round(
      completedOrders.reduce((s, o) => s + this.computeOrderFee(o, commissionRateByBranchId), 0),
    );

    // totalAmount includes the full customer-paid deliveryFee, which — with lunaraFee computed
    // on subtotal only — would otherwise flow entirely into partnerPayout, while Lunara pays
    // riders separately out of platform_cash with nothing connecting the two. The partner already
    // received the delivery fee revenue inside totalAmount, so their payout funds the delivery:
    // actual rider cost for these orders (read from the ledger, not estimated — correctly ₱0 for
    // orders an employee rider handled) is deducted here and credited to platform_revenue instead.
    const riderCostByOrderId = await this.ledgerService.getRiderCostByOrderId(
      completedOrders.map((o) => o._id.toString()),
    );
    const riderCostForPeriod = completedOrders.reduce(
      (s, o) => s + (riderCostByOrderId.get(o._id.toString()) ?? 0),
      0,
    );
    const riderCostRecovered = Math.max(0, Math.min(riderCostForPeriod, totalAmount - lunaraFee));

    // Opt-in: net this partner's outstanding balance from earlier post-settlement clawbacks
    // (refunds on orders already paid out) against this new payout, and mark it recovered on
    // the settlements it came from so it isn't counted as outstanding twice.
    let clawbackRecoveryApplied = 0;
    const clawbackSourceSettlements: { id: Types.ObjectId; apply: number }[] = [];
    if (dto.recoverClawback) {
      const outstandingSettlements = await this.settlementModel
        .find({
          partnerId: new Types.ObjectId(partnerId),
          $expr: { $gt: ['$clawbackTotal', '$clawbackRecovered'] },
        })
        .sort({ createdAt: 1 });
      let remainingCapacity = totalAmount - lunaraFee - riderCostRecovered;
      for (const s of outstandingSettlements) {
        if (remainingCapacity <= 0) break;
        const outstanding = s.clawbackTotal - s.clawbackRecovered;
        const apply = Math.min(outstanding, remainingCapacity);
        if (apply <= 0) continue;
        clawbackSourceSettlements.push({ id: s._id, apply });
        clawbackRecoveryApplied += apply;
        remainingCapacity -= apply;
      }
    }

    const partnerPayout =
      totalAmount - lunaraFee - riderCostRecovered - clawbackRecoveryApplied;

    // Stored commissionRate becomes a display-only weighted average across the legacy-priced
    // orders in this settlement (shop_markup/commission orders don't have a "rate" at all, their
    // fee is baked into baseSubtotal) — once a settlement can span branches with different rates,
    // this field is no longer the single source of truth for the fee; lunaraFee (computed per-order
    // above) always is.
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

    let settlement;
    try {
      settlement = await this.settlementModel.create({
        _id: settlementId,
        partnerId: new Types.ObjectId(partnerId),
        periodStart: start,
        periodEnd: end,
        totalOrders: completedOrders.length,
        cashOrders,
        digitalOrders,
        totalAmount,
        lunaraFee,
        partnerPayout,
        riderCostRecovered,
        clawbackRecoveryApplied,
        commissionRate: weightedCommissionRate,
        status: 'paid',
        paidAt: new Date(),
        paidBy: new Types.ObjectId(adminUserId),
        adminNote: dto.adminNote,
      });
    } catch (err) {
      // Release the claimed orders so they aren't stuck referencing a settlement that was never
      // actually created.
      await this.orderModel.updateMany(
        { settlementId },
        { $unset: { settlementId: 1 } },
      );
      throw err;
    }

    // Mark the recovered clawback as no longer outstanding on the settlements it came from —
    // after createSettlement's own document write succeeds, so a failure above never marks a
    // clawback recovered without an actual settlement to show for it.
    for (const src of clawbackSourceSettlements) {
      await this.settlementModel.updateOne(
        { _id: src.id },
        { $inc: { clawbackRecovered: src.apply } },
      );
    }

    // platform_revenue is credited lunaraFee + riderCostRecovered, not lunaraFee alone — the
    // recovered rider cost is real margin Lunara keeps instead of funding out of platform_cash
    // with nothing to show for it (see comment above). clawbackRecoveryApplied needs no separate
    // credit: it was already expensed via refund_expense at clawback time (recordSettlementClawback),
    // so simply crediting a smaller cash_out here is what actually recovers it — the debit posted
    // there and the smaller credit posted here net to zero on the cash_out account over time.
    await this.ledgerService.post(
      `settlement:${settlement._id.toString()}`,
      'settlement',
      settlement._id.toString(),
      [
        {
          accountType: 'order_revenue_clearing',
          direction: 'debit',
          amount: totalAmount,
          description: `Orders settled for partner ${partnerId} (${start.toISOString().slice(0, 10)}..${end.toISOString().slice(0, 10)})`,
        },
        {
          accountType: 'cash_out',
          direction: 'credit',
          amount: partnerPayout,
          description: `Cash paid out to partner ${partnerId}${clawbackRecoveryApplied > 0 ? ` (net of ₱${clawbackRecoveryApplied} recovered clawback)` : ''}`,
        },
        {
          accountType: 'platform_revenue',
          direction: 'credit',
          amount: lunaraFee + riderCostRecovered,
          description: `Commission earned on partner ${partnerId} settlement (rate ${(weightedCommissionRate * 100).toFixed(1)}%)${riderCostRecovered > 0 ? ` + ₱${riderCostRecovered} rider delivery cost recovered from partner payout` : ''}`,
        },
      ],
    );

    return { success: true, data: this.formatSettlement(settlement) };
  }

  private formatSettlement(s: PartnerSettlementDocument) {
    return {
      _id: s._id.toString(),
      partnerId: s.partnerId.toString(),
      periodStart: s.periodStart.toISOString(),
      periodEnd: s.periodEnd.toISOString(),
      totalOrders: s.totalOrders,
      cashOrders: s.cashOrders,
      digitalOrders: s.digitalOrders,
      totalAmount: s.totalAmount,
      lunaraFee: s.lunaraFee ?? 0,
      partnerPayout: s.partnerPayout ?? s.totalAmount,
      commissionRate: s.commissionRate ?? 0.20,
      status: s.status,
      paidAt: s.paidAt?.toISOString(),
      paidBy: s.paidBy?.toString(),
      adminNote: s.adminNote,
      clawbackTotal: s.clawbackTotal ?? 0,
      clawbackOrderCount: s.clawbackOrderCount ?? 0,
      clawbackRecovered: s.clawbackRecovered ?? 0,
      clawbackRecoveryApplied: s.clawbackRecoveryApplied ?? 0,
      riderCostRecovered: s.riderCostRecovered ?? 0,
      createdAt: s.createdAt.toISOString(),
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
