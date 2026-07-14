import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import {
  isShopAssignedStatus,
  isWithinServiceRadius,
  rankRidersForDelivery,
  rankRidersForPickup,
} from '@lunara/utils';
import { Address, AddressDocument } from '../addresses/schemas/address.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { User, UserDocument } from '../users/schemas/user.schema';
import { RiderNotificationService } from './rider-notification.service';
import { RiderOfferPushService } from '../push/rider-offer-push.service';
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
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    private riderNotificationService: RiderNotificationService,
    private trackingGateway: TrackingGateway,
    private riderOfferPush: RiderOfferPushService,
  ) {}

  /**
   * If the order's branch has a default assigned rider and that rider is online, use them directly.
   * If the default rider is offline, restricts the candidate pool to online riders within the
   * branch's service radius (branches without a default rider are unaffected — pool stays as-is).
   */
  private async applyBranchDefaultRider(
    order: OrderDocument,
    riders: RiderDocument[],
  ): Promise<{ shortCircuitRiderId: string | null; riders: RiderDocument[] }> {
    if (!order.branchId) return { shortCircuitRiderId: null, riders };
    const branch = await this.branchModel.findById(order.branchId);
    if (!branch?.assignedRiderId) return { shortCircuitRiderId: null, riders };

    const defaultRider = await this.riderModel.findOne({ userId: branch.assignedRiderId });
    if (defaultRider?.isOnline) {
      return { shortCircuitRiderId: branch.assignedRiderId.toString(), riders };
    }

    const [branchLng, branchLat] = branch.location.coordinates;
    const filtered = riders.filter((r) => {
      const coords = r.currentLocation?.coordinates;
      return (
        r.isOnline &&
        isWithinServiceRadius(coords?.[1], coords?.[0], branchLat, branchLng, branch.serviceRadiusKm)
      );
    });
    return { shortCircuitRiderId: null, riders: filtered };
  }

  /**
   * Called right after an order becomes accepted at the shop. If the branch has an
   * assigned/default rider configured and that rider is online, assign them straight
   * away instead of leaving the order for the suggest/confirm flow. If the default rider
   * is offline, broadcast the pickup to other online riders instead of silently waiting
   * on them. Best-effort — a missing branch default or any assignment error just leaves
   * the order for manual/suggested assignment as before.
   */
  async autoAssignPickupRiderIfConfigured(orderId: string): Promise<boolean> {
    const order = await this.orderModel.findById(orderId);
    if (!order || !order.branchId || order.pickupRiderId) return false;

    const branch = await this.branchModel.findById(order.branchId);
    if (!branch?.assignedRiderId) return false;

    const rider = await this.riderModel.findOne({ userId: branch.assignedRiderId });
    if (!rider?.isOnline) {
      await this.broadcastPickupOffer(order);
      return false;
    }

    try {
      await this.assignPickupRider(
        orderId,
        branch.assignedRiderId.toString(),
        undefined,
        'branch_default_rider',
      );
      return true;
    } catch {
      return false;
    }
  }

  /** Marks the order as an open pickup offer and pings online riders — same mechanism as the manual dispatch-search flow. */
  private async broadcastPickupOffer(order: OrderDocument) {
    if (!order.pickup) order.pickup = {};
    if (!order.pickup.offeredAt) {
      order.pickup.offeredAt = new Date();
      await order.save();
    }

    const orderId = order._id.toString();
    this.trackingGateway.emitPickupOffer({
      _id: orderId,
      orderId,
      bookingType: order.bookingType,
      status: order.status,
      branchName: order.branchName,
    });
    this.trackingGateway.emitOrderEvent(orderId, 'findingRider', {
      message: 'Looking for a nearby rider…',
    });
    void this.riderOfferPush.notifyOnlineRiders({
      title: 'New Pickup Assigned',
      body: `Pickup near ${order.branchName ?? 'laundry shop'} · ${order.bookingType.replace(/_/g, ' ')}`,
      data: {
        category: 'assignment',
        type: 'pickup_offer',
        orderId,
      },
      channelId: 'assignments',
    });
  }

  /** Marks the order as an open delivery offer and pings online riders — same mechanism as the manual dispatch-search flow. */
  private async broadcastDeliveryOffer(order: OrderDocument) {
    if (!order.delivery) order.delivery = {};
    if (!order.delivery.offeredAt) {
      order.delivery.offeredAt = new Date();
      await order.save();
    }

    const orderId = order._id.toString();
    this.trackingGateway.emitDeliveryOffer({
      _id: orderId,
      orderId,
      bookingType: order.bookingType,
      status: order.status,
      branchName: order.branchName,
    });
    this.trackingGateway.emitOrderEvent(orderId, 'findingDeliveryRider', {
      message: 'Looking for a rider to deliver your laundry…',
    });
    void this.riderOfferPush.notifyOnlineRiders({
      title: 'New delivery offer',
      body: `Delivery from ${order.branchName ?? 'shop'} · ${order.bookingType.replace(/_/g, ' ')}`,
      data: {
        type: 'delivery_offer',
        orderId,
      },
    });
  }

  async suggestPickupRider(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    this.assertReadyForPickupAssignment(order);

    const address = await this.addressModel.findById(order.pickupAddressId);
    if (!address) throw new NotFoundException('Pickup address not found');

    const allRiders = await this.riderModel.find().limit(50);
    const { shortCircuitRiderId, riders } = await this.applyBranchDefaultRider(order, allRiders);
    if (shortCircuitRiderId) {
      order.suggestedPickupRiderId = new Types.ObjectId(shortCircuitRiderId);
      order.suggestedPickupRiderAt = new Date();
      await order.save();
      return {
        success: true,
        data: {
          orderId,
          customerLocation: { line1: address.line1, city: address.city, province: address.province },
          suggestions: [],
          suggestedRiderId: shortCircuitRiderId,
          mode: 'branch_default_rider',
        },
      };
    }

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
    source: 'admin_direct' | 'confirmed_suggestion' | 'branch_default_rider' = 'admin_direct',
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
          : source === 'branch_default_rider'
            ? "Pickup rider assigned automatically (shop's default rider)"
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

  async reassignPickupRider(orderId: string, newRiderUserId: string, adminUserId?: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    if (!order.pickupRiderId) {
      throw new BadRequestException('No pickup rider currently assigned — use assign instead');
    }
    if (order.pickupRiderId.toString() === newRiderUserId) {
      throw new BadRequestException('Rider is already assigned to this pickup');
    }
    if (order.pickup?.arrivedAt || order.pickup?.collectedAt) {
      throw new BadRequestException('Cannot reassign after pickup has started');
    }

    const previousRiderId = order.pickupRiderId.toString();
    const now = new Date();
    order.set('pickupRiderId', undefined);
    order.status = order.branchId ? OrderStatus.SHOP_ASSIGNED : OrderStatus.CONFIRMED;
    if (order.pickup) {
      order.pickup.acceptedAt = undefined;
      order.pickup.verificationHint = undefined;
    }
    order.statusHistory.push({
      status: order.status,
      timestamp: now,
      note: 'Pickup rider unassigned for reassignment by Lunara operations',
      updatedBy: adminUserId,
    });
    await order.save();

    this.trackingGateway.emitDispatchQueueUpdated({
      reason: 'pickup_rider_rejected',
      orderId,
    });
    await this.riderNotificationService.notifyAssignmentReassigned(previousRiderId, order, 'pickup');

    return this.assignPickupRider(orderId, newRiderUserId, adminUserId, 'admin_direct');
  }

  private assertReadyForPickupAssignment(order: OrderDocument) {
    if (!order.branchId || order.dispatchStatus !== 'dispatched') {
      throw new BadRequestException('Assign a laundry shop before assigning a pickup rider');
    }
    if (!order.partnerAcceptedAt) {
      throw new BadRequestException(
        'Partner must accept the order at the shop before assigning a pickup rider',
      );
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

    const branch = order.branchId ? await this.branchModel.findById(order.branchId) : null;
    if (branch?.assignedRiderId) {
      const rider = await this.riderModel.findOne({ userId: branch.assignedRiderId });
      if (rider?.isOnline) {
        try {
          return await this.assignDeliveryRider(
            orderId,
            branch.assignedRiderId.toString(),
            undefined,
            'branch_default_rider',
          );
        } catch {
          // fall through to the manual/suggested dispatch flow below
        }
      } else {
        await this.broadcastDeliveryOffer(order);
      }
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

    const allRiders = await this.riderModel.find().limit(50);
    const { shortCircuitRiderId, riders } = await this.applyBranchDefaultRider(order, allRiders);
    if (shortCircuitRiderId) {
      order.suggestedDeliveryRiderId = new Types.ObjectId(shortCircuitRiderId);
      order.suggestedDeliveryRiderAt = new Date();
      await order.save();
      return {
        success: true,
        data: {
          orderId,
          customerLocation: { line1: address.line1, city: address.city, province: address.province },
          suggestions: [],
          suggestedRiderId: shortCircuitRiderId,
          mode: 'branch_default_rider',
        },
      };
    }

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
    source: 'admin_direct' | 'confirmed_suggestion' | 'branch_default_rider' = 'admin_direct',
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
          : source === 'branch_default_rider'
            ? "Delivery rider assigned automatically (shop's default rider)"
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

  async reassignDeliveryRider(orderId: string, newRiderUserId: string, adminUserId?: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    if (!order.deliveryRiderId) {
      throw new BadRequestException('No delivery rider currently assigned — use assign instead');
    }
    if (order.deliveryRiderId.toString() === newRiderUserId) {
      throw new BadRequestException('Rider is already assigned to this delivery');
    }
    if (order.delivery?.pickedUpFromShopAt) {
      throw new BadRequestException('Cannot reassign after pickup from shop');
    }

    const previousRiderId = order.deliveryRiderId.toString();
    const now = new Date();
    order.set('deliveryRiderId', undefined);
    order.status = OrderStatus.READY_FOR_DELIVERY;
    if (order.delivery) {
      order.delivery.acceptedAt = undefined;
    }
    order.statusHistory.push({
      status: order.status,
      timestamp: now,
      note: 'Delivery rider unassigned for reassignment by Lunara operations',
      updatedBy: adminUserId,
    });
    await order.save();

    this.trackingGateway.emitDispatchQueueUpdated({
      reason: 'delivery_rider_rejected',
      orderId,
    });
    await this.riderNotificationService.notifyAssignmentReassigned(previousRiderId, order, 'delivery');

    return this.assignDeliveryRider(orderId, newRiderUserId, adminUserId, 'admin_direct');
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
    if (!order.partnerAcceptedAt) {
      throw new BadRequestException(
        'Partner must accept the order at the shop before assigning a delivery rider',
      );
    }
  }

  private async notifyRiderDeliveryAssigned(order: OrderDocument, riderUserId: string) {
    await this.riderNotificationService.notifyDeliveryAssigned(riderUserId, order);
  }

  private async notifyRiderPickupAssigned(order: OrderDocument, riderUserId: string) {
    await this.riderNotificationService.notifyPickupAssigned(riderUserId, order);
  }
}
