import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import { isShopAssignedStatus, rankRidersForDelivery, rankRidersForPickup } from '@lunara/utils';
import { Address, AddressDocument } from '../addresses/schemas/address.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { User, UserDocument } from '../users/schemas/user.schema';
import { RiderNotificationService } from './rider-notification.service';
import { Rider, RiderDocument } from './schemas/rider.schema';

function phoneVerificationHint(phone?: string) {
  if (!phone) return '0000';
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-4) || '0000';
}

@Injectable()
export class RiderAssignmentService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Address.name) private addressModel: Model<AddressDocument>,
    private riderNotificationService: RiderNotificationService,
    private trackingGateway: TrackingGateway,
  ) {}

  async suggestPickupRider(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    this.assertReadyForPickupAssignment(order);

    const address = await this.addressModel.findById(order.pickupAddressId);
    if (!address) throw new NotFoundException('Pickup address not found');

    const riders = await this.riderModel.find().limit(50);
    const riderUsers = await this.userModel
      .find({ _id: { $in: riders.map((r) => r.userId) } })
      .select('email');

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const inputs = await Promise.all(
      riders.map(async (r) => {
        const uid = r.userId.toString();
        const [activePickup, activeDelivery, completed] = await Promise.all([
          this.orderModel.countDocuments({
            pickupRiderId: r.userId,
            status: { $in: [OrderStatus.RIDER_ASSIGNED_PICKUP, OrderStatus.RIDER_ASSIGNED] },
          }),
          this.orderModel.countDocuments({
            deliveryRiderId: r.userId,
            status: OrderStatus.OUT_FOR_DELIVERY,
          }),
          this.orderModel.countDocuments({
            pickupRiderId: r.userId,
            status: { $in: [OrderStatus.PICKED_UP, OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
            updatedAt: { $gte: since },
          }),
        ]);
        const coords = r.currentLocation?.coordinates;
        return {
          userId: uid,
          email: riderUsers.find((u) => u._id.toString() === uid)?.email,
          isOnline: r.isOnline,
          activePickupTasks: activePickup,
          activeDeliveryTasks: activeDelivery,
          completedPickups30d: completed,
          riderLng: coords?.[0],
          riderLat: coords?.[1],
        };
      }),
    );

    const suggestions = rankRidersForPickup(
      inputs,
      address.city,
      address.latitude,
      address.longitude,
    );

    const top = suggestions.find((s) => s.isRecommended) ?? suggestions[0];
    if (top) {
      order.suggestedPickupRiderId = new Types.ObjectId(top.userId);
      order.suggestedPickupRiderAt = new Date();
      await order.save();
    }

    return {
      success: true,
      data: {
        orderId,
        customerLocation: {
          line1: address.line1,
          city: address.city,
          province: address.province,
        },
        suggestions,
        suggestedRiderId: top?.userId ?? null,
        mode: 'auto_suggest_admin_confirm',
      },
    };
  }

  async confirmSuggestedPickupRider(orderId: string, adminUserId: string, riderId?: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const pick =
      riderId ??
      order.suggestedPickupRiderId?.toString() ??
      (await this.suggestPickupRider(orderId)).data.suggestedRiderId;

    if (!pick) {
      throw new BadRequestException('No rider suggestion available — assign manually or go online riders');
    }

    return this.assignPickupRider(orderId, pick, adminUserId, 'confirmed_suggestion');
  }

  async assignPickupRider(
    orderId: string,
    riderUserId: string,
    assignedByUserId?: string,
    source: 'admin_direct' | 'confirmed_suggestion' = 'admin_direct',
  ) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    this.assertReadyForPickupAssignment(order);

    if (order.pickupRiderId) {
      throw new BadRequestException('Pickup rider already assigned');
    }

    const rider = await this.riderModel.findOne({ userId: new Types.ObjectId(riderUserId) });
    if (!rider) throw new NotFoundException('Rider not found');

    const customer = await this.userModel.findById(order.customerId).select('phone');
    const now = new Date();
    order.pickupRiderId = new Types.ObjectId(riderUserId);
    order.status = OrderStatus.RIDER_ASSIGNED_PICKUP;
    order.pickupRiderAssignedBy = assignedByUserId
      ? new Types.ObjectId(assignedByUserId)
      : undefined;
    if (!order.pickup) order.pickup = {};
    order.pickup.acceptedAt = now;
    order.pickup.verificationHint = phoneVerificationHint(customer?.phone);
    order.statusHistory.push({
      status: OrderStatus.RIDER_ASSIGNED_PICKUP,
      timestamp: now,
      note:
        source === 'confirmed_suggestion'
          ? 'Pickup rider assigned (admin confirmed system suggestion)'
          : 'Pickup rider assigned by Lunara operations',
      updatedBy: assignedByUserId,
    });
    await order.save();

    await this.notifyRiderPickupAssigned(order, riderUserId);

    this.trackingGateway.emitOrderStatus(orderId, OrderStatus.RIDER_ASSIGNED_PICKUP);
    this.trackingGateway.emitOrderEvent(orderId, 'riderAssignedPickup', {
      message: 'A pickup rider has been assigned to your order',
      riderId: riderUserId,
    });
    this.trackingGateway.emitDispatchQueueUpdated({
      reason: 'pickup_rider_assigned',
      orderId,
    });

    return {
      success: true,
      data: {
        orderId,
        status: order.status,
        riderUserId,
        branchName: order.branchName,
        scheduledPickupAt: order.scheduledPickupAt,
      },
    };
  }

  private assertReadyForPickupAssignment(order: OrderDocument) {
    if (!order.branchId || order.dispatchStatus !== 'dispatched') {
      throw new BadRequestException('Assign a laundry shop before assigning a pickup rider');
    }
    if (!isShopAssignedStatus(order.status)) {
      throw new BadRequestException(
        `Order must be shop-assigned (current: ${order.status})`,
      );
    }
  }

  async notifyAwaitingDeliveryDispatch(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.READY_FOR_DELIVERY) {
      throw new BadRequestException(
        `Order must be ready for delivery (current: ${order.status})`,
      );
    }
    if (order.deliveryRiderId) {
      throw new BadRequestException('Delivery rider already assigned');
    }

    const now = new Date();
    if (!order.awaitingDeliveryDispatchAt) {
      order.awaitingDeliveryDispatchAt = now;
    }
    if (!order.deliveryRequestedAt) {
      order.deliveryRequestedAt = now;
    }
    await order.save();

    this.trackingGateway.emitAdminDispatcherAlert({
      type: 'awaiting_delivery_rider',
      orderId,
      status: order.status,
      branchName: order.branchName,
      bookingType: order.bookingType,
      message: 'Order ready for delivery — assign delivery rider',
    });
    this.trackingGateway.emitDispatchQueueUpdated({
      reason: 'awaiting_delivery_rider',
      orderId,
    });

    this.trackingGateway.emitOrderEvent(orderId, 'awaitingDeliveryDispatch', {
      message: 'Your laundry is ready. Lunara is assigning a delivery rider.',
      branchName: order.branchName,
    });

    return {
      success: true,
      data: {
        orderId,
        status: order.status,
        awaitingDeliveryDispatchAt: order.awaitingDeliveryDispatchAt,
      },
    };
  }

  async suggestDeliveryRider(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    this.assertReadyForDeliveryAssignment(order);

    const address = await this.addressModel.findById(order.deliveryAddressId);
    if (!address) throw new NotFoundException('Delivery address not found');

    const riders = await this.riderModel.find().limit(50);
    const riderUsers = await this.userModel
      .find({ _id: { $in: riders.map((r) => r.userId) } })
      .select('email');

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const inputs = await Promise.all(
      riders.map(async (r) => {
        const uid = r.userId.toString();
        const [activePickup, activeDelivery, completed] = await Promise.all([
          this.orderModel.countDocuments({
            pickupRiderId: r.userId,
            status: {
              $in: [
                OrderStatus.RIDER_ASSIGNED_PICKUP,
                OrderStatus.RIDER_ASSIGNED,
                OrderStatus.PICKED_UP,
                OrderStatus.IN_TRANSIT_TO_SHOP,
              ],
            },
          }),
          this.orderModel.countDocuments({
            deliveryRiderId: r.userId,
            status: {
              $in: [OrderStatus.RIDER_ASSIGNED_DELIVERY, OrderStatus.OUT_FOR_DELIVERY],
            },
          }),
          this.orderModel.countDocuments({
            deliveryRiderId: r.userId,
            status: { $in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
            updatedAt: { $gte: since },
          }),
        ]);
        const coords = r.currentLocation?.coordinates;
        return {
          userId: uid,
          email: riderUsers.find((u) => u._id.toString() === uid)?.email,
          isOnline: r.isOnline,
          activePickupTasks: activePickup,
          activeDeliveryTasks: activeDelivery,
          completedPickups30d: completed,
          riderLng: coords?.[0],
          riderLat: coords?.[1],
        };
      }),
    );

    const suggestions = rankRidersForDelivery(
      inputs,
      address.city,
      address.latitude,
      address.longitude,
    );

    const top = suggestions.find((s) => s.isRecommended) ?? suggestions[0];
    if (top) {
      order.suggestedDeliveryRiderId = new Types.ObjectId(top.userId);
      order.suggestedDeliveryRiderAt = new Date();
      await order.save();
    }

    return {
      success: true,
      data: {
        orderId,
        customerLocation: {
          line1: address.line1,
          city: address.city,
          province: address.province,
        },
        suggestions,
        suggestedRiderId: top?.userId ?? null,
        mode: 'auto_suggest_admin_confirm',
      },
    };
  }

  async confirmSuggestedDeliveryRider(
    orderId: string,
    adminUserId: string,
    riderId?: string,
  ) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const pick =
      riderId ??
      order.suggestedDeliveryRiderId?.toString() ??
      (await this.suggestDeliveryRider(orderId)).data.suggestedRiderId;

    if (!pick) {
      throw new BadRequestException(
        'No rider suggestion available — assign manually or ensure riders are online',
      );
    }

    return this.assignDeliveryRider(orderId, pick, adminUserId, 'confirmed_suggestion');
  }

  async assignDeliveryRider(
    orderId: string,
    riderUserId: string,
    assignedByUserId?: string,
    source: 'admin_direct' | 'confirmed_suggestion' = 'admin_direct',
  ) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    this.assertReadyForDeliveryAssignment(order);

    if (order.deliveryRiderId) {
      throw new BadRequestException('Delivery rider already assigned');
    }

    const rider = await this.riderModel.findOne({ userId: new Types.ObjectId(riderUserId) });
    if (!rider) throw new NotFoundException('Rider not found');

    const now = new Date();
    order.deliveryRiderId = new Types.ObjectId(riderUserId);
    order.deliveryRiderAssignedBy = assignedByUserId
      ? new Types.ObjectId(assignedByUserId)
      : undefined;
    order.status = OrderStatus.RIDER_ASSIGNED_DELIVERY;
    if (!order.delivery) order.delivery = {};
    order.delivery.acceptedAt = now;
    order.statusHistory.push({
      status: OrderStatus.RIDER_ASSIGNED_DELIVERY,
      timestamp: now,
      note:
        source === 'confirmed_suggestion'
          ? 'Delivery rider assigned (admin confirmed suggestion)'
          : 'Delivery rider assigned by Lunara operations',
      updatedBy: assignedByUserId,
    });
    await order.save();

    await this.notifyRiderDeliveryAssigned(order, riderUserId);

    this.trackingGateway.emitOrderStatus(orderId, OrderStatus.RIDER_ASSIGNED_DELIVERY);
    this.trackingGateway.emitOrderEvent(orderId, 'riderAssignedDelivery', {
      message: 'A delivery rider has been assigned to your order',
      riderId: riderUserId,
    });
    this.trackingGateway.emitDispatchQueueUpdated({
      reason: 'delivery_rider_assigned',
      orderId,
    });

    return {
      success: true,
      data: {
        orderId,
        status: order.status,
        riderUserId,
        branchName: order.branchName,
      },
    };
  }

  private assertReadyForDeliveryAssignment(order: OrderDocument) {
    if (order.status !== OrderStatus.READY_FOR_DELIVERY) {
      throw new BadRequestException(
        `Order must be ready for delivery (current: ${order.status})`,
      );
    }
    if (!order.branchId || order.dispatchStatus !== 'dispatched') {
      throw new BadRequestException('Order must be dispatched to a shop before delivery assignment');
    }
  }

  private async notifyRiderDeliveryAssigned(order: OrderDocument, riderUserId: string) {
    await this.riderNotificationService.notifyDeliveryAssigned(riderUserId, order);
  }

  private async notifyRiderPickupAssigned(order: OrderDocument, riderUserId: string) {
    await this.riderNotificationService.notifyPickupAssigned(riderUserId, order);
  }
}
