import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import { computeDeliverySla, computePickupSla } from '@lunara/utils';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { OrdersService } from '../orders/orders.service';
import { PickupService } from '../riders/pickup.service';
import { RiderAssignmentService } from '../riders/rider-assignment.service';
import { BranchesService } from '../branches/branches.service';
import { SupportService } from '../support/support.service';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import {
  buildOrderPaymentSummary,
  loadLatestOrderPaymentsByOrderId,
} from '../payments/payment-summary';

const COMPLETED_STATUSES = [OrderStatus.DELIVERED, OrderStatus.COMPLETED];
const CANCELLED_STATUSES = [OrderStatus.CANCELLED, OrderStatus.REFUNDED];
const SCHEDULED_STATUSES = [OrderStatus.PENDING, OrderStatus.PENDING_DISPATCH];
const OUT_FOR_DELIVERY_STATUSES = [
  OrderStatus.RIDER_ASSIGNED_DELIVERY,
  OrderStatus.OUT_FOR_DELIVERY,
];

/** Orders already on their delivery leg — the pickup SLA no longer applies to these. */
const DELIVERY_LEG_STATUSES = [
  OrderStatus.RIDER_ASSIGNED_DELIVERY,
  OrderStatus.OUT_FOR_DELIVERY,
];

function ctPctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

@Injectable()
export class AdminOperationsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    private ordersService: OrdersService,
    private pickupService: PickupService,
    private riderAssignmentService: RiderAssignmentService,
    private branchesService: BranchesService,
    private supportService: SupportService,
  ) {}

  async getControlTower() {
    const [
      pendingDispatch,
      awaitingPartnerAccept,
      awaitingPickupRider,
      awaitingDeliveryRider,
      slaBreaches,
      conflicts,
      openTickets,
    ] = await Promise.all([
      this.branchesService.countPendingDispatch(),
      this.orderModel.countDocuments({
        dispatchStatus: 'dispatched',
        partnerAcceptedAt: { $exists: false },
        status: { $nin: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
      }),
      this.orderModel.countDocuments({
        dispatchStatus: 'dispatched',
        partnerAcceptedAt: { $exists: true },
        pickupRiderId: { $exists: false },
        status: { $in: [OrderStatus.SHOP_ASSIGNED, OrderStatus.CONFIRMED] },
      }),
      this.orderModel.countDocuments({
        status: OrderStatus.READY_FOR_DELIVERY,
        deliveryRiderId: { $exists: false },
      }),
      this.countSlaBreaches(),
      this.orderModel.countDocuments({ operationsConflict: true }),
      this.supportService.countOpenTickets(),
    ]);

    const watchlist = await this.orderModel
      .find({
        $or: [
          { status: OrderStatus.PENDING_DISPATCH },
          { dispatchStatus: 'dispatched', partnerAcceptedAt: { $exists: false } },
          { operationsConflict: true },
          {
            status: OrderStatus.READY_FOR_DELIVERY,
            deliveryRiderId: { $exists: false },
          },
        ],
        status: { $nin: [OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.COMPLETED] },
      })
      .sort({ scheduledPickupAt: 1 })
      .limit(25);

    return {
      success: true,
      data: {
        counts: {
          pendingDispatch,
          awaitingPartnerAccept,
          awaitingPickupRider,
          awaitingDeliveryRider,
          slaBreaches,
          conflicts,
          openTickets,
        },
        pulse: await this.buildTodayPulse(),
        watchlist: await Promise.all(watchlist.map((o) => this.serializeOpsOrder(o))),
      },
    };
  }

  /** Today-vs-yesterday operational snapshot for the control tower dashboard. */
  private async buildTodayPulse() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfDay);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const activeNowStatuses = Object.values(OrderStatus).filter(
      (s) =>
        !COMPLETED_STATUSES.includes(s) &&
        !CANCELLED_STATUSES.includes(s) &&
        !SCHEDULED_STATUSES.includes(s),
    );

    const [
      createdWindow,
      completedWindow,
      inProgressNow,
      ridersOnline,
      totalRiders,
      totalBranches,
      pickupsToday,
      areasAgg,
    ] = await Promise.all([
      this.orderModel
        .find({ createdAt: { $gte: startOfYesterday } })
        .select('createdAt status bookingType')
        .lean(),
      this.orderModel
        .find({ status: { $in: COMPLETED_STATUSES }, updatedAt: { $gte: startOfYesterday } })
        .select('updatedAt total branchName')
        .lean(),
      this.orderModel.countDocuments({ status: { $in: activeNowStatuses } }),
      this.riderModel.countDocuments({ isOnline: true }),
      this.riderModel.countDocuments(),
      // "Shops" on the network, not raw branch rows — a partner's variant branches roll up
      // to their one isMainShop branch, so this stays 1 per active partner.
      this.branchModel.countDocuments({ isMainShop: true, isActive: true }),
      this.orderModel
        .find({ 'pickup.collectedAt': { $gte: startOfDay } })
        .select('pickup.collectedAt slaPickupDueAt')
        .lean(),
      this.orderModel.aggregate<{ _id: string; orders: number }>([
        { $match: { createdAt: { $gte: startOfDay } } },
        {
          $lookup: {
            from: 'branches',
            localField: 'branchId',
            foreignField: '_id',
            as: 'branch',
          },
        },
        {
          $group: {
            _id: { $ifNull: [{ $first: '$branch.city' }, 'Unassigned'] },
            orders: { $sum: 1 },
          },
        },
        { $sort: { orders: -1 } },
        { $limit: 6 },
      ]),
    ]);

    // Hourly created counts (today vs yesterday) + hourly completed revenue today
    const hourly = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      today: 0,
      yesterday: 0,
      revenueToday: 0,
    }));
    const todayCreated: { status: OrderStatus; bookingType: string }[] = [];
    let yesterdayCreatedCount = 0;
    for (const o of createdWindow) {
      const bucket = hourly[new Date(o.createdAt).getHours()];
      if (o.createdAt >= startOfDay) {
        bucket.today += 1;
        todayCreated.push({ status: o.status, bookingType: o.bookingType });
      } else {
        bucket.yesterday += 1;
        yesterdayCreatedCount += 1;
      }
    }

    let revenueToday = 0;
    let completedToday = 0;
    let revenueYesterday = 0;
    let completedYesterday = 0;
    const shopAgg = new Map<string, { orders: number; revenue: number }>();
    for (const o of completedWindow) {
      if (o.updatedAt >= startOfDay) {
        completedToday += 1;
        revenueToday += o.total;
        hourly[new Date(o.updatedAt).getHours()].revenueToday += o.total;
        const key = o.branchName ?? 'Unassigned';
        const shop = shopAgg.get(key) ?? { orders: 0, revenue: 0 };
        shop.orders += 1;
        shop.revenue += o.total;
        shopAgg.set(key, shop);
      } else {
        completedYesterday += 1;
        revenueYesterday += o.total;
      }
    }

    // Today's created orders bucketed into coarse pipeline states
    const statusBreakdownToday = [
      { key: 'scheduled', label: 'Scheduled', count: 0 },
      { key: 'in_progress', label: 'In progress', count: 0 },
      { key: 'out_for_delivery', label: 'Out for delivery', count: 0 },
      { key: 'completed', label: 'Completed', count: 0 },
      { key: 'cancelled', label: 'Cancelled', count: 0 },
    ];
    const serviceAgg = new Map<string, number>();
    for (const o of todayCreated) {
      const bucket = COMPLETED_STATUSES.includes(o.status)
        ? 'completed'
        : CANCELLED_STATUSES.includes(o.status)
          ? 'cancelled'
          : SCHEDULED_STATUSES.includes(o.status)
            ? 'scheduled'
            : OUT_FOR_DELIVERY_STATUSES.includes(o.status)
              ? 'out_for_delivery'
              : 'in_progress';
      statusBreakdownToday.find((b) => b.key === bucket)!.count += 1;
      serviceAgg.set(o.bookingType, (serviceAgg.get(o.bookingType) ?? 0) + 1);
    }

    // Pickup punctuality: collected today, measured against the pickup SLA when one was set
    let onTime = 0;
    let late = 0;
    let lateMinutes = 0;
    for (const o of pickupsToday) {
      const collectedAt = o.pickup?.collectedAt;
      if (!collectedAt || !o.slaPickupDueAt) continue;
      const delayMs = new Date(collectedAt).getTime() - new Date(o.slaPickupDueAt).getTime();
      if (delayMs <= 0) {
        onTime += 1;
      } else {
        late += 1;
        lateMinutes += delayMs / 60_000;
      }
    }
    const measuredPickups = onTime + late;

    return {
      today: {
        orders: todayCreated.length,
        ordersDelta: ctPctDelta(todayCreated.length, yesterdayCreatedCount),
        completed: completedToday,
        completedDelta: ctPctDelta(completedToday, completedYesterday),
        revenue: revenueToday,
        revenueDelta: ctPctDelta(revenueToday, revenueYesterday),
        avgOrderValue: completedToday > 0 ? Math.round(revenueToday / completedToday) : 0,
        inProgressNow,
      },
      ridersOnline,
      totalRiders,
      totalBranches,
      hourly,
      statusBreakdownToday,
      topShopsToday: [...shopAgg.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
      topServicesToday: [...serviceAgg.entries()]
        .map(([service, count]) => ({ service, count }))
        .sort((a, b) => b.count - a.count),
      areasToday: areasAgg.map((a) => ({ area: a._id, orders: a.orders })),
      pickupPerformance: {
        measured: measuredPickups,
        onTime,
        late,
        onTimeRate: measuredPickups > 0 ? Math.round((onTime / measuredPickups) * 100) : null,
        avgDelayMin: late > 0 ? Math.round(lateMinutes / late) : 0,
      },
    };
  }

  async getOrderOperations(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const customer = await this.userModel.findById(order.customerId).select('email phone');
    let pickupSuggestions: Awaited<
      ReturnType<RiderAssignmentService['suggestPickupRider']>
    >['data'] | null = null;
    if (
      order.branchId &&
      order.partnerAcceptedAt &&
      (order.status === OrderStatus.SHOP_ASSIGNED || order.status === OrderStatus.CONFIRMED) &&
      !order.pickupRiderId
    ) {
      try {
        const s = await this.riderAssignmentService.suggestPickupRider(orderId);
        pickupSuggestions = s.data;
      } catch {
        pickupSuggestions = null;
      }
    }

    let deliverySuggestions: Awaited<
      ReturnType<RiderAssignmentService['suggestDeliveryRider']>
    >['data'] | null = null;
    if (
      order.partnerAcceptedAt &&
      order.status === OrderStatus.READY_FOR_DELIVERY &&
      !order.deliveryRiderId
    ) {
      try {
        const s = await this.riderAssignmentService.suggestDeliveryRider(orderId);
        deliverySuggestions = s.data;
      } catch {
        deliverySuggestions = null;
      }
    }

    const riders = await this.riderModel.find({ isOnline: true }).limit(30);
    const riderUsers = await this.userModel
      .find({ _id: { $in: riders.map((r) => r.userId) } })
      .select('email');

    const paymentsByOrderId = await loadLatestOrderPaymentsByOrderId(this.paymentModel, [
      order._id,
    ]);

    return {
      success: true,
      data: {
        order: await this.serializeOpsOrder(order, paymentsByOrderId),
        customer: customer
          ? { email: customer.email, phone: customer.phone }
          : null,
        pickupRiderSuggestions: pickupSuggestions,
        suggestedPickupRiderId: order.suggestedPickupRiderId?.toString() ?? null,
        deliveryRiderSuggestions: deliverySuggestions,
        suggestedDeliveryRiderId: order.suggestedDeliveryRiderId?.toString() ?? null,
        awaitingDeliveryDispatchAt: order.awaitingDeliveryDispatchAt,
        availableRiders: riders.map((r) => {
          const u = riderUsers.find((x) => x._id.toString() === r.userId.toString());
          return {
            userId: r.userId.toString(),
            email: u?.email,
            isOnline: r.isOnline,
          };
        }),
      },
    };
  }

  async suggestPickupRider(orderId: string) {
    return this.riderAssignmentService.suggestPickupRider(orderId);
  }

  async confirmPickupRider(orderId: string, adminUserId: string, riderId?: string) {
    return this.riderAssignmentService.confirmSuggestedPickupRider(
      orderId,
      adminUserId,
      riderId,
    );
  }

  async suggestDeliveryRider(orderId: string) {
    return this.riderAssignmentService.suggestDeliveryRider(orderId);
  }

  async confirmDeliveryRider(orderId: string, adminUserId: string, riderId?: string) {
    return this.riderAssignmentService.confirmSuggestedDeliveryRider(
      orderId,
      adminUserId,
      riderId,
    );
  }

  async assignRider(
    orderId: string,
    riderId: string,
    adminUserId: string,
    type: 'pickup' | 'delivery' = 'pickup',
  ) {
    return this.ordersService.assignRider(orderId, riderId, type, adminUserId);
  }

  async reassignRider(
    orderId: string,
    riderId: string,
    adminUserId: string,
    type: 'pickup' | 'delivery' = 'pickup',
  ) {
    if (type === 'delivery') {
      return this.riderAssignmentService.reassignDeliveryRider(orderId, riderId, adminUserId);
    }
    return this.riderAssignmentService.reassignPickupRider(orderId, riderId, adminUserId);
  }

  async triggerPickupDispatch(orderId: string) {
    return this.pickupService.dispatchPickupSearch(orderId);
  }

  async flagConflict(orderId: string, note: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    order.operationsConflict = true;
    order.operationsConflictNote = note;
    order.statusHistory.push({
      status: order.status,
      timestamp: new Date(),
      note: `Conflict flagged: ${note}`,
    });
    await order.save();
    return { success: true, data: await this.serializeOpsOrder(order) };
  }

  async resolveConflict(orderId: string, resolution: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    order.operationsConflict = false;
    order.statusHistory.push({
      status: order.status,
      timestamp: new Date(),
      note: `Conflict resolved: ${resolution}`,
    });
    await order.save();
    return { success: true, data: await this.serializeOpsOrder(order) };
  }

  private async countSlaBreaches() {
    const orders = await this.orderModel
      .find({
        dispatchStatus: 'dispatched',
        status: {
          $in: [
            OrderStatus.SHOP_ASSIGNED,
            OrderStatus.CONFIRMED,
            OrderStatus.RIDER_ASSIGNED_PICKUP,
            OrderStatus.RIDER_ASSIGNED,
          ],
        },
      })
      .select('status scheduledPickupAt slaPickupDueAt dispatchStatus partnerAcceptedAt pickupRiderId pickup')
      .limit(200);

    return orders.filter((o) => {
      const sla = computePickupSla({
        status: o.status,
        scheduledPickupAt: o.slaPickupDueAt ?? o.scheduledPickupAt,
        dispatchStatus: o.dispatchStatus,
        partnerAcceptedAt: o.partnerAcceptedAt,
        pickupRiderId: o.pickupRiderId?.toString(),
        pickupCollectedAt: o.pickup?.collectedAt,
      });
      return sla.status === 'breached';
    }).length;
  }

  private async serializeOpsOrder(
    order: OrderDocument,
    paymentsByOrderId?: Map<string, PaymentDocument>,
  ) {
    const sla = DELIVERY_LEG_STATUSES.includes(order.status)
      ? computeDeliverySla({
          status: order.status,
          scheduledDeliveryAt: order.scheduledDeliveryAt,
          deliveryRiderId: order.deliveryRiderId?.toString(),
          deliveredAt: order.delivery?.deliveredAt,
        })
      : computePickupSla({
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
    const payment = buildOrderPaymentSummary(paymentMap.get(order._id.toString()));

    return {
      _id: order._id.toString(),
      status: order.status,
      bookingType: order.bookingType,
      total: order.total,
      dispatchStatus: order.dispatchStatus,
      branchName: order.branchName,
      branchCode: order.branchCode,
      partnerAcceptedAt: order.partnerAcceptedAt,
      pickupRequestedAt: order.pickupRequestedAt,
      deliveryRequestedAt: order.deliveryRequestedAt,
      pickupRiderId: order.pickupRiderId?.toString(),
      deliveryRiderId: order.deliveryRiderId?.toString(),
      scheduledPickupAt: order.scheduledPickupAt,
      operationsConflict: order.operationsConflict,
      operationsConflictNote: order.operationsConflictNote,
      sla,
      ...payment,
    };
  }
}
