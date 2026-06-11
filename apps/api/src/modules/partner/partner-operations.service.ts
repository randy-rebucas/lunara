import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { OrderStatus, UserRole } from '@lunara/types';
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
    private trackingGateway: TrackingGateway,
    private riderAssignmentService: RiderAssignmentService,
    private partnerOrderNotifications: PartnerOrderNotificationService,
  ) {}

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
      const branchId = await this.resolvePartnerBranchId(userId, role);
      filter.branchId = branchId;
      filter.partnerId = new Types.ObjectId(userId);
      const branch = await this.branchModel.findById(branchId).select('name code');
      return {
        filter,
        shop: branch ? { name: branch.name, code: branch.code } : undefined,
      };
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

    let staffBranchId: Types.ObjectId | undefined;
    if (role !== UserRole.ADMIN) {
      staffBranchId = await this.resolvePartnerBranchId(userId, role);
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
      staffBranchId
        ? this.userModel.countDocuments({ role: UserRole.STAFF, isActive: true, branchId: staffBranchId })
        : this.userModel.countDocuments({ role: UserRole.STAFF, isActive: true }),
      this.inventoryModel.countDocuments({
        $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
      }),
      this.orderModel.find(incomingBase).sort({ updatedAt: -1 }).limit(8),
    ]);

    const todayRevenue = completedToday.reduce((sum, o) => sum + o.total, 0);
    const weekRevenue = weekOrders.reduce((sum, o) => sum + o.total, 0);

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
          today: todayRevenue,
          week: weekRevenue,
          todayOrders: completedToday.length,
          weekOrders: weekOrders.length,
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
      const branchId = await this.resolvePartnerBranchId(userId, role);
      filter.branchId = branchId;
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

    const [today, week, month, allCompleted] = await Promise.all([
      this.orderModel.find({ ...baseFilter, updatedAt: { $gte: startOfDay } }),
      this.orderModel.find({ ...baseFilter, updatedAt: { $gte: weekStart } }),
      this.orderModel.find({ ...baseFilter, updatedAt: { $gte: startOfMonth } }),
      this.orderModel.find(baseFilter),
    ]);

    const todayTotal = today.reduce((s, o) => s + o.total, 0);
    const weekTotal = week.reduce((s, o) => s + o.total, 0);
    const monthTotal = month.reduce((s, o) => s + o.total, 0);
    const allTimeRevenue = allCompleted.reduce((s, o) => s + o.total, 0);

    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfDay);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayOrders = await this.orderModel.find({
        ...baseFilter,
        updatedAt: { $gte: d, $lt: next },
      });
      last7.push({
        date: d.toISOString().slice(0, 10),
        revenue: dayOrders.reduce((s, o) => s + o.total, 0),
        orders: dayOrders.length,
      });
    }

    return {
      success: true,
      data: {
        today: todayTotal,
        week: weekTotal,
        month: monthTotal,
        todayOrders: today.length,
        weekOrders: week.length,
        monthOrders: month.length,
        avgOrderToday: today.length ? Math.round(todayTotal / today.length) : 0,
        avgOrderMonth: month.length ? Math.round(monthTotal / month.length) : 0,
        allTimeCompletedOrders: allCompleted.length,
        allTimeRevenue,
        daily: last7,
      },
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
