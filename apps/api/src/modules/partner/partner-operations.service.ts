import {
  BadRequestException,
  ConflictException,
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
  LAUNDRY_PROCESSING_STEPS,
  LAUNDRY_PROCESSING_STATUSES,
  normalizeProcessingStepId,
} from '@lunara/utils';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { RiderAssignmentService } from '../riders/rider-assignment.service';
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
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { applyStaffBranchFilter, resolvePortalBranchId } from './partner-access';
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
  { sku: 'DET-001', name: 'Liquid detergent', category: 'detergent', quantity: 48, unit: 'L', lowStockThreshold: 10 },
  { sku: 'DET-002', name: 'Fabric softener', category: 'detergent', quantity: 32, unit: 'L', lowStockThreshold: 8 },
  { sku: 'BAG-001', name: 'Customer laundry bags', category: 'supplies', quantity: 200, unit: 'pcs', lowStockThreshold: 50 },
  { sku: 'TAG-001', name: 'Order tag rolls', category: 'supplies', quantity: 15, unit: 'rolls', lowStockThreshold: 3 },
  { sku: 'HGR-001', name: 'Hangers', category: 'supplies', quantity: 120, unit: 'pcs', lowStockThreshold: 30 },
  { sku: 'FIL-001', name: 'Lint filters', category: 'maintenance', quantity: 24, unit: 'pcs', lowStockThreshold: 6 },
];

@Injectable()
export class PartnerOperationsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    @InjectModel(ShopInventoryItem.name) private inventoryModel: Model<ShopInventoryDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(PartnerSettlement.name) private settlementModel: Model<PartnerSettlementDocument>,
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
   */
  private computeOrderFee(
    order: {
      subtotal?: number;
      total: number;
      baseSubtotal?: number;
      pricingModel?: string;
      branchId?: Types.ObjectId;
    },
    commissionRateByBranchId: Map<string, number>,
    fallbackRate = 0.20,
  ): number {
    if (order.pricingModel === 'shop_markup' && order.baseSubtotal != null) {
      return (order.subtotal ?? order.total) - order.baseSubtotal;
    }
    const rate = commissionRateByBranchId.get(order.branchId?.toString() ?? '') ?? fallbackRate;
    return Math.round((order.subtotal ?? order.total) * rate);
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

  async ensureInventorySeeded() {
    const count = await this.inventoryModel.countDocuments();
    if (count === 0) {
      await this.inventoryModel.insertMany(DEFAULT_INVENTORY);
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
    await this.ensureInventorySeeded();

    const { filter: scopeFilter, shop } = await this.dashboardScopeFilter(userId, role);
    const revenueFilter = await this.revenueOrderFilter(userId, role);

    const incomingBase = {
      status: { $in: DASHBOARD_INCOMING_STATUSES },
      dispatchStatus: 'dispatched',
      ...scopeFilter,
    };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const weekStart = new Date(startOfDay);
    weekStart.setDate(weekStart.getDate() - 6);

    let staffBranchIds: Types.ObjectId[] | undefined;
    let partnerBranches: BranchDocument[] = [];
    if (role !== UserRole.ADMIN) {
      partnerBranches = await this.resolvePartnerBranches(userId, role);
      staffBranchIds = partnerBranches.map((b) => b._id);
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
      }),
      this.orderModel.find(incomingBase).sort({ updatedAt: -1 }).limit(8),
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
        revenue: {
          today: todayBreakdown.gross,
          week: weekBreakdown.gross,
          todayOrders: completedToday.length,
          weekOrders: weekOrders.length,
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
    if (role === UserRole.PARTNER && order.partnerId?.toString() !== partnerUserId) {
      throw new BadRequestException('This order is assigned to another partner');
    }
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

    if (role === UserRole.PARTNER && order.partnerId?.toString() !== partnerUserId) {
      throw new BadRequestException('Not your order');
    }
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

  async getOrderHistory(userId: string, role: UserRole, status?: string) {
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
    const orders = await this.orderModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    const paymentsByOrderId = await loadLatestOrderPaymentsByOrderId(
      this.paymentModel,
      orders.map((o) => o._id),
    );
    return {
      success: true,
      data: orders.map((o) => {
        const payment = paymentsByOrderId.get(o._id.toString());
        return {
          _id: o._id,
          status: o.status,
          totalAmount: o.total,
          paymentMethod: payment?.method ?? null,
          createdAt: o.createdAt,
          completedAt: o.updatedAt,
        };
      }),
    };
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

  private async staffActiveJobCounts(branchId?: Types.ObjectId) {
    const match: Record<string, unknown> = {
      'laundryProcessing.assignedStaffId': { $exists: true, $ne: null },
      status: { $nin: [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
    };
    if (branchId) match.branchId = branchId;

    const activeJobs = await this.orderModel.aggregate([
      { $match: match },
      { $group: { _id: '$laundryProcessing.assignedStaffId', count: { $sum: 1 } } },
    ]);
    return new Map(activeJobs.map((j) => [j._id.toString(), j.count as number]));
  }

  private formatStaffMember(
    user: Pick<UserDocument, '_id' | 'email' | 'phone' | 'createdAt'>,
    jobMap: Map<string, number>,
  ) {
    return {
      _id: user._id.toString(),
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt?.toISOString(),
      activeJobs: jobMap.get(user._id.toString()) ?? 0,
    };
  }

  async listStaff(userId: string, role: UserRole) {
    const branchId = await this.resolvePartnerBranchId(userId, role);
    const staff = await this.userModel
      .find({ role: UserRole.STAFF, isActive: true, branchId })
      .select('email phone createdAt')
      .sort({ email: 1 });

    const jobMap = await this.staffActiveJobCounts(branchId);

    return {
      success: true,
      data: staff.map((s) => this.formatStaffMember(s, jobMap)),
    };
  }

  async createStaff(userId: string, role: UserRole, dto: CreateStaffDto) {
    const branchId = await this.resolvePartnerBranchId(userId, role);
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
    });

    return {
      success: true,
      data: this.formatStaffMember(user, new Map()),
    };
  }

  async assignStaff(orderId: string, staffId: string, partnerUserId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

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

  private formatInventoryItem(item: ShopInventoryDocument) {
    return {
      _id: item._id.toString(),
      sku: item.sku,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      lowStockThreshold: item.lowStockThreshold,
      isLowStock: item.quantity <= item.lowStockThreshold,
    };
  }

  async getInventory() {
    await this.ensureInventorySeeded();
    const items = await this.inventoryModel.find().sort({ category: 1, name: 1 });
    return { success: true, data: items.map((i) => this.formatInventoryItem(i)) };
  }

  async updateInventory(itemId: string, dto: UpdateInventoryDto) {
    const item = await this.inventoryModel.findById(itemId);
    if (!item) throw new NotFoundException('Inventory item not found');
    if (dto.quantity != null) item.quantity = dto.quantity;
    if (dto.lowStockThreshold != null) item.lowStockThreshold = dto.lowStockThreshold;
    await item.save();
    return { success: true, data: this.formatInventoryItem(item) };
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
        processingStepsCompleted: LAUNDRY_PROCESSING_STEPS.length,
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

    const [today, week, month, recentCompleted, allTimeSummary] = await Promise.all([
      this.orderModel.find({ ...baseFilter, updatedAt: { $gte: startOfDay } }),
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
                  { $eq: ['$pricingModel', 'shop_markup'] },
                  0,
                  { $ifNull: ['$subtotal', '$total'] },
                ],
              },
            },
            // shop_markup orders already have Lunara's cut baked in as subtotal - baseSubtotal.
            shopMarkupFeeSum: {
              $sum: {
                $cond: [
                  { $eq: ['$pricingModel', 'shop_markup'] },
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
    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfDay);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayOrders = await this.orderModel.find({
        ...baseFilter,
        updatedAt: { $gte: d, $lt: next },
      });
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

  async createSettlement(
    adminUserId: string,
    partnerId: string,
    dto: { orderIds: string[]; adminNote?: string },
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

    const completedOrders = await this.orderModel.find({
      _id: { $in: dto.orderIds.map((id) => new Types.ObjectId(id)) },
      branchId: { $in: branches.map((b) => b._id) },
      status: { $in: COMPLETED_STATUSES },
      settlementId: { $exists: false },
    });

    if (completedOrders.length === 0) {
      throw new BadRequestException('No valid unsettled orders found for the selected IDs');
    }

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
    const partnerPayout = totalAmount - lunaraFee;

    // Stored commissionRate becomes a display-only weighted average across the legacy-priced
    // orders in this settlement (shop_markup orders don't have a "rate" at all) — once a
    // settlement can span branches with different rates, this field is no longer the single
    // source of truth for the fee; lunaraFee (computed per-order above) always is.
    const legacyOrders = completedOrders.filter((o) => o.pricingModel !== 'shop_markup');
    const legacySubtotalSum = legacyOrders.reduce((s, o) => s + (o.subtotal ?? o.total), 0);
    const weightedCommissionRate =
      legacySubtotalSum > 0
        ? legacyOrders.reduce((s, o) => {
            const rate = commissionRateByBranchId.get(o.branchId?.toString() ?? '') ?? 0.2;
            return s + rate * (o.subtotal ?? o.total);
          }, 0) / legacySubtotalSum
        : 0.2;

    const settlement = await this.settlementModel.create({
      partnerId: new Types.ObjectId(partnerId),
      periodStart: start,
      periodEnd: end,
      totalOrders: completedOrders.length,
      cashOrders,
      digitalOrders,
      totalAmount,
      lunaraFee,
      partnerPayout,
      commissionRate: weightedCommissionRate,
      status: 'paid',
      paidAt: new Date(),
      paidBy: new Types.ObjectId(adminUserId),
      adminNote: dto.adminNote,
    });

    await this.orderModel.updateMany(
      { _id: { $in: completedOrders.map((o) => o._id) } },
      { $set: { settlementId: settlement._id } },
    );

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
          description: `Cash paid out to partner ${partnerId}`,
        },
        {
          accountType: 'platform_revenue',
          direction: 'credit',
          amount: lunaraFee,
          description: `Commission earned on partner ${partnerId} settlement`,
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
    return Promise.all(
      orders.map((o) => this.summarizeIncoming(o, options, paymentsByOrderId)),
    );
  }

  private async summarizeIncoming(
    order: OrderDocument,
    options?: {
      allowStaffRequestDelivery?: boolean;
      viewerRole?: UserRole;
    },
    paymentsByOrderId?: Map<string, PaymentDocument>,
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
      const staff = await this.userModel
        .findById(order.laundryProcessing.assignedStaffId)
        .select('email');
      assignedStaffEmail = staff?.email;
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
    };
  }
}
