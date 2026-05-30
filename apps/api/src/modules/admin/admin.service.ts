import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus, UserRole } from '@lunara/types';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';
import {
  Promotion,
  PromotionDocument,
} from './schemas/promotion.schema';
import { computePickupSla } from '@lunara/utils';
import { BranchesService } from '../branches/branches.service';
import { SupportService } from '../support/support.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

const COMPLETED = [OrderStatus.DELIVERED, OrderStatus.COMPLETED];
const ACTIVE_ORDER_STATUSES = Object.values(OrderStatus).filter(
  (s) => !COMPLETED.includes(s) && s !== OrderStatus.CANCELLED && s !== OrderStatus.REFUNDED,
);

const DEFAULT_PROMOTIONS = [
  {
    code: 'WELCOME10',
    title: 'Welcome discount',
    description: '10% off first order',
    discountType: 'percent' as const,
    discountValue: 10,
    minOrderAmount: 200,
    isActive: true,
  },
  {
    code: 'FREEDEL50',
    title: 'Free delivery',
    description: '₱50 off delivery fee',
    discountType: 'fixed' as const,
    discountValue: 50,
    minOrderAmount: 500,
    isActive: true,
  },
];

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(Promotion.name) private promotionModel: Model<PromotionDocument>,
    private supportService: SupportService,
    private branchesService: BranchesService,
  ) {}

  async ensureSeeded() {
    await this.supportService.ensureSeeded();

    const promoCount = await this.promotionModel.countDocuments();
    if (promoCount === 0) await this.promotionModel.insertMany(DEFAULT_PROMOTIONS);
  }

  async getDashboard() {
    await this.ensureSeeded();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

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
      this.orderModel.find({
        status: { $in: COMPLETED },
        updatedAt: { $gte: startOfMonth },
      }),
      this.orderModel.find().sort({ updatedAt: -1 }).limit(6),
    ]);

    const monthRevenue = monthCompleted.reduce((s, o) => s + o.total, 0);

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
        },
        recentOrders: recentOrders.map((o) => ({
          _id: o._id.toString(),
          status: o.status,
          bookingType: o.bookingType,
          total: o.total,
          updatedAt: o.updatedAt,
        })),
      },
    };
  }

  async getOrders(status?: string, limit = 50) {
    const filter = status ? { status } : {};
    const items = await this.orderModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit);

    const customers = await this.userModel
      .find({ _id: { $in: items.map((o) => o.customerId).filter(Boolean) } })
      .select('email phone');

    const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));

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
          return {
            _id: o._id.toString(),
            status: o.status,
            bookingType: o.bookingType,
            total: o.total,
            customerId: o.customerId?.toString(),
            customerEmail: customerMap.get(o.customerId?.toString() ?? '')?.email,
            partnerId: o.partnerId?.toString(),
            branchName: o.branchName,
            dispatchStatus: o.dispatchStatus,
            operationsConflict: o.operationsConflict,
            createdAt: o.createdAt,
            updatedAt: o.updatedAt,
            slaStatus: sla.status,
            slaLabel: sla.label,
          };
        }),
        statusCounts: await this.orderStatusCounts(),
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
        return {
          _id: r._id.toString(),
          userId: uid,
          email: user?.email,
          phone: user?.phone,
          isActive: user?.isActive ?? true,
          isOnline: r.isOnline,
          vehicleType: r.vehicleType,
          totalEarnings: r.totalEarnings,
          todayEarnings: r.todayEarnings,
          activeTasks: (deliveryMap.get(uid) ?? 0) + (pickupMap.get(uid) ?? 0),
        };
      }),
    };
  }

  async getShops() {
    const partners = await this.userModel
      .find({ role: UserRole.PARTNER })
      .select('email phone isActive createdAt')
      .sort({ email: 1 });

    const orderStats = await this.orderModel.aggregate([
      { $match: { partnerId: { $exists: true, $ne: null } } },
      { $group: { _id: '$partnerId', totalOrders: { $sum: 1 }, revenue: { $sum: '$total' } } },
    ]);
    const statsMap = new Map(
      orderStats.map((s) => [s._id.toString(), { totalOrders: s.totalOrders, revenue: s.revenue }]),
    );

    const staffCount = await this.userModel.countDocuments({ role: UserRole.STAFF, isActive: true });

    return {
      success: true,
      data: {
        shops: partners.map((p) => ({
          _id: p._id.toString(),
          email: p.email,
          phone: p.phone,
          isActive: p.isActive,
          staffCount,
          totalOrders: statsMap.get(p._id.toString())?.totalOrders ?? 0,
          revenue: statsMap.get(p._id.toString())?.revenue ?? 0,
        })),
      },
    };
  }

  async getRevenue() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

    const [todayOrders, monthOrders, allCompleted] = await Promise.all([
      this.orderModel.find({ status: { $in: COMPLETED }, updatedAt: { $gte: startOfDay } }),
      this.orderModel.find({ status: { $in: COMPLETED }, updatedAt: { $gte: startOfMonth } }),
      this.orderModel.countDocuments({ status: { $in: COMPLETED } }),
    ]);

    const daily = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfDay);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayOrders = await this.orderModel.find({
        status: { $in: COMPLETED },
        updatedAt: { $gte: d, $lt: next },
      });
      daily.push({
        date: d.toISOString().slice(0, 10),
        revenue: dayOrders.reduce((s, o) => s + o.total, 0),
        orders: dayOrders.length,
      });
    }

    const byService = await this.orderModel.aggregate([
      { $match: { status: { $in: COMPLETED }, updatedAt: { $gte: startOfMonth } } },
      { $group: { _id: '$bookingType', revenue: { $sum: '$total' }, count: { $sum: 1 } } },
    ]);

    return {
      success: true,
      data: {
        today: todayOrders.reduce((s, o) => s + o.total, 0),
        month: monthOrders.reduce((s, o) => s + o.total, 0),
        todayOrders: todayOrders.length,
        monthOrders: monthOrders.length,
        allTimeCompleted: allCompleted,
        daily,
        byService: byService.map((p) => ({
          service: p._id ?? 'unknown',
          revenue: p.revenue,
          count: p.count,
        })),
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
    return { success: true, data: items.map((p) => this.serializePromotion(p)) };
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
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
