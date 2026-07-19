import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { OrderStatus, UserRole } from '@lunara/types';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';
import { isRiderCompliant } from '../riders/rider-compliance';
import {
  Promotion,
  PromotionDocument,
} from './schemas/promotion.schema';
import { computePickupSla } from '@lunara/utils';
import { PromotionsService } from '../promotions/promotions.service';
import { BranchesService } from '../branches/branches.service';
import { BranchManagementService } from '../branches/branch-management.service';
import { SupportService } from '../support/support.service';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { OnboardPartnerDto } from './dto/onboard-partner.dto';
import { InitNetworkDto } from './dto/init-network.dto';
import { CreateSetupBranchDto } from './dto/create-setup-branch.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { CreateRiderDto } from './dto/create-rider.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { Review, ReviewDocument } from '../reviews/schemas/review.schema';
import { UpdatePartnerProfileDto } from './dto/update-partner-profile.dto';
import {
  buildOrderPaymentSummary,
  loadLatestOrderPaymentsByOrderId,
} from '../payments/payment-summary';
import { EmailService } from '../../common/email/email.service';

const COMPLETED = [OrderStatus.DELIVERED, OrderStatus.COMPLETED];
const CANCELLED = [OrderStatus.CANCELLED, OrderStatus.REFUNDED];
const ACTIVE_ORDER_STATUSES = Object.values(OrderStatus).filter(
  (s) => !COMPLETED.includes(s) && !CANCELLED.includes(s),
);

/** Coarse pipeline buckets for the dashboard status donut. */
const STATUS_BUCKETS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  {
    key: 'pending',
    label: 'Pending',
    statuses: [OrderStatus.PENDING, OrderStatus.PENDING_DISPATCH],
  },
  {
    key: 'confirmed',
    label: 'Confirmed',
    statuses: [
      OrderStatus.SHOP_ASSIGNED,
      OrderStatus.CONFIRMED,
      OrderStatus.RIDER_ASSIGNED_PICKUP,
      OrderStatus.RIDER_ASSIGNED,
    ],
  },
  {
    key: 'in_progress',
    label: 'In progress',
    statuses: [
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
      OrderStatus.CUSTOMER_PICKUP,
    ],
  },
  {
    key: 'out_for_delivery',
    label: 'Out for delivery',
    statuses: [OrderStatus.RIDER_ASSIGNED_DELIVERY, OrderStatus.OUT_FOR_DELIVERY],
  },
  { key: 'completed', label: 'Completed', statuses: COMPLETED },
  { key: 'cancelled', label: 'Cancelled', statuses: CANCELLED },
];

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Orders currently on the road with a rider (pickup or delivery leg). */
const IN_TRANSIT_STATUSES = [
  OrderStatus.RIDER_ASSIGNED_PICKUP,
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT_TO_SHOP,
  OrderStatus.RIDER_ASSIGNED_DELIVERY,
  OrderStatus.OUT_FOR_DELIVERY,
];

const DELIVERY_LEG_STATUSES = [
  OrderStatus.RIDER_ASSIGNED_DELIVERY,
  OrderStatus.OUT_FOR_DELIVERY,
];

/** Statuses where the pickup SLA clock is still running. */
const AWAITING_PICKUP_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.PENDING_DISPATCH,
  OrderStatus.SHOP_ASSIGNED,
  OrderStatus.CONFIRMED,
  OrderStatus.RIDER_ASSIGNED_PICKUP,
  OrderStatus.RIDER_ASSIGNED,
];

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(Promotion.name) private promotionModel: Model<PromotionDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    private supportService: SupportService,
    private branchesService: BranchesService,
    private branchManagementService: BranchManagementService,
    private promotionsService: PromotionsService,
    private emailService: EmailService,
  ) {}

  async ensureSeeded() {
    await this.supportService.ensureSeeded();
    await this.promotionsService.ensureSeeded();
  }

  async getDashboard() {
    await this.ensureSeeded();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
    const weekStart = new Date(startOfDay);
    weekStart.setDate(weekStart.getDate() - 6);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const [
      activeOrders,
      ordersToday,
      ridersOnline,
      totalRiders,
      partners,
      staff,
      customers,
      openTickets,
      activePromos,
      pendingDispatch,
      monthCompleted,
      recentOrders,
      createdWindow,
      settledWeek,
      prevWeekCompleted,
      statusCounts,
      totalOrders,
      completedAllTime,
      cancelledAllTime,
    ] = await Promise.all([
      this.orderModel.countDocuments({ status: { $in: ACTIVE_ORDER_STATUSES } }),
      this.orderModel.countDocuments({ createdAt: { $gte: startOfDay } }),
      this.riderModel.countDocuments({ isOnline: true }),
      this.riderModel.countDocuments(),
      this.userModel.countDocuments({ role: UserRole.PARTNER, isActive: true }),
      this.userModel.countDocuments({ role: UserRole.STAFF, isActive: true }),
      this.userModel.countDocuments({ role: UserRole.CUSTOMER, isActive: true }),
      this.supportService.countOpenTickets(),
      this.promotionModel.countDocuments({ isActive: true }),
      this.branchesService.countPendingDispatch(),
      this.orderModel
        .find({ status: { $in: COMPLETED }, updatedAt: { $gte: startOfMonth } })
        .select('total')
        .lean(),
      this.orderModel.find().sort({ updatedAt: -1 }).limit(8),
      this.orderModel
        .find({ createdAt: { $gte: prevWeekStart } })
        .select('createdAt')
        .lean(),
      this.orderModel
        .find({ status: { $in: [...COMPLETED, ...CANCELLED] }, updatedAt: { $gte: weekStart } })
        .select('updatedAt status total branchId branchName deliveryRiderId pickupRiderId')
        .lean(),
      this.orderModel
        .find({ status: { $in: COMPLETED }, updatedAt: { $gte: prevWeekStart, $lt: weekStart } })
        .select('total')
        .lean(),
      this.orderModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.orderModel.estimatedDocumentCount(),
      this.orderModel.countDocuments({ status: { $in: COMPLETED } }),
      this.orderModel.countDocuments({ status: { $in: CANCELLED } }),
    ]);

    const monthRevenue = monthCompleted.reduce((s, o) => s + o.total, 0);

    // 7-day trend of created / completed / cancelled orders plus daily revenue
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(localDayKey(d));
    }
    const trendMap = new Map(
      days.map((date) => [date, { date, created: 0, completed: 0, cancelled: 0, revenue: 0 }]),
    );
    let createdThisWeek = 0;
    let createdPrevWeek = 0;
    for (const o of createdWindow) {
      if (o.createdAt >= weekStart) {
        createdThisWeek += 1;
        const bucket = trendMap.get(localDayKey(o.createdAt));
        if (bucket) bucket.created += 1;
      } else {
        createdPrevWeek += 1;
      }
    }
    let completedThisWeek = 0;
    let weekRevenue = 0;
    const branchAgg = new Map<string, { name: string; orders: number; revenue: number }>();
    const riderAgg = new Map<string, number>();
    for (const o of settledWeek) {
      const bucket = trendMap.get(localDayKey(o.updatedAt));
      if (COMPLETED.includes(o.status)) {
        completedThisWeek += 1;
        weekRevenue += o.total;
        if (bucket) {
          bucket.completed += 1;
          bucket.revenue += o.total;
        }
        const branchKey = o.branchId?.toString() ?? 'unassigned';
        const branch = branchAgg.get(branchKey) ?? {
          name: o.branchName ?? 'Unassigned',
          orders: 0,
          revenue: 0,
        };
        branch.orders += 1;
        branch.revenue += o.total;
        branchAgg.set(branchKey, branch);
        const riderKey = (o.deliveryRiderId ?? o.pickupRiderId)?.toString();
        if (riderKey) riderAgg.set(riderKey, (riderAgg.get(riderKey) ?? 0) + 1);
      } else if (bucket) {
        bucket.cancelled += 1;
      }
    }
    const prevWeekRevenue = prevWeekCompleted.reduce((s, o) => s + o.total, 0);

    const topBranches = [...branchAgg.entries()]
      .map(([id, b]) => ({ id, ...b }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const topRiderIds = [...riderAgg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Resolve names for leaderboard riders + recent-order participants (order refs hold user ids)
    const riderUserIds = new Set<string>(topRiderIds.map(([id]) => id));
    for (const o of recentOrders) {
      const id = (o.deliveryRiderId ?? o.pickupRiderId)?.toString();
      if (id) riderUserIds.add(id);
    }
    const [riderDocs, customerDocs] = await Promise.all([
      this.riderModel
        .find({ userId: { $in: [...riderUserIds].map((id) => new Types.ObjectId(id)) } })
        .select('userId firstName lastName')
        .lean(),
      this.userModel
        .find({ _id: { $in: recentOrders.map((o) => o.customerId).filter(Boolean) } })
        .select('email phone')
        .lean(),
    ]);
    const riderNameMap = new Map(
      riderDocs.map((r) => [
        r.userId.toString(),
        [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Rider',
      ]),
    );
    const customerMap = new Map(customerDocs.map((c) => [c._id.toString(), c]));

    const statusCountMap = new Map(statusCounts.map((s) => [s._id, s.count]));
    const statusBreakdown = STATUS_BUCKETS.map((b) => ({
      key: b.key,
      label: b.label,
      count: b.statuses.reduce((s, st) => s + (statusCountMap.get(st) ?? 0), 0),
    }));

    // Latest lifecycle event per recent order → activity feed
    const activity = recentOrders
      .map((o) => {
        const last = o.statusHistory?.[o.statusHistory.length - 1];
        return {
          orderId: o._id.toString(),
          status: last?.status ?? o.status,
          branchName: o.branchName ?? null,
          at: last?.timestamp ?? o.updatedAt,
        };
      })
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return {
      success: true,
      data: {
        counts: {
          activeOrders,
          ordersToday,
          ridersOnline,
          totalRiders,
          partners,
          staff,
          customers,
          openTickets,
          activePromos,
          pendingDispatch,
        },
        revenue: {
          month: monthRevenue,
          monthOrders: monthCompleted.length,
          week: weekRevenue,
        },
        deltas: {
          orders: pctDelta(createdThisWeek, createdPrevWeek),
          completed: pctDelta(completedThisWeek, prevWeekCompleted.length),
          revenue: pctDelta(weekRevenue, prevWeekRevenue),
        },
        week: {
          orders: createdThisWeek,
          completed: completedThisWeek,
        },
        trend: days.map((d) => {
          const t = trendMap.get(d)!;
          return { date: t.date, created: t.created, completed: t.completed, cancelled: t.cancelled };
        }),
        revenueDaily: days.map((d) => {
          const t = trendMap.get(d)!;
          return { date: t.date, revenue: t.revenue, orders: t.completed };
        }),
        statusBreakdown,
        topBranches,
        topRiders: topRiderIds.map(([id, deliveries]) => ({
          id,
          name: riderNameMap.get(id) ?? 'Rider',
          deliveries,
        })),
        totals: {
          totalOrders,
          completedOrders: completedAllTime,
          cancelledOrders: cancelledAllTime,
          cancellationRate:
            totalOrders > 0 ? Math.round((cancelledAllTime / totalOrders) * 1000) / 10 : 0,
        },
        activity,
        recentOrders: recentOrders.map((o) => {
          const customer = customerMap.get(o.customerId?.toString() ?? '');
          const riderId = (o.deliveryRiderId ?? o.pickupRiderId)?.toString();
          return {
            _id: o._id.toString(),
            status: o.status,
            bookingType: o.bookingType,
            total: o.total,
            customer: customer?.email ?? customer?.phone ?? null,
            branchName: o.branchName ?? null,
            riderName: riderId ? (riderNameMap.get(riderId) ?? null) : null,
            createdAt: o.createdAt,
            updatedAt: o.updatedAt,
          };
        }),
      },
    };
  }

  async getLiveTracking() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [onlineRiders, totalRiders, transitOrders, branches, completedToday, delayedPickups, pendingDispatch] =
      await Promise.all([
        this.riderModel
          .find({ isOnline: true })
          .select(
            'userId firstName lastName currentLocation lastLocationSpeed lastLocationHeading lastLocationRecordedAt shiftStatus vehicleType plateNumber',
          )
          .lean(),
        this.riderModel.countDocuments(),
        this.orderModel.find({ status: { $in: IN_TRANSIT_STATUSES } }).sort({ updatedAt: -1 }).limit(50),
        this.branchModel.find().select('name code city location').lean(),
        this.orderModel.countDocuments({ status: { $in: COMPLETED }, updatedAt: { $gte: startOfDay } }),
        this.orderModel.countDocuments({
          status: { $in: AWAITING_PICKUP_STATUSES },
          slaPickupDueAt: { $lt: new Date() },
        }),
        this.branchesService.countPendingDispatch(),
      ]);

    // Rider on the active leg of each transit order (delivery rider once the delivery leg starts)
    const orderRiderIds = new Set<string>();
    for (const o of transitOrders) {
      const riderId = DELIVERY_LEG_STATUSES.includes(o.status)
        ? (o.deliveryRiderId ?? o.pickupRiderId)
        : (o.pickupRiderId ?? o.deliveryRiderId);
      if (riderId) orderRiderIds.add(riderId.toString());
    }

    const [orderRiderDocs, contactUsers] = await Promise.all([
      this.riderModel
        .find({ userId: { $in: [...orderRiderIds].map((id) => new Types.ObjectId(id)) } })
        .select('userId firstName lastName vehicleType plateNumber')
        .lean(),
      this.userModel
        .find({
          _id: {
            $in: [
              ...transitOrders.map((o) => o.customerId).filter(Boolean),
              ...[...orderRiderIds].map((id) => new Types.ObjectId(id)),
            ],
          },
        })
        .select('email phone')
        .lean(),
      ]);

    const riderByUserId = new Map(orderRiderDocs.map((r) => [r.userId.toString(), r]));
    const contactById = new Map(contactUsers.map((u) => [u._id.toString(), u]));
    const riderName = (r?: { firstName?: string; lastName?: string }) =>
      r ? [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Rider' : null;

    return {
      success: true,
      data: {
        stats: {
          ridersOnline: onlineRiders.length,
          totalRiders,
          inTransit: transitOrders.length,
          pendingDispatch,
          delayedPickups,
          completedToday,
        },
        riders: onlineRiders.map((r) => {
          const [lng, lat] = r.currentLocation?.coordinates ?? [0, 0];
          return {
            userId: r.userId.toString(),
            name: riderName(r) ?? 'Rider',
            lat,
            lng,
            hasFix: Boolean(lat || lng),
            speed: r.lastLocationSpeed ?? null,
            heading: r.lastLocationHeading ?? null,
            recordedAt: r.lastLocationRecordedAt ?? null,
            shiftStatus: r.shiftStatus,
            vehicleType: r.vehicleType,
            plateNumber: r.plateNumber ?? null,
          };
        }),
        branches: branches
          .filter((b) => b.location?.coordinates?.length === 2)
          .map((b) => ({
            id: b._id.toString(),
            name: b.name,
            code: b.code,
            city: b.city,
            lat: b.location.coordinates[1],
            lng: b.location.coordinates[0],
          })),
        orders: transitOrders.map((o) => {
          const leg = DELIVERY_LEG_STATUSES.includes(o.status) ? 'delivery' : 'pickup';
          const riderId = (
            leg === 'delivery' ? (o.deliveryRiderId ?? o.pickupRiderId) : (o.pickupRiderId ?? o.deliveryRiderId)
          )?.toString();
          const rider = riderId ? riderByUserId.get(riderId) : undefined;
          const riderContact = riderId ? contactById.get(riderId) : undefined;
          const customer = contactById.get(o.customerId?.toString() ?? '');
          return {
            _id: o._id.toString(),
            status: o.status,
            leg,
            bookingType: o.bookingType,
            total: o.total,
            branchName: o.branchName ?? null,
            customer: customer?.email ?? customer?.phone ?? null,
            customerPhone: customer?.phone ?? null,
            riderUserId: riderId ?? null,
            riderName: riderName(rider),
            riderPhone: riderContact?.phone ?? null,
            vehicleType: rider?.vehicleType ?? null,
            plateNumber: rider?.plateNumber ?? null,
            createdAt: o.createdAt,
            slaPickupDueAt: o.slaPickupDueAt ?? null,
            timeline: (o.statusHistory ?? []).slice(-5).map((e) => ({
              status: e.status,
              timestamp: e.timestamp,
            })),
          };
        }),
      },
    };
  }

  async getOrders(status?: string, limit = 50) {
    // `status` accepts a single status or a comma-separated group (e.g. "delivered,completed")
    const statuses = (status ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const filter = statuses.length ? { status: { $in: statuses } } : {};
    const items = await this.orderModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit);

    const riderUserIds = new Set<string>();
    for (const o of items) {
      const riderId = DELIVERY_LEG_STATUSES.includes(o.status)
        ? (o.deliveryRiderId ?? o.pickupRiderId)
        : (o.pickupRiderId ?? o.deliveryRiderId);
      if (riderId) riderUserIds.add(riderId.toString());
    }

    const [customers, riderDocs, paymentsByOrderId] = await Promise.all([
      this.userModel
        .find({ _id: { $in: items.map((o) => o.customerId).filter(Boolean) } })
        .select('email phone'),
      this.riderModel
        .find({ userId: { $in: [...riderUserIds].map((id) => new Types.ObjectId(id)) } })
        .select('userId firstName lastName')
        .lean(),
      loadLatestOrderPaymentsByOrderId(
        this.paymentModel,
        items.map((o) => o._id),
      ),
    ]);

    const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));
    const riderNameByUserId = new Map(
      riderDocs.map((r) => [
        r.userId.toString(),
        [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Rider',
      ]),
    );

    return {
      success: true,
      data: {
        items: items.map((o) => {
          const sla = computePickupSla({
            status: o.status,
            scheduledPickupAt: o.slaPickupDueAt ?? o.scheduledPickupAt,
            dispatchStatus: o.dispatchStatus,
            partnerAcceptedAt: o.partnerAcceptedAt,
            pickupRiderId: o.pickupRiderId?.toString(),
            pickupCollectedAt: o.pickup?.collectedAt,
          });
          const payment = buildOrderPaymentSummary(paymentsByOrderId.get(o._id.toString()));
          const customer = customerMap.get(o.customerId?.toString() ?? '');
          const riderId = (
            DELIVERY_LEG_STATUSES.includes(o.status)
              ? (o.deliveryRiderId ?? o.pickupRiderId)
              : (o.pickupRiderId ?? o.deliveryRiderId)
          )?.toString();
          return {
            _id: o._id.toString(),
            status: o.status,
            bookingType: o.bookingType,
            total: o.total,
            subtotal: o.subtotal,
            deliveryFee: o.deliveryFee,
            discount: o.discount,
            customerId: o.customerId?.toString(),
            customerEmail: customer?.email,
            customerPhone: customer?.phone,
            partnerId: o.partnerId?.toString(),
            branchName: o.branchName,
            riderName: riderId ? (riderNameByUserId.get(riderId) ?? null) : null,
            bagSizeLabel: o.bagSizeLabel ?? null,
            estimatedWeightKg: o.estimatedWeightKg ?? null,
            scheduledPickupAt: o.scheduledPickupAt ?? null,
            scheduledDeliveryAt: o.scheduledDeliveryAt ?? null,
            dispatchStatus: o.dispatchStatus,
            operationsConflict: o.operationsConflict,
            createdAt: o.createdAt,
            updatedAt: o.updatedAt,
            slaStatus: sla.status,
            slaLabel: sla.label,
            ...payment,
          };
        }),
        statusCounts: await this.orderStatusCounts(),
      },
    };
  }

  async createRider(dto: CreateRiderDto) {
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
      firstName: dto.firstName?.trim(),
      lastName: dto.lastName?.trim(),
      vehicleType: dto.vehicleType ?? 'motorcycle',
      documents: [],
      isOnline: false,
      shiftStatus: 'offline',
      currentLocation: { type: 'Point', coordinates: [0, 0] },
    });

    const compliance = isRiderCompliant(rider, user);

    await this.emailService.sendRiderInvite(email, dto.password);

    return {
      success: true,
      data: {
        _id: rider._id.toString(),
        userId: user._id.toString(),
        email: user.email,
        phone: user.phone,
        isActive: user.isActive,
        isOnline: rider.isOnline,
        vehicleType: rider.vehicleType,
        firstName: rider.firstName,
        lastName: rider.lastName,
        verificationStatus: compliance.verificationStatus,
        totalEarnings: rider.totalEarnings,
        todayEarnings: rider.todayEarnings,
        activeTasks: 0,
      },
    };
  }

  async getRiders() {
    const riders = await this.riderModel.find().sort({ updatedAt: -1 });
    const users = await this.userModel
      .find({ _id: { $in: riders.map((r) => r.userId) } })
      .select('email phone isActive');

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const activeDeliveries = await this.orderModel.aggregate([
      {
        $match: {
          status: OrderStatus.OUT_FOR_DELIVERY,
          deliveryRiderId: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$deliveryRiderId', count: { $sum: 1 } } },
    ]);
    const pickupActive = await this.orderModel.aggregate([
      {
        $match: {
          status: {
            $in: [
              OrderStatus.RIDER_ASSIGNED_PICKUP,
              OrderStatus.RIDER_ASSIGNED,
              OrderStatus.CONFIRMED,
              OrderStatus.PICKED_UP,
              OrderStatus.IN_TRANSIT_TO_SHOP,
            ],
          },
          pickupRiderId: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$pickupRiderId', count: { $sum: 1 } } },
    ]);

    const deliveryMap = new Map(
      activeDeliveries.filter((d) => d._id).map((d) => [d._id.toString(), d.count]),
    );
    const pickupMap = new Map(
      pickupActive.filter((p) => p._id).map((p) => [p._id.toString(), p.count]),
    );

    return {
      success: true,
      data: riders.map((r) => {
        const uid = r.userId.toString();
        const user = userMap.get(uid);
        const compliance = isRiderCompliant(r, user);
        return {
          _id: r._id.toString(),
          userId: uid,
          email: user?.email,
          phone: user?.phone,
          isActive: user?.isActive ?? true,
          isOnline: r.isOnline,
          vehicleType: r.vehicleType,
          firstName: r.firstName,
          lastName: r.lastName,
          verificationStatus: compliance.verificationStatus,
          totalEarnings: r.totalEarnings,
          todayEarnings: r.todayEarnings,
          activeTasks: (deliveryMap.get(uid) ?? 0) + (pickupMap.get(uid) ?? 0),
        };
      }),
    };
  }

  async createPartner(dto: CreatePartnerDto) {
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
      role: UserRole.PARTNER,
      isActive: true,
    });

    await this.emailService.sendPartnerInvite(email, dto.password);

    return {
      success: true,
      data: {
        _id: user._id.toString(),
        email: user.email,
        phone: user.phone,
        isActive: user.isActive,
        staffCount: 0,
        totalOrders: 0,
        revenue: 0,
      },
    };
  }

  async onboardPartner(dto: OnboardPartnerDto) {
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
      role: UserRole.PARTNER,
      isActive: true,
    });

    let branch;
    try {
      branch = await this.branchManagementService.createBranch({
        code: dto.branchCode,
        name: dto.branchName,
        branchType: dto.branchType,
        parentBranchId: dto.parentBranchId,
        partnerUserId: user._id.toString(),
        line1: dto.line1,
        city: dto.city,
        province: dto.province,
        coordinates: dto.coordinates,
        commissionRate: dto.commissionRate,
        maxActiveOrders: dto.maxActiveOrders,
        maxWeightCapacityKg: dto.maxWeightCapacityKg,
      });
    } catch (err) {
      await this.userModel.deleteOne({ _id: user._id });
      throw err;
    }

    await this.emailService.sendPartnerInvite(email, dto.password);

    return {
      success: true,
      data: {
        partner: {
          _id: user._id.toString(),
          email: user.email,
          phone: user.phone,
        },
        branch: branch.data,
      },
    };
  }

  async getShops() {
    const partners = await this.userModel
      .find({ role: UserRole.PARTNER })
      .select(
        'email phone isActive createdAt ownerName subscriptionPlan planPrice planRenewsAt trialEndsAt',
      )
      .sort({ email: 1 });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [orderStats, orderStats30d] = await Promise.all([
      this.orderModel.aggregate([
        { $match: { partnerId: { $exists: true, $ne: null } } },
        { $group: { _id: '$partnerId', totalOrders: { $sum: 1 }, revenue: { $sum: '$total' } } },
      ]),
      this.orderModel.aggregate([
        {
          $match: {
            partnerId: { $exists: true, $ne: null },
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        { $group: { _id: '$partnerId', orders30d: { $sum: 1 }, revenue30d: { $sum: '$total' } } },
      ]),
    ]);
    const statsMap = new Map(
      orderStats.map((s) => [s._id.toString(), { totalOrders: s.totalOrders, revenue: s.revenue }]),
    );
    const stats30dMap = new Map(
      orderStats30d.map((s) => [s._id.toString(), { orders30d: s.orders30d, revenue30d: s.revenue30d }]),
    );

    const ratingStats = await this.reviewModel.aggregate([
      { $match: { partnerId: { $exists: true, $ne: null } } },
      { $group: { _id: '$partnerId', avgRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
    ]);
    const ratingMap = new Map(
      ratingStats.map((r) => [r._id.toString(), { avgRating: r.avgRating, reviewCount: r.reviewCount }]),
    );

    // A partner account can own several branches (e.g. franchise locations) — surface all of
    // them here so admin-web doesn't just show a blank/singular branch name for those partners.
    const branches = await this.branchModel
      .find({ partnerUserId: { $in: partners.map((p) => p._id) } })
      .select('partnerUserId name operatingHours isMainShop')
      .sort({ createdAt: 1 });
    const branchNamesByPartnerId = new Map<string, string[]>();
    const operatingHoursByPartnerId = new Map<string, BranchDocument['operatingHours']>();
    const mainBranchNameByPartnerId = new Map<string, string>();
    for (const b of branches) {
      const key = b.partnerUserId.toString();
      const names = branchNamesByPartnerId.get(key) ?? [];
      names.push(b.name);
      branchNamesByPartnerId.set(key, names);
      if (!operatingHoursByPartnerId.has(key)) {
        operatingHoursByPartnerId.set(key, b.operatingHours);
      }
      if (b.isMainShop) {
        mainBranchNameByPartnerId.set(key, b.name);
      }
    }

    const staffCount = await this.userModel.countDocuments({ role: UserRole.STAFF, isActive: true });

    return {
      success: true,
      data: {
        shops: partners.map((p) => {
          const id = p._id.toString();
          const rating = ratingMap.get(id);
          return {
            _id: id,
            email: p.email,
            phone: p.phone,
            isActive: p.isActive,
            ownerName: p.ownerName,
            subscriptionPlan: p.subscriptionPlan ?? 'trial',
            planPrice: p.planPrice ?? 0,
            planRenewsAt: p.planRenewsAt,
            trialEndsAt: p.trialEndsAt,
            staffCount,
            totalOrders: statsMap.get(id)?.totalOrders ?? 0,
            revenue: statsMap.get(id)?.revenue ?? 0,
            orders30d: stats30dMap.get(id)?.orders30d ?? 0,
            revenue30d: stats30dMap.get(id)?.revenue30d ?? 0,
            rating: rating ? Math.round(rating.avgRating * 10) / 10 : null,
            reviewCount: rating?.reviewCount ?? 0,
            branchNames: branchNamesByPartnerId.get(id) ?? [],
            mainBranchName: mainBranchNameByPartnerId.get(id) ?? null,
            operatingHours: operatingHoursByPartnerId.get(id) ?? [],
          };
        }),
      },
    };
  }

  async updatePartnerProfile(id: string, dto: UpdatePartnerProfileDto) {
    const partner = await this.userModel.findOne({ _id: id, role: UserRole.PARTNER });
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }
    if (dto.ownerName !== undefined) partner.ownerName = dto.ownerName;
    if (dto.subscriptionPlan !== undefined) partner.subscriptionPlan = dto.subscriptionPlan;
    if (dto.planPrice !== undefined) partner.planPrice = dto.planPrice;
    if (dto.planRenewsAt !== undefined) partner.planRenewsAt = new Date(dto.planRenewsAt);
    if (dto.trialEndsAt !== undefined) partner.trialEndsAt = new Date(dto.trialEndsAt);
    if (dto.businessName !== undefined) partner.businessName = dto.businessName;
    if (dto.tin !== undefined) partner.tin = dto.tin;
    if (dto.businessPermitNumber !== undefined) partner.businessPermitNumber = dto.businessPermitNumber;
    if (dto.businessPermitVerified !== undefined) partner.businessPermitVerified = dto.businessPermitVerified;
    if (dto.birRegistrationNumber !== undefined) partner.birRegistrationNumber = dto.birRegistrationNumber;
    if (dto.birRegistrationVerified !== undefined) partner.birRegistrationVerified = dto.birRegistrationVerified;
    if (dto.deliveryRadiusKm !== undefined) partner.deliveryRadiusKm = dto.deliveryRadiusKm;
    await partner.save();
    return { success: true, data: { _id: partner._id.toString() } };
  }

  async getShopDetail(id: string) {
    const partner = await this.userModel.findOne({ _id: id, role: UserRole.PARTNER });
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    const partnerId = partner._id;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
    const startOfLastMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth() - 1, 1);

    const monthSummary = async (from: Date, to: Date) => {
      const rows = await this.orderModel.aggregate<{
        _id: null;
        orders: number;
        completed: number;
        cancelled: number;
        revenue: number;
      }>([
        { $match: { partnerId, createdAt: { $gte: from, $lt: to } } },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            completed: { $sum: { $cond: [{ $in: ['$status', COMPLETED] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $in: ['$status', CANCELLED] }, 1, 0] } },
            revenue: { $sum: '$total' },
          },
        },
      ]);
      return rows[0] ?? { orders: 0, completed: 0, cancelled: 0, revenue: 0 };
    };

    const [thisMonth, lastMonth, branches, recentOrdersRaw, customerCounts, ratingRow] = await Promise.all([
      monthSummary(startOfMonth, new Date(startOfDay.getFullYear(), startOfDay.getMonth() + 1, 1)),
      monthSummary(startOfLastMonth, startOfMonth),
      this.branchModel
        .find({ partnerUserId: partnerId })
        .select('name city province isActive serviceRadiusKm maxActiveOrders')
        .sort({ createdAt: 1 }),
      this.orderModel
        .find({ partnerId })
        .select('status total createdAt')
        .sort({ createdAt: -1 })
        .limit(5),
      this.orderModel.aggregate<{ _id: Types.ObjectId; orderCount: number }>([
        { $match: { partnerId } },
        { $group: { _id: '$customerId', orderCount: { $sum: 1 } } },
      ]),
      this.reviewModel.aggregate<{ _id: null; avgRating: number; reviewCount: number }>([
        { $match: { partnerId } },
        { $group: { _id: null, avgRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
      ]),
    ]);

    const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
    const delta = (curr: number, prev: number) =>
      prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : curr > 0 ? 100 : 0;

    const repeatCustomers = customerCounts.filter((c) => c.orderCount > 1).length;
    const repeatRate = pct(repeatCustomers, customerCounts.length);
    const rating = ratingRow[0];

    return {
      success: true,
      data: {
        _id: partner._id.toString(),
        email: partner.email,
        phone: partner.phone,
        isActive: partner.isActive,
        ownerName: partner.ownerName,
        businessName: partner.businessName,
        tin: partner.tin,
        businessPermitNumber: partner.businessPermitNumber,
        businessPermitVerified: partner.businessPermitVerified ?? false,
        birRegistrationNumber: partner.birRegistrationNumber,
        birRegistrationVerified: partner.birRegistrationVerified ?? false,
        deliveryRadiusKm: partner.deliveryRadiusKm,
        subscriptionPlan: partner.subscriptionPlan ?? 'trial',
        planPrice: partner.planPrice ?? 0,
        planRenewsAt: partner.planRenewsAt,
        trialEndsAt: partner.trialEndsAt,
        createdAt: partner.createdAt,
        rating: rating ? Math.round(rating.avgRating * 10) / 10 : null,
        reviewCount: rating?.reviewCount ?? 0,
        performance: {
          ordersThisMonth: thisMonth.orders,
          completedThisMonth: thisMonth.completed,
          cancelledThisMonth: thisMonth.cancelled,
          revenueThisMonth: thisMonth.revenue,
          ordersDelta: delta(thisMonth.orders, lastMonth.orders),
          completedDelta: delta(thisMonth.completed, lastMonth.completed),
          cancelledDelta: delta(thisMonth.cancelled, lastMonth.cancelled),
          revenueDelta: delta(thisMonth.revenue, lastMonth.revenue),
          completionRate: pct(thisMonth.completed, thisMonth.orders),
          repeatRate,
        },
        branches: branches.map((b) => ({
          _id: b._id.toString(),
          name: b.name,
          city: b.city,
          province: b.province,
          isActive: b.isActive,
          serviceRadiusKm: b.serviceRadiusKm,
          maxActiveOrders: b.maxActiveOrders,
        })),
        coverageCities: Array.from(new Set(branches.map((b) => b.city).filter(Boolean))),
        pickupRadiusKm: branches.length > 0 ? Math.max(...branches.map((b) => b.serviceRadiusKm ?? 0)) : null,
        recentOrders: recentOrdersRaw.map((o) => ({
          _id: o._id.toString(),
          status: o.status,
          total: o.total,
          createdAt: o.createdAt,
        })),
      },
    };
  }

  async getRevenue() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
    const startOfLastMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth() - 1, 1);
    const startOfYear = new Date(startOfDay.getFullYear(), 0, 1);
    const weekStart = new Date(startOfDay);
    weekStart.setDate(weekStart.getDate() - 6);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const sumRange = async (from: Date, to?: Date) => {
      const rows = await this.orderModel.aggregate<{ revenue: number; orders: number }>([
        {
          $match: {
            status: { $in: COMPLETED },
            updatedAt: { $gte: from, ...(to ? { $lt: to } : {}) },
          },
        },
        { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
      ]);
      return { revenue: rows[0]?.revenue ?? 0, orders: rows[0]?.orders ?? 0 };
    };

    const [windowOrders, allCompleted, monthSum, lastMonthSum, ytdSum, paymentMix] =
      await Promise.all([
        this.orderModel
          .find({ status: { $in: COMPLETED }, updatedAt: { $gte: prevWeekStart } })
          .select('updatedAt total subtotal deliveryFee discount branchName bookingType')
          .lean(),
        this.orderModel.countDocuments({ status: { $in: COMPLETED } }),
        sumRange(startOfMonth),
        sumRange(startOfLastMonth, startOfMonth),
        sumRange(startOfYear),
        this.paymentModel.aggregate<{ _id: string; amount: number; count: number }>([
          {
            $match: {
              purpose: 'order',
              status: 'paid',
              paidAt: { $gte: weekStart },
            },
          },
          { $group: { _id: '$method', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { amount: -1 } },
        ]),
      ]);

    // Daily series across both weeks + this-week composition and breakdowns
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(localDayKey(d));
    }
    const prevDays: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(prevWeekStart);
      d.setDate(d.getDate() + i);
      prevDays.push(localDayKey(d));
    }
    const dailyMap = new Map(days.map((date) => [date, { date, revenue: 0, orders: 0 }]));
    const prevDailyMap = new Map(prevDays.map((date) => [date, { date, revenue: 0, orders: 0 }]));

    let week = { revenue: 0, orders: 0, subtotal: 0, deliveryFees: 0, discounts: 0 };
    let prevWeek = { revenue: 0, orders: 0 };
    let today = { revenue: 0, orders: 0 };
    const branchAgg = new Map<string, { revenue: number; orders: number }>();
    const serviceAgg = new Map<string, { revenue: number; count: number }>();

    for (const o of windowOrders) {
      const key = localDayKey(o.updatedAt);
      if (o.updatedAt >= weekStart) {
        week.revenue += o.total;
        week.orders += 1;
        week.subtotal += o.subtotal ?? 0;
        week.deliveryFees += o.deliveryFee ?? 0;
        week.discounts += o.discount ?? 0;
        const day = dailyMap.get(key);
        if (day) {
          day.revenue += o.total;
          day.orders += 1;
        }
        if (o.updatedAt >= startOfDay) {
          today.revenue += o.total;
          today.orders += 1;
        }
        const branchKey = o.branchName ?? 'Unassigned';
        const branch = branchAgg.get(branchKey) ?? { revenue: 0, orders: 0 };
        branch.revenue += o.total;
        branch.orders += 1;
        branchAgg.set(branchKey, branch);
        const service = serviceAgg.get(o.bookingType) ?? { revenue: 0, count: 0 };
        service.revenue += o.total;
        service.count += 1;
        serviceAgg.set(o.bookingType, service);
      } else {
        prevWeek.revenue += o.total;
        prevWeek.orders += 1;
        const day = prevDailyMap.get(key);
        if (day) {
          day.revenue += o.total;
          day.orders += 1;
        }
      }
    }

    const daily = days.map((d) => dailyMap.get(d)!);
    const prevDaily = prevDays.map((d) => prevDailyMap.get(d)!);

    return {
      success: true,
      data: {
        // Legacy fields kept for compatibility
        today: today.revenue,
        month: monthSum.revenue,
        todayOrders: today.orders,
        monthOrders: monthSum.orders,
        allTimeCompleted: allCompleted,
        daily,
        byService: [...serviceAgg.entries()]
          .map(([service, v]) => ({ service, ...v }))
          .sort((a, b) => b.revenue - a.revenue),
        // Week-over-week analytics
        week: {
          ...week,
          revenueDelta: pctDelta(week.revenue, prevWeek.revenue),
          ordersDelta: pctDelta(week.orders, prevWeek.orders),
          avgOrderValue: week.orders > 0 ? Math.round(week.revenue / week.orders) : 0,
          avgPerDay: Math.round(week.revenue / 7),
        },
        prevWeek,
        prevDaily,
        byBranch: [...branchAgg.entries()]
          .map(([name, v]) => ({
            name,
            ...v,
            avgOrderValue: v.orders > 0 ? Math.round(v.revenue / v.orders) : 0,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 8),
        byPayment: paymentMix.map((p) => ({ method: p._id, amount: p.amount, count: p.count })),
        topDays: [...daily].filter((d) => d.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
        summary: {
          thisMonth: monthSum,
          lastMonth: lastMonthSum,
          ytd: ytdSum,
        },
      },
    };
  }

  async getReports(days = 7) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const orders = await this.orderModel.find({ createdAt: { $gte: from } });
    const completed = orders.filter((o) => COMPLETED.includes(o.status));
    const revenue = completed.reduce((s, o) => s + o.total, 0);

    const newCustomers = await this.userModel.countDocuments({
      role: UserRole.CUSTOMER,
      createdAt: { $gte: from },
    });

    const ridersJoined = await this.riderModel.countDocuments({ createdAt: { $gte: from } });

    return {
      success: true,
      data: {
        periodDays: days,
        from: from.toISOString(),
        totalOrders: orders.length,
        completedOrders: completed.length,
        cancelledOrders: orders.filter((o) => o.status === OrderStatus.CANCELLED).length,
        revenue,
        averageOrderValue: completed.length ? Math.round(revenue / completed.length) : 0,
        newCustomers,
        ridersJoined,
        ordersByStatus: orders.reduce(
          (acc, o) => {
            acc[o.status] = (acc[o.status] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        ordersByService: completed.reduce(
          (acc, o) => {
            acc[o.bookingType] = (acc[o.bookingType] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
    };
  }

  async getPromotions() {
    await this.ensureSeeded();
    const items = await this.promotionModel.find().sort({ createdAt: -1 });

    // Real usage stats per code — orders that actually applied the coupon, excluding voided orders.
    const codes = items.map((p) => p.code);
    const stats =
      codes.length > 0
        ? await this.orderModel.aggregate<{
            _id: string;
            redemptions: number;
            discountGiven: number;
            revenueImpact: number;
          }>([
            { $match: { couponCode: { $in: codes }, status: { $nin: CANCELLED } } },
            {
              $group: {
                _id: '$couponCode',
                redemptions: { $sum: 1 },
                discountGiven: { $sum: '$discount' },
                revenueImpact: { $sum: '$total' },
              },
            },
          ])
        : [];
    const statsByCode = new Map(stats.map((s) => [s._id, s]));

    return {
      success: true,
      data: items.map((p) => {
        const s = statsByCode.get(p.code);
        return {
          ...this.serializePromotion(p),
          redemptions: s?.redemptions ?? 0,
          discountGiven: s?.discountGiven ?? 0,
          revenueImpact: s?.revenueImpact ?? 0,
        };
      }),
    };
  }

  async getActiveDeals() {
    await this.ensureSeeded();
    const now = new Date();
    const items = await this.promotionModel
      .find({
        isActive: true,
        $and: [
          { $or: [{ startsAt: { $exists: false } }, { startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: { $exists: false } }, { endsAt: null }, { endsAt: { $gte: now } }] },
        ],
      })
      .sort({ createdAt: -1 });

    return {
      success: true,
      data: items.map((p) => this.serializeDeal(p)),
    };
  }

  async createPromotion(dto: CreatePromotionDto) {
    const promo = await this.promotionModel.create({
      code: dto.code.toUpperCase(),
      title: dto.title,
      description: dto.description,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      minOrderAmount: dto.minOrderAmount ?? 0,
      isActive: dto.isActive ?? true,
      audience: dto.audience,
      kind: dto.kind,
      maxUsesPerCustomer: dto.maxUsesPerCustomer,
      newCustomerWithinDays: dto.newCustomerWithinDays,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
    });
    return { success: true, data: this.serializePromotion(promo) };
  }

  async updatePromotion(id: string, dto: UpdatePromotionDto) {
    const promo = await this.promotionModel.findById(id);
    if (!promo) throw new NotFoundException('Promotion not found');
    if (dto.title) promo.title = dto.title;
    if (dto.description != null) promo.description = dto.description;
    if (dto.discountValue != null) promo.discountValue = dto.discountValue;
    if (dto.minOrderAmount != null) promo.minOrderAmount = dto.minOrderAmount;
    if (dto.isActive != null) promo.isActive = dto.isActive;
    if (dto.audience) promo.audience = dto.audience;
    if (dto.kind) promo.kind = dto.kind;
    if (dto.maxUsesPerCustomer != null) promo.maxUsesPerCustomer = dto.maxUsesPerCustomer;
    if (dto.newCustomerWithinDays != null) promo.newCustomerWithinDays = dto.newCustomerWithinDays;
    if (dto.startsAt) promo.startsAt = new Date(dto.startsAt);
    if (dto.endsAt) promo.endsAt = new Date(dto.endsAt);
    await promo.save();
    return { success: true, data: this.serializePromotion(promo) };
  }

  private async orderStatusCounts() {
    const grouped = await this.orderModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(grouped.map((g) => [g._id, g.count]));
  }

  private serializePromotion(p: PromotionDocument) {
    return {
      _id: p._id.toString(),
      code: p.code,
      title: p.title,
      description: p.description,
      discountType: p.discountType,
      discountValue: p.discountValue,
      minOrderAmount: p.minOrderAmount,
      isActive: p.isActive,
      audience: p.audience,
      kind: p.kind,
      maxUsesPerCustomer: p.maxUsesPerCustomer,
      newCustomerWithinDays: p.newCustomerWithinDays,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private serializeDeal(p: PromotionDocument) {
    return {
      _id: p._id.toString(),
      code: p.code,
      title: p.title,
      description: p.description,
      discountType: p.discountType,
      discountValue: p.discountValue,
      minOrderAmount: p.minOrderAmount,
      endsAt: p.endsAt?.toISOString(),
    };
  }

  async getSetupStatus() {
    const hq = await this.branchModel.findOne({ branchType: 'hq' });
    const operationalBranchCount = hq
      ? await this.branchModel.countDocuments({ branchType: { $ne: 'hq' } })
      : 0;

    return {
      success: true,
      data: {
        initialized: !!hq,
        hqBranch: hq
          ? { id: hq._id.toString(), code: hq.code, name: hq.name, city: hq.city }
          : null,
        operationalBranchCount,
      },
    };
  }

  async initializeNetwork(adminUserId: string, dto: InitNetworkDto) {
    const existing = await this.branchModel.findOne({ branchType: 'hq' });
    if (existing) throw new ConflictException('Network is already initialized');

    const adminObjectId = new Types.ObjectId(adminUserId);
    const hq = await this.branchModel.create({
      code: dto.code,
      name: dto.name,
      branchType: 'hq',
      line1: dto.line1,
      city: dto.city,
      province: dto.province,
      partnerUserId: adminObjectId,
      managerUserId: adminObjectId,
      maxActiveOrders: 0,
      maxWeightCapacityKg: 0,
      dailyQuotaOrders: 0,
      dailyQuotaWeightKg: 0,
      serviceRadiusKm: 0,
      machines: [],
      isActive: true,
      location: { type: 'Point', coordinates: dto.coordinates },
    });

    return {
      success: true,
      data: { hqBranchId: hq._id.toString(), code: hq.code, name: hq.name },
    };
  }

  async createSetupBranch(adminUserId: string, dto: CreateSetupBranchDto) {
    const hq = await this.branchModel.findOne({ branchType: 'hq' });
    if (!hq) throw new BadRequestException('Network not initialized — create the HQ branch first via /admin/setup/init');

    const existing = await this.branchModel.findOne({ code: dto.code });
    if (existing) throw new BadRequestException('Branch code already exists');

    const adminObjectId = new Types.ObjectId(adminUserId);
    const parentId = hq._id;

    const DEFAULT_MACHINES = [
      { id: 'w1', label: 'Washer 1', machineType: 'washer', status: 'active', capacityKg: 15 },
      { id: 'w2', label: 'Washer 2', machineType: 'washer', status: 'active', capacityKg: 15 },
      { id: 'd1', label: 'Dryer 1', machineType: 'dryer', status: 'active', capacityKg: 20 },
      { id: 'f1', label: 'Folding station', machineType: 'folder', status: 'active', capacityKg: 10 },
    ];

    const branch = await this.branchModel.create({
      code: dto.code,
      name: dto.name,
      branchType: dto.branchType,
      parentBranchId: parentId,
      line1: dto.line1,
      city: dto.city,
      province: dto.province,
      partnerUserId: adminObjectId,
      managerUserId: adminObjectId,
      maxActiveOrders: dto.maxActiveOrders ?? 20,
      maxWeightCapacityKg: dto.maxWeightCapacityKg ?? 200,
      dailyQuotaOrders: 25,
      dailyQuotaWeightKg: 200,
      serviceRadiusKm: dto.serviceRadiusKm ?? 12,
      commissionRate: dto.commissionRate ?? 0.20,
      machines: DEFAULT_MACHINES,
      isActive: true,
      location: { type: 'Point', coordinates: dto.coordinates },
    });

    return {
      success: true,
      data: { branchId: branch._id.toString(), code: branch.code, name: branch.name },
    };
  }
}
