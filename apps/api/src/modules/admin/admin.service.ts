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
import {
  buildOrderPaymentSummary,
  loadLatestOrderPaymentsByOrderId,
} from '../payments/payment-summary';

const COMPLETED = [OrderStatus.DELIVERED, OrderStatus.COMPLETED];
const ACTIVE_ORDER_STATUSES = Object.values(OrderStatus).filter(
  (s) => !COMPLETED.includes(s) && s !== OrderStatus.CANCELLED && s !== OrderStatus.REFUNDED,
);

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(Promotion.name) private promotionModel: Model<PromotionDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    private supportService: SupportService,
    private branchesService: BranchesService,
    private branchManagementService: BranchManagementService,
    private promotionsService: PromotionsService,
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
    const paymentsByOrderId = await loadLatestOrderPaymentsByOrderId(
      this.paymentModel,
      items.map((o) => o._id),
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
