import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus, UserRole } from '@lunara/types';
import { computePickupSla, getProcessingStep, LAUNDRY_PROCESSING_STEPS } from '@lunara/utils';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { RiderAssignmentService } from '../riders/rider-assignment.service';
import { ShopInventoryDocument, ShopInventoryItem } from './schemas/shop-inventory.schema';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { applyStaffBranchFilter, resolvePortalBranchId } from './partner-access';

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
    @InjectModel(ShopInventoryItem.name) private inventoryModel: Model<ShopInventoryDocument>,
    private trackingGateway: TrackingGateway,
    private riderAssignmentService: RiderAssignmentService,
  ) {}

  async ensureInventorySeeded() {
    const count = await this.inventoryModel.countDocuments();
    if (count === 0) {
      await this.inventoryModel.insertMany(DEFAULT_INVENTORY);
    }
  }

  async getDashboard() {
    await this.ensureInventorySeeded();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [incoming, inProcessing, ready, completedToday, staffUsers, lowStock] =
      await Promise.all([
        this.orderModel.countDocuments({
          status: {
            $in: [
              OrderStatus.PICKED_UP,
              OrderStatus.CONFIRMED,
              OrderStatus.RIDER_ASSIGNED_PICKUP,
              OrderStatus.RIDER_ASSIGNED,
            ],
          },
          dispatchStatus: 'dispatched',
          branchId: { $exists: true, $ne: null },
        }),
        this.orderModel.countDocuments({
          status: {
            $in: [
              OrderStatus.RECEIVED,
              OrderStatus.WASHING,
              OrderStatus.DRYING,
              OrderStatus.FOLDING,
              OrderStatus.IRONING,
              OrderStatus.QUALITY_CHECK,
            ],
          },
        }),
        this.orderModel.countDocuments({ status: OrderStatus.READY_FOR_DELIVERY }),
        this.orderModel.find({
          status: { $in: COMPLETED_STATUSES },
          updatedAt: { $gte: startOfDay },
        }),
        this.userModel.find({ role: UserRole.STAFF, isActive: true }).select('email'),
        this.inventoryModel.countDocuments({
          $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
        }),
      ]);

    const todayRevenue = completedToday.reduce((sum, o) => sum + o.total, 0);
    const weekStart = new Date(startOfDay);
    weekStart.setDate(weekStart.getDate() - 7);
    const weekOrders = await this.orderModel.find({
      status: { $in: COMPLETED_STATUSES },
      updatedAt: { $gte: weekStart },
    });
    const weekRevenue = weekOrders.reduce((sum, o) => sum + o.total, 0);

    const recent = await this.orderModel
      .find({
        status: { $in: INCOMING_STATUSES },
        dispatchStatus: 'dispatched',
        branchId: { $exists: true, $ne: null },
      })
      .sort({ updatedAt: -1 })
      .limit(8);

    return {
      success: true,
      data: {
        counts: {
          incoming,
          inProcessing,
          readyForDelivery: ready,
          completedToday: completedToday.length,
          staffMembers: staffUsers.length,
          lowStockItems: lowStock,
        },
        revenue: {
          today: todayRevenue,
          week: weekRevenue,
          todayOrders: completedToday.length,
          weekOrders: weekOrders.length,
        },
        recentOrders: await Promise.all(recent.map((o) => this.summarizeIncoming(o))),
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
    if (role === UserRole.PARTNER && partnerUserId) {
      filter.partnerId = new Types.ObjectId(partnerUserId);
    }
    if (role === UserRole.STAFF && partnerUserId) {
      const branchId = await resolvePortalBranchId(this.userModel, partnerUserId, role);
      applyStaffBranchFilter(filter, role, branchId);
    }

    const items = await this.orderModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100);

    return {
      success: true,
      data: {
        items: await Promise.all(items.map((o) => this.summarizeIncoming(o))),
      },
    };
  }

  async listStaff() {
    const staff = await this.userModel
      .find({ role: UserRole.STAFF, isActive: true })
      .select('email phone createdAt')
      .sort({ email: 1 });

    const activeJobs = await this.orderModel.aggregate([
      {
        $match: {
          'laundryProcessing.assignedStaffId': { $exists: true, $ne: null },
          status: { $nin: [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
        },
      },
      { $group: { _id: '$laundryProcessing.assignedStaffId', count: { $sum: 1 } } },
    ]);

    const jobMap = new Map(activeJobs.map((j) => [j._id.toString(), j.count]));

    return {
      success: true,
      data: staff.map((s) => ({
        _id: s._id.toString(),
        email: s.email,
        phone: s.phone,
        activeJobs: jobMap.get(s._id.toString()) ?? 0,
      })),
    };
  }

  async assignStaff(orderId: string, staffId: string, partnerUserId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    if (!INCOMING_STATUSES.includes(order.status)) {
      throw new BadRequestException('Order is not available for staff assignment');
    }

    const staff = await this.userModel.findById(staffId);
    if (!staff || staff.role !== UserRole.STAFF) {
      throw new NotFoundException('Staff member not found');
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

  async getProgressMonitor() {
    const items = await this.orderModel
      .find({
        status: {
          $in: [
            OrderStatus.RECEIVED,
            OrderStatus.WASHING,
            OrderStatus.DRYING,
            OrderStatus.FOLDING,
            OrderStatus.IRONING,
            OrderStatus.QUALITY_CHECK,
            OrderStatus.READY_FOR_DELIVERY,
          ],
        },
      })
      .sort({ updatedAt: -1 });

    return {
      success: true,
      data: {
        items: await Promise.all(items.map((o) => this.summarizeIncoming(o))),
      },
    };
  }

  async getInventory() {
    await this.ensureInventorySeeded();
    const items = await this.inventoryModel.find().sort({ category: 1, name: 1 });
    return { success: true, data: items };
  }

  async updateInventory(itemId: string, dto: UpdateInventoryDto) {
    const item = await this.inventoryModel.findById(itemId);
    if (!item) throw new NotFoundException('Inventory item not found');
    if (dto.quantity != null) item.quantity = dto.quantity;
    if (dto.lowStockThreshold != null) item.lowStockThreshold = dto.lowStockThreshold;
    await item.save();
    return { success: true, data: item };
  }

  async getReports(days = 7) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const orders = await this.orderModel.find({ updatedAt: { $gte: from } });
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

  async getRevenue() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

    const [today, month, allCompleted] = await Promise.all([
      this.orderModel.find({
        status: { $in: COMPLETED_STATUSES },
        updatedAt: { $gte: startOfDay },
      }),
      this.orderModel.find({
        status: { $in: COMPLETED_STATUSES },
        updatedAt: { $gte: startOfMonth },
      }),
      this.orderModel.countDocuments({ status: { $in: COMPLETED_STATUSES } }),
    ]);

    const todayTotal = today.reduce((s, o) => s + o.total, 0);
    const monthTotal = month.reduce((s, o) => s + o.total, 0);

    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfDay);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayOrders = await this.orderModel.find({
        status: { $in: COMPLETED_STATUSES },
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
        month: monthTotal,
        todayOrders: today.length,
        monthOrders: month.length,
        allTimeCompletedOrders: allCompleted,
        daily: last7,
      },
    };
  }

  private async summarizeIncoming(order: OrderDocument) {
    const currentStepId =
      order.laundryProcessing?.currentStepId ??
      (order.status === OrderStatus.RECEIVED_AT_SHOP ? 'received' : 'sorting');
    const step = getProcessingStep(currentStepId as import('@lunara/utils').LaundryProcessingStepId);
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

    return {
      _id: order._id.toString(),
      status: order.status,
      bookingType: order.bookingType,
      total: order.total,
      estimatedWeightKg: order.estimatedWeightKg,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      currentStepLabel: step?.label ?? order.status.replace(/_/g, ' '),
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
      canRequestDelivery: order.status === OrderStatus.READY_FOR_DELIVERY && !order.deliveryRiderId,
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
    };
  }
}
