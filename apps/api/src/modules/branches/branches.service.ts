import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import {
  distanceKm,
  estimateTurnaroundHours,
  formatDistanceKm,
  buildPartnerCoverageNotice,
  rankBranchesForDispatch,
  resolveCoordinates,
  scoreBranchPerformance,
  validateServiceArea,
  type PartnerCoverageInfo,
} from '@lunara/utils';
import { Address, AddressDocument } from '../addresses/schemas/address.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Branch, BranchDocument } from './schemas/branch.schema';

const CAPACITY_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.PENDING_DISPATCH,
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
  OrderStatus.OUT_FOR_DELIVERY,
];

const DEFAULT_BRANCHES = [
  {
    code: 'MKT-01',
    name: 'Lunara Makati',
    line1: '123 Ayala Ave',
    city: 'Makati',
    province: 'Metro Manila',
    coordinates: [121.0244, 14.5547] as [number, number],
    maxActiveOrders: 25,
    maxWeightCapacityKg: 200,
    serviceRadiusKm: 12,
  },
  {
    code: 'QC-01',
    name: 'Lunara Quezon City',
    line1: '45 Timog Ave',
    city: 'Quezon City',
    province: 'Metro Manila',
    coordinates: [121.0437, 14.676] as [number, number],
    maxActiveOrders: 20,
    maxWeightCapacityKg: 200,
    serviceRadiusKm: 14,
  },
  {
    code: 'BGC-01',
    name: 'Lunara BGC',
    line1: '8th Ave cor 28th St',
    city: 'Taguig',
    province: 'Metro Manila',
    coordinates: [121.0509, 14.5176] as [number, number],
    maxActiveOrders: 18,
    maxWeightCapacityKg: 300,
    serviceRadiusKm: 10,
  },
];

@Injectable()
export class BranchesService {
  constructor(
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Address.name) private addressModel: Model<AddressDocument>,
    private trackingGateway: TrackingGateway,
  ) {}

  operationalBranchFilter(partnerUserId?: Types.ObjectId) {
    const filter: Record<string, unknown> = { isActive: true, branchType: { $ne: 'hq' as const } };
    if (partnerUserId) filter.partnerUserId = partnerUserId;
    return filter;
  }

  async ensureSeeded() {
    const partner = await this.userModel.findOne({ email: 'partner@lunara.dev' });
    if (!partner) return;

    const opCount = await this.branchModel.countDocuments({
      $or: [{ branchType: { $ne: 'hq' } }, { branchType: { $exists: false } }],
    });
    if (opCount > 0) return;

    for (const b of DEFAULT_BRANCHES) {
      await this.branchModel.create({
        code: b.code,
        name: b.name,
        branchType: 'partner_shop',
        line1: b.line1,
        city: b.city,
        province: b.province,
        partnerUserId: partner._id,
        managerUserId: partner._id,
        maxActiveOrders: b.maxActiveOrders,
        maxWeightCapacityKg: b.maxWeightCapacityKg,
        dailyQuotaOrders: b.maxActiveOrders,
        dailyQuotaWeightKg: b.maxWeightCapacityKg,
        serviceRadiusKm: b.serviceRadiusKm,
        isActive: true,
        location: { type: 'Point', coordinates: b.coordinates },
      });
    }
  }

  async listBranches() {
    await this.ensureSeeded();
    const branches = await this.branchModel
      .find(this.operationalBranchFilter())
      .sort({ name: 1 });
    const withCapacity = await Promise.all(
      branches.map(async (b) => this.serializeBranchWithCapacity(b)),
    );
    return { success: true, data: withCapacity };
  }

  /** Marketing-safe listing for the public website — active branches only, no internal fields. */
  async listPublicBranches() {
    await this.ensureSeeded();
    const branches = await this.branchModel
      .find(this.operationalBranchFilter())
      .select('name city province serviceRadiusKm')
      .sort({ name: 1 });
    return {
      success: true,
      data: branches.map((b) => ({
        name: b.name,
        city: b.city,
        province: b.province,
        radiusKm: b.serviceRadiusKm,
      })),
    };
  }

  async findNearestForAddress(
    address: {
      city: string;
      latitude?: number;
      longitude?: number;
    },
    partnerUserId?: Types.ObjectId,
  ) {
    await this.ensureSeeded();
    const customerCoords = resolveCoordinates(
      address.city,
      address.latitude,
      address.longitude,
    );

    const branches = await this.branchModel.find(this.operationalBranchFilter(partnerUserId));
    if (branches.length === 0) {
      throw new BadRequestException('No laundry branches available');
    }

    const ranked = await Promise.all(
      branches.map(async (branch) => {
        const [lng, lat] = branch.location.coordinates;
        const dist = distanceKm(customerCoords, [lng, lat]);
        const activeOrders = await this.countActiveOrders(branch._id);
        const capacityAvailable = activeOrders < branch.maxActiveOrders;
        const withinRadius = dist <= branch.serviceRadiusKm;
        return {
          branch,
          distanceKm: dist,
          activeOrders,
          capacityAvailable,
          withinRadius,
        };
      }),
    );

    ranked.sort((a, b) => a.distanceKm - b.distanceKm);

    return {
      customerCoordinates: { longitude: customerCoords[0], latitude: customerCoords[1] },
      ranked: ranked.map((r) => ({
        branchId: r.branch._id.toString(),
        code: r.branch.code,
        name: r.branch.name,
        city: r.branch.city,
        distanceKm: Math.round(r.distanceKm * 10) / 10,
        distanceLabel: formatDistanceKm(r.distanceKm),
        activeOrders: r.activeOrders,
        maxActiveOrders: r.branch.maxActiveOrders,
        capacityAvailable: r.capacityAvailable,
        withinRadius: r.withinRadius,
        isNearest: false,
      })),
    };
  }

  async evaluatePartnerCoverageForAddress(address: {
    line1?: string;
    city: string;
    province: string;
    postalCode: string;
    latitude?: number;
    longitude?: number;
  }): Promise<PartnerCoverageInfo> {
    const area = validateServiceArea({
      line1: address.line1 ?? '',
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
    });

    if (!area.valid) {
      return buildPartnerCoverageNotice({
        inServiceArea: false,
        hasPartnerNearby: false,
        branchAssigned: false,
      });
    }

    await this.ensureSeeded();
    const branches = await this.branchModel.find(this.operationalBranchFilter());
    if (branches.length === 0) {
      return buildPartnerCoverageNotice({
        inServiceArea: true,
        hasPartnerNearby: false,
        branchAssigned: false,
      });
    }

    const nearest = await this.findNearestForAddress({
      city: address.city,
      latitude: address.latitude,
      longitude: address.longitude,
    });

    const hasPartnerNearby = nearest.ranked.some(
      (r) => r.withinRadius && r.capacityAvailable,
    );

    return buildPartnerCoverageNotice({
      inServiceArea: true,
      hasPartnerNearby,
      branchAssigned: false,
      nearestDistanceLabel: nearest.ranked[0]?.distanceLabel,
    });
  }

  async evaluatePartnerCoverageForAddressId(addressId: string) {
    const address = await this.addressModel.findById(addressId);
    if (!address) return null;
    return this.evaluatePartnerCoverageForAddress({
      line1: address.line1,
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      latitude: address.latitude,
      longitude: address.longitude,
    });
  }

  async findNearestByAddressId(userId: string, addressId: string) {
    const address = await this.addressModel.findOne({
      _id: addressId,
      userId: new Types.ObjectId(userId),
    });
    if (!address) throw new NotFoundException('Address not found');

    const nearest = await this.findNearestForAddress({
      city: address.city,
      latitude: address.latitude,
      longitude: address.longitude,
    });
    if (nearest.ranked.length > 0) nearest.ranked[0].isNearest = true;

    return {
      success: true,
      data: {
        ...nearest,
        note: 'Branches shown for reference. Lunara operations assigns your shop after payment.',
      },
    };
  }

  async countPendingDispatch() {
    return this.orderModel.countDocuments({
      status: OrderStatus.PENDING_DISPATCH,
    });
  }

  async getBranchPerformance(branchId: Types.ObjectId) {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const completed = await this.orderModel.find({
      branchId,
      status: { $in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
      updatedAt: { $gte: since },
    });

    const onTime = completed.filter((o) => {
      const due = o.slaPickupDueAt ?? o.scheduledPickupAt;
      const collected = o.pickup?.collectedAt;
      if (!collected || !due) return true;
      return collected.getTime() <= due.getTime() + 60 * 60 * 1000;
    });

    const onTimeRate =
      completed.length > 0 ? Math.round((onTime.length / completed.length) * 100) : 88;

    return scoreBranchPerformance(completed.length, onTimeRate);
  }

  async buildDispatchEvaluations(
    address: {
      line1: string;
      city: string;
      province: string;
      latitude?: number;
      longitude?: number;
    },
    bookingType: string,
    estimatedWeightKg: number,
    partnerUserId?: Types.ObjectId,
  ) {
    const nearest = await this.findNearestForAddress(address, partnerUserId);
    const branches = await this.branchModel.find(this.operationalBranchFilter(partnerUserId));

    const inputs = await Promise.all(
      nearest.ranked.map(async (r) => {
        const branch = branches.find((b) => b._id.toString() === r.branchId);
        const performance = branch
          ? await this.getBranchPerformance(branch._id)
          : scoreBranchPerformance(0, 85);

        return {
          branchId: r.branchId,
          code: r.code,
          name: r.name,
          city: r.city,
          distanceKm: r.distanceKm,
          distanceLabel: r.distanceLabel,
          withinRadius: r.withinRadius,
          activeOrders: r.activeOrders,
          maxActiveOrders: r.maxActiveOrders,
          capacityAvailable: r.capacityAvailable,
          isActive: branch?.isActive ?? true,
          performance,
          bookingType,
          estimatedWeightKg,
          customerLocation: {
            line1: address.line1,
            city: address.city,
            province: address.province,
            latitude: address.latitude,
            longitude: address.longitude,
          },
        };
      }),
    );

    return {
      customerLocation: {
        ...address,
        coordinates: nearest.customerCoordinates,
      },
      branchEvaluations: rankBranchesForDispatch(inputs),
    };
  }

  /**
   * Same ranking as buildDispatchEvaluations, scoped to a single partner's own branches —
   * used to auto-dispatch bookings placed through that partner's white-labeled app, which
   * must never enter the shared admin /dispatch queue.
   */
  async buildDispatchEvaluationsForPartner(
    address: {
      line1: string;
      city: string;
      province: string;
      latitude?: number;
      longitude?: number;
    },
    bookingType: string,
    estimatedWeightKg: number,
    partnerUserId: Types.ObjectId,
  ) {
    return this.buildDispatchEvaluations(address, bookingType, estimatedWeightKg, partnerUserId);
  }

  async getDispatchQueue() {
    await this.ensureSeeded();
    const orders = await this.orderModel
      .find({
        status: OrderStatus.PENDING_DISPATCH,
      })
      .sort({ createdAt: 1 })
      .limit(100);

    const customers = await this.userModel
      .find({ _id: { $in: orders.map((o) => o.customerId) } })
      .select('email phone');

    const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));

    const items = await Promise.all(
      orders.map(async (order) => {
        const address = await this.addressModel.findById(order.pickupAddressId);
        const evaluation = address
          ? await this.buildDispatchEvaluations(
              {
                line1: address.line1,
                city: address.city,
                province: address.province,
                latitude: address.latitude,
                longitude: address.longitude,
              },
              order.bookingType,
              order.estimatedWeightKg ?? 5,
            )
          : { customerLocation: null, branchEvaluations: [] };

        const recommended = evaluation.branchEvaluations.find((b) => b.isRecommended);

        return {
          _id: order._id.toString(),
          status: order.status,
          bookingType: order.bookingType,
          total: order.total,
          estimatedWeightKg: order.estimatedWeightKg,
          scheduledPickupAt: order.scheduledPickupAt,
          createdAt: order.createdAt,
          customerEmail: customerMap.get(order.customerId.toString())?.email,
          pickupAddress: address
            ? {
                line1: address.line1,
                city: address.city,
                province: address.province,
                latitude: address.latitude,
                longitude: address.longitude,
              }
            : null,
          customerLocation: evaluation.customerLocation,
          branchEvaluations: evaluation.branchEvaluations,
          recommendedBranchId: recommended?.branchId,
        };
      }),
    );

    return { success: true, data: { items, pendingCount: items.length } };
  }

  async getDispatchSuggestions(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PENDING_DISPATCH) {
      throw new BadRequestException('Order is not awaiting dispatch');
    }

    const address = await this.addressModel.findById(order.pickupAddressId);
    if (!address) throw new NotFoundException('Pickup address not found');

    const evaluation = await this.buildDispatchEvaluations(
      {
        line1: address.line1,
        city: address.city,
        province: address.province,
        latitude: address.latitude,
        longitude: address.longitude,
      },
      order.bookingType,
      order.estimatedWeightKg ?? 5,
    );

    return {
      success: true,
      data: {
        orderId: order._id.toString(),
        pickupAddress: {
          line1: address.line1,
          city: address.city,
          province: address.province,
        },
        customerLocation: evaluation.customerLocation,
        branchEvaluations: evaluation.branchEvaluations,
        evaluationCriteria: [
          'customer_location',
          'shop_capacity',
          'shop_performance',
          'shop_availability',
          'estimated_turnaround',
        ],
      },
    };
  }

  /**
   * Mutates and saves the order with shop-assignment fields, pushes status history,
   * and fires the tracking/dispatch websocket events. Shared by the admin manual-assign
   * path (adminDispatchOrder) and the partner auto-dispatch path (payments.service.ts
   * confirmOrder), which both end in the same SHOP_ASSIGNED state.
   */
  async applyShopAssignment(
    order: OrderDocument,
    branch: BranchDocument,
    opts: { dispatchedByUserId?: string; activeOrders: number; noteOverride?: string } = {
      activeOrders: 0,
    },
  ) {
    order.branchId = branch._id;
    order.branchCode = branch.code;
    order.branchName = branch.name;
    order.partnerId = branch.partnerUserId;
    const turnaround = estimateTurnaroundHours(
      order.bookingType,
      order.estimatedWeightKg ?? 5,
      opts.activeOrders,
    );

    order.status = OrderStatus.SHOP_ASSIGNED;
    order.dispatchStatus = 'dispatched';
    order.dispatchedAt = new Date();
    if (opts.dispatchedByUserId) order.dispatchedBy = new Types.ObjectId(opts.dispatchedByUserId);
    order.slaPickupDueAt = order.scheduledPickupAt;
    order.estimatedTurnaroundHours = turnaround.hours;
    order.statusHistory.push({
      status: OrderStatus.SHOP_ASSIGNED,
      timestamp: new Date(),
      note: opts.noteOverride ?? `Shop assigned: ${branch.name} (ETA ${turnaround.label})`,
    });
    await order.save();

    const orderId = order._id.toString();
    this.trackingGateway.emitOrderEvent(orderId, 'shopAssigned', {
      message: `Assigned to ${branch.name} — estimated turnaround ${turnaround.label}`,
      branchId: branch._id.toString(),
      branchName: branch.name,
    });
    this.trackingGateway.emitDispatchQueueUpdated({
      reason: 'shop_assigned',
      orderId,
    });
    this.trackingGateway.emitPartnerPipelineUpdated({
      orderId,
      status: order.status,
      partnerId: order.partnerId?.toString(),
      branchId: order.branchId?.toString(),
    });

    return turnaround;
  }

  async adminDispatchOrder(orderId: string, branchId: string, adminUserId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== OrderStatus.PENDING_DISPATCH) {
      throw new BadRequestException('Only pending-dispatch (paid) orders can be assigned to a shop');
    }
    if (order.branchId) {
      throw new BadRequestException('Order already dispatched to a branch');
    }

    const branch = await this.branchModel.findById(branchId);
    if (!branch || !branch.isActive || branch.branchType === 'hq') {
      throw new NotFoundException('Branch not found');
    }

    const activeOrders = await this.countActiveOrders(branch._id);
    if (activeOrders >= branch.maxActiveOrders) {
      throw new BadRequestException(
        `${branch.name} is at capacity (${activeOrders}/${branch.maxActiveOrders})`,
      );
    }

    const turnaround = await this.applyShopAssignment(order, branch, {
      dispatchedByUserId: adminUserId,
      activeOrders,
    });

    return {
      success: true,
      data: {
        orderId: order._id.toString(),
        status: order.status,
        branchId: branch._id.toString(),
        branchCode: branch.code,
        branchName: branch.name,
        partnerUserId: branch.partnerUserId.toString(),
        estimatedTurnaroundHours: order.estimatedTurnaroundHours,
        estimatedTurnaroundLabel: turnaround.label,
        dispatchStatus: order.dispatchStatus,
        dispatchedAt: order.dispatchedAt,
      },
    };
  }

  /**
   * Finalizes a partner auto-dispatch that was pre-resolved at booking time (booking.service.ts
   * already picked the branch and stored branchId/partnerId on the order before payment).
   * Capacity is not re-checked as a hard gate here — checkout already blocked the booking if the
   * partner had no available branch, and money has already been captured by this point.
   */
  async finalizePreResolvedShopAssignment(order: OrderDocument) {
    if (!order.branchId) return;
    const branch = await this.branchModel.findById(order.branchId);
    if (!branch) return;

    const activeOrders = await this.countActiveOrders(branch._id);
    await this.applyShopAssignment(order, branch, {
      activeOrders,
      noteOverride: `Payment confirmed — auto-dispatched to partner shop ${branch.name}`,
    });
  }

  async getBranch(id: string) {
    const branch = await this.branchModel.findById(id);
    if (!branch) throw new NotFoundException('Branch not found');
    return { success: true, data: await this.serializeBranchWithCapacity(branch) };
  }

  async countActiveOrdersForBranch(branchId: Types.ObjectId) {
    return this.countActiveOrders(branchId);
  }

  async sumBranchWeightLoadKg(branchId: Types.ObjectId) {
    return this.sumBranchWeightLoadKgInternal(branchId);
  }

  private async countActiveOrders(branchId: Types.ObjectId) {
    return this.orderModel.countDocuments({
      branchId,
      status: { $in: CAPACITY_STATUSES },
    });
  }

  private async sumBranchWeightLoadKgInternal(branchId: Types.ObjectId) {
    const rows = await this.orderModel.aggregate([
      {
        $match: {
          branchId,
          status: { $in: CAPACITY_STATUSES },
        },
      },
      {
        $group: {
          _id: null,
          totalKg: {
            $sum: {
              $ifNull: [
                '$laundryProcessing.verifiedWeightKg',
                { $ifNull: ['$shopReceiving.verifiedWeightKg', { $ifNull: ['$estimatedWeightKg', 5] }] },
              ],
            },
          },
        },
      },
    ]);
    return Math.round((rows[0]?.totalKg ?? 0) * 10) / 10;
  }

  async getShopCapacityBoard() {
    await this.ensureSeeded();
    const branches = await this.branchModel
      .find(this.operationalBranchFilter())
      .sort({ name: 1 });
    const rows = await Promise.all(
      branches.map(async (b) => {
        const currentLoadKg = await this.sumBranchWeightLoadKgInternal(b._id);
        const capacityKg = b.maxWeightCapacityKg ?? 200;
        const utilizationPercent =
          capacityKg > 0 ? Math.min(100, Math.round((currentLoadKg / capacityKg) * 100)) : 0;
        return {
          branchId: b._id.toString(),
          shop: b.name,
          code: b.code,
          city: b.city,
          capacityKg,
          currentLoadKg,
          utilizationPercent,
          headroomKg: Math.max(0, Math.round((capacityKg - currentLoadKg) * 10) / 10),
          isOverCapacity: currentLoadKg >= capacityKg,
        };
      }),
    );
    return { success: true, data: { shops: rows } };
  }

  private async serializeBranchWithCapacity(branch: BranchDocument) {
    const activeOrders = await this.countActiveOrders(branch._id);
    const currentLoadKg = await this.sumBranchWeightLoadKgInternal(branch._id);
    const capacityKg = branch.maxWeightCapacityKg ?? 200;
    return {
      _id: branch._id.toString(),
      code: branch.code,
      name: branch.name,
      branchType: branch.branchType ?? 'partner_shop',
      parentBranchId: branch.parentBranchId?.toString(),
      line1: branch.line1,
      city: branch.city,
      province: branch.province,
      partnerUserId: branch.partnerUserId.toString(),
      managerUserId: branch.managerUserId?.toString(),
      maxActiveOrders: branch.maxActiveOrders,
      maxWeightCapacityKg: capacityKg,
      dailyQuotaOrders: branch.dailyQuotaOrders,
      dailyQuotaWeightKg: branch.dailyQuotaWeightKg,
      machineCount: branch.machines?.length ?? 0,
      currentLoadKg,
      serviceRadiusKm: branch.serviceRadiusKm,
      activeOrders,
      capacityAvailable: activeOrders < branch.maxActiveOrders,
      weightCapacityAvailable: currentLoadKg < capacityKg,
      location: {
        longitude: branch.location.coordinates[0],
        latitude: branch.location.coordinates[1],
      },
    };
  }
}
