import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';
import { Address, AddressDocument } from '../addresses/schemas/address.schema';
import { BranchesService } from '../branches/branches.service';

const PICKUP_ASSIGN_STATUSES = [OrderStatus.SHOP_ASSIGNED, OrderStatus.CONFIRMED];

const PICKUP_ACTIVE_STATUSES = [
  OrderStatus.RIDER_ASSIGNED_PICKUP,
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT_TO_SHOP,
];

const DELIVERY_ACTIVE_STATUSES = [
  OrderStatus.RIDER_ASSIGNED_DELIVERY,
  OrderStatus.OUT_FOR_DELIVERY,
];

@Injectable()
export class AdminDispatchService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(Address.name) private addressModel: Model<AddressDocument>,
    private branchesService: BranchesService,
  ) {}

  async getDispatchDashboard() {
    const [incomingOrders, shopCapacity, riderBoard] = await Promise.all([
      this.buildIncomingOrdersQueue(),
      this.branchesService.getShopCapacityBoard(),
      this.buildRiderBoard(),
    ]);

    return {
      success: true,
      data: {
        incomingOrders,
        shopCapacityBoard: shopCapacity.data.shops,
        riderBoard,
        counts: {
          incoming: incomingOrders.length,
          needsShop: incomingOrders.filter((o) => o.canAssignShop).length,
          needsPickupRider: incomingOrders.filter((o) => o.canAssignPickupRider).length,
          needsDeliveryRider: incomingOrders.filter((o) => o.canAssignDeliveryRider).length,
        },
      },
    };
  }

  private async buildIncomingOrdersQueue() {
    const orders = await this.orderModel
      .find({
        status: {
          $nin: [OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.COMPLETED],
        },
        $or: [
          { status: OrderStatus.PENDING_DISPATCH },
          {
            status: { $in: PICKUP_ASSIGN_STATUSES },
            $or: [{ pickupRiderId: { $exists: false } }, { pickupRiderId: null }],
          },
          {
            status: OrderStatus.READY_FOR_DELIVERY,
            $or: [{ deliveryRiderId: { $exists: false } }, { deliveryRiderId: null }],
          },
        ],
      })
      .sort({ createdAt: 1 })
      .limit(100);

    const customerIds = orders.map((o) => o.customerId);
    const addressIds = orders.map((o) => o.pickupAddressId).filter(Boolean);

    const [customers, addresses] = await Promise.all([
      this.userModel.find({ _id: { $in: customerIds } }).select('email phone'),
      this.addressModel.find({ _id: { $in: addressIds } }).select('city province line1'),
    ]);

    const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));
    const addressMap = new Map(addresses.map((a) => [a._id.toString(), a]));

    return orders.map((order) => {
      const cid = order.customerId.toString();
      const customer = customerMap.get(cid);
      const address = addressMap.get(order.pickupAddressId);
      const customerLabel = customer?.email ?? customer?.phone ?? `…${cid.slice(-6)}`;

      return {
        orderId: order._id.toString(),
        orderLabel: order._id.toString().slice(-8).toUpperCase(),
        customer: customerLabel,
        area: address ? `${address.city}${address.province ? `, ${address.province}` : ''}` : '—',
        weightKg: order.estimatedWeightKg ?? 5,
        status: order.status,
        statusLabel: order.status.replace(/_/g, ' '),
        branchName: order.branchName,
        bookingType: order.bookingType,
        scheduledPickupAt: order.scheduledPickupAt,
        partnerAcceptedAt: order.partnerAcceptedAt,
        canAssignShop: order.status === OrderStatus.PENDING_DISPATCH,
        awaitingPartnerAccept:
          !!order.branchId &&
          !order.partnerAcceptedAt &&
          (PICKUP_ASSIGN_STATUSES.includes(order.status as OrderStatus) ||
            order.status === OrderStatus.READY_FOR_DELIVERY),
        canAssignPickupRider:
          !!order.partnerAcceptedAt &&
          PICKUP_ASSIGN_STATUSES.includes(order.status as OrderStatus) &&
          !order.pickupRiderId,
        canAssignDeliveryRider:
          !!order.partnerAcceptedAt &&
          order.status === OrderStatus.READY_FOR_DELIVERY &&
          !order.deliveryRiderId,
        priority: this.incomingPriority(order.status),
      };
    });
  }

  private incomingPriority(status: string): number {
    if (status === OrderStatus.PENDING_DISPATCH) return 1;
    if (status === OrderStatus.READY_FOR_DELIVERY) return 2;
    return 3;
  }

  private async buildRiderBoard() {
    const riders = await this.riderModel.find().sort({ isOnline: -1, updatedAt: -1 });
    const users = await this.userModel
      .find({ _id: { $in: riders.map((r) => r.userId) } })
      .select('email phone');

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const activeOrders = await this.orderModel.find({
      status: {
        $in: [...PICKUP_ACTIVE_STATUSES, ...DELIVERY_ACTIVE_STATUSES],
      },
      $or: [
        { pickupRiderId: { $exists: true, $ne: null } },
        { deliveryRiderId: { $exists: true, $ne: null } },
      ],
    });

    const board = riders.map((r) => {
      const uid = r.userId.toString();
      const user = userMap.get(uid);
      const name = user?.email ?? user?.phone ?? `Rider ${uid.slice(-4)}`;

      const deliveryOrder = activeOrders.find(
        (o) =>
          o.deliveryRiderId?.toString() === uid &&
          DELIVERY_ACTIVE_STATUSES.includes(o.status as OrderStatus),
      );
      const pickupOrder = activeOrders.find(
        (o) =>
          o.pickupRiderId?.toString() === uid &&
          PICKUP_ACTIVE_STATUSES.includes(o.status as OrderStatus),
      );

      let boardStatus: 'Available' | 'Pickup' | 'Delivery' | 'Offline' = 'Offline';
      if (r.isOnline) {
        if (deliveryOrder) boardStatus = 'Delivery';
        else if (pickupOrder) boardStatus = 'Pickup';
        else boardStatus = 'Available';
      }

      return {
        riderId: r._id.toString(),
        userId: uid,
        rider: name,
        boardStatus,
        isOnline: r.isOnline,
        activeOrderId: (deliveryOrder ?? pickupOrder)?._id.toString(),
        activeOrderStatus: (deliveryOrder ?? pickupOrder)?.status,
        vehicleType: r.vehicleType,
      };
    });

    return board;
  }
}
