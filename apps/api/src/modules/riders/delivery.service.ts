import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import {
  canTransitionOrderStatus,
  DELIVERY_WORKFLOW_STEPS,
  getDeliveryWorkflowStepIndex,
} from '@lunara/utils';
import { Address, AddressDocument } from '../addresses/schemas/address.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { ReviewsService } from '../reviews/reviews.service';
import { RidersService } from './riders.service';

function generateDeliveryReceipt(orderId: string) {
  const short = orderId.slice(-6).toUpperCase();
  return `DL-${short}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

function phoneVerificationHint(phone?: string) {
  if (!phone) return '0000';
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-4) || '0000';
}

@Injectable()
export class DeliveryService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Address.name) private addressModel: Model<AddressDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private ridersService: RidersService,
    private trackingGateway: TrackingGateway,
    private reviewsService: ReviewsService,
  ) {}

  async dispatchDeliverySearch(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.READY_FOR_DELIVERY) {
      throw new BadRequestException(
        `Order must be ready for delivery (current status: ${order.status})`,
      );
    }

    if (!order.delivery) order.delivery = {};
    order.delivery.offeredAt = new Date();
    await order.save();

    const summary = await this.buildDeliverySummary(order);
    this.trackingGateway.emitDeliveryOffer(summary);
    this.trackingGateway.emitOrderEvent(orderId, 'findingDeliveryRider', {
      message: 'Looking for a rider to deliver your laundry…',
    });

    return { success: true, data: { dispatched: true, orderId } };
  }

  async getDeliveryOffers() {
    const orders = await this.orderModel
      .find({
        status: OrderStatus.READY_FOR_DELIVERY,
        deliveryRiderId: { $exists: false },
        'delivery.offeredAt': { $exists: true },
      })
      .sort({ updatedAt: 1 })
      .limit(20);

    const items = await Promise.all(orders.map((o) => this.buildDeliverySummary(o)));
    return { success: true, data: items };
  }

  async getDeliveryTask(orderId: string, riderUserId: string) {
    const order = await this.getOrderForRider(orderId, riderUserId);
    return { success: true, data: await this.buildDeliverySummary(order) };
  }

  async acceptDelivery(orderId: string, riderUserId: string) {
    const rider = await this.ridersService.findOrCreate(riderUserId);
    if (!rider.isOnline) {
      throw new BadRequestException('Go online to accept delivery jobs');
    }

    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.deliveryRiderId?.toString() !== riderUserId) {
      throw new BadRequestException(
        'Delivery is assigned by Lunara operations — check your assignments',
      );
    }
    if (order.status !== OrderStatus.RIDER_ASSIGNED_DELIVERY) {
      throw new BadRequestException('Delivery assignment not active for this order');
    }

    if (!order.delivery) order.delivery = {};
    if (!order.delivery.acceptedAt) {
      order.delivery.acceptedAt = new Date();
    }
    const customer = await this.userModel.findById(order.customerId);
    order.delivery.verificationHint = phoneVerificationHint(customer?.phone);
    await order.save();

    this.trackingGateway.emitOrderEvent(orderId, 'deliveryRiderAssigned', {
      message: 'Your delivery rider is on the way',
      riderId: riderUserId,
    });

    return { success: true, data: await this.buildDeliverySummary(order) };
  }

  async pickupFromShop(orderId: string, riderUserId: string) {
    const order = await this.getAssignedDeliveryOrder(orderId, riderUserId);
    if (order.status !== OrderStatus.RIDER_ASSIGNED_DELIVERY) {
      throw new BadRequestException('Acknowledge assignment before picking up from shop');
    }
    if (!order.delivery?.acceptedAt) {
      throw new BadRequestException('Acknowledge delivery assignment first');
    }
    if (!order.delivery) order.delivery = {};
    if (order.delivery.pickedUpFromShopAt) {
      throw new BadRequestException('Already picked up from shop');
    }

    order.delivery.pickedUpFromShopAt = new Date();
    await order.save();

    this.trackingGateway.emitOrderEvent(orderId, 'riderPickedUpFromShop', {
      message: 'Your laundry was picked up from the shop for delivery',
      branchName: order.branchName,
    });

    return { success: true, data: await this.buildDeliverySummary(order) };
  }

  /** @deprecated use pickupFromShop + outForDelivery */
  async startDelivery(orderId: string, riderUserId: string) {
    const order = await this.getAssignedDeliveryOrder(orderId, riderUserId);
    if (!order.delivery?.pickedUpFromShopAt) {
      await this.pickupFromShop(orderId, riderUserId);
    }
    return this.outForDelivery(orderId, riderUserId);
  }

  async outForDelivery(orderId: string, riderUserId: string) {
    const order = await this.getAssignedDeliveryOrder(orderId, riderUserId);
    if (!order.delivery?.pickedUpFromShopAt) {
      throw new BadRequestException('Pick up laundry from the shop first');
    }
    if (!order.delivery) order.delivery = {};

    const now = new Date();
    if (order.status === OrderStatus.RIDER_ASSIGNED_DELIVERY) {
      if (!canTransitionOrderStatus(order.status, OrderStatus.OUT_FOR_DELIVERY)) {
        throw new BadRequestException('Cannot start out for delivery');
      }
      order.status = OrderStatus.OUT_FOR_DELIVERY;
      order.statusHistory.push({
        status: OrderStatus.OUT_FOR_DELIVERY,
        timestamp: now,
        note: 'Out for delivery to customer',
        updatedBy: riderUserId,
      });
    }

    order.delivery.startedAt = order.delivery.startedAt ?? now;
    order.delivery.outForDeliveryAt = now;
    await order.save();

    this.trackingGateway.emitOrderStatus(orderId, OrderStatus.OUT_FOR_DELIVERY);
    this.trackingGateway.emitOrderEvent(orderId, 'outForDelivery', {
      message: 'Your laundry is on the way',
    });

    return { success: true, data: await this.buildDeliverySummary(order) };
  }

  /** @deprecated use markCustomerReceived */
  async markArrived(orderId: string, riderUserId: string) {
    return this.markCustomerReceived(orderId, riderUserId);
  }

  async markCustomerReceived(orderId: string, riderUserId: string) {
    const order = await this.getAssignedDeliveryOrder(orderId, riderUserId);
    if (order.status !== OrderStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException('Order must be out for delivery');
    }
    if (!order.delivery?.pickedUpFromShopAt) {
      throw new BadRequestException('Complete shop pickup and out-for-delivery first');
    }

    if (!order.delivery) order.delivery = {};
    const now = new Date();
    order.delivery.arrivedAt = now;
    order.delivery.customerReceivedAt = order.delivery.customerReceivedAt ?? now;
    await order.save();

    this.trackingGateway.emitOrderEvent(orderId, 'customerReceivedDelivery', {
      message: 'Your laundry has been handed to you',
    });

    return { success: true, data: await this.buildDeliverySummary(order) };
  }

  async capturePhoto(orderId: string, riderUserId: string, photoUrl: string) {
    const order = await this.getAssignedDeliveryOrder(orderId, riderUserId);
    if (!this.hasCustomerReceived(order)) {
      throw new BadRequestException('Customer must receive laundry before photo proof');
    }
    if (!order.delivery) order.delivery = {};
    order.delivery.photoUrl = photoUrl;
    await order.save();

    this.trackingGateway.emitOrderEvent(orderId, 'deliveryPhotoProof', {
      message: 'Delivery photo proof captured',
      photoUrl,
    });

    return { success: true, data: await this.buildDeliverySummary(order) };
  }

  async customerVerify(orderId: string, customerId: string, code: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId.toString() !== customerId) throw new ForbiddenException();
    if (order.status !== OrderStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException('Delivery handoff is not active yet');
    }

    const expected = order.delivery?.verificationHint ?? '0000';
    if (code !== expected) {
      throw new BadRequestException('Verification code does not match your phone number');
    }

    if (!order.delivery) order.delivery = {};
    const now = new Date();
    order.delivery.customerVerifiedAt = now;
    order.delivery.customerReceivedAt = order.delivery.customerReceivedAt ?? now;
    order.delivery.arrivedAt = order.delivery.arrivedAt ?? now;
    await order.save();

    this.trackingGateway.emitOrderEvent(orderId, 'customerReceivedDelivery', {
      message: 'You confirmed receipt of your laundry',
    });

    return { success: true, data: { verified: true } };
  }

  async customerSign(orderId: string, customerId: string, signatureName: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId.toString() !== customerId) throw new ForbiddenException();

    if (!this.hasCustomerReceived(order)) {
      throw new BadRequestException('Confirm you received your laundry before signing');
    }
    if (!order.delivery?.photoUrl) {
      throw new BadRequestException('Waiting for delivery photo proof from rider');
    }

    if (!order.delivery) order.delivery = {};
    order.delivery.customerSignedAt = new Date();
    order.delivery.signatureName = signatureName.trim();
    await order.save();

    this.trackingGateway.emitOrderEvent(orderId, 'customerSignedDelivery', {
      message: 'Customer signed for delivery',
      signatureName: order.delivery.signatureName,
    });

    return { success: true, data: { signed: true, signatureName: order.delivery.signatureName } };
  }

  async getCustomerDeliveryStatus(orderId: string, customerId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId.toString() !== customerId) throw new ForbiddenException();

    const received = this.hasCustomerReceived(order);

    return {
      success: true,
      data: {
        status: order.status,
        delivery: order.delivery,
        workflowSteps: DELIVERY_WORKFLOW_STEPS.map((s) => s.label),
        workflowStep: getDeliveryWorkflowStepIndex({
          status: order.status,
          delivery: order.delivery,
        }),
        needsVerify:
          order.status === OrderStatus.OUT_FOR_DELIVERY && !received,
        needsSign:
          received &&
          !!order.delivery?.photoUrl &&
          !order.delivery?.customerSignedAt,
        canComplete: false,
        awaitingRiderComplete:
          !!order.delivery?.customerSignedAt &&
          order.status === OrderStatus.OUT_FOR_DELIVERY,
      },
    };
  }

  async completeDelivery(orderId: string, riderUserId: string) {
    const order = await this.getAssignedDeliveryOrder(orderId, riderUserId);
    if (!order.delivery?.customerSignedAt) {
      throw new BadRequestException('Customer signature required before completing delivery');
    }
    if (!order.delivery?.photoUrl) {
      throw new BadRequestException('Capture delivery photo proof first');
    }
    if (!this.hasCustomerReceived(order)) {
      throw new BadRequestException('Customer must receive laundry first');
    }

    if (!canTransitionOrderStatus(order.status, OrderStatus.DELIVERED)) {
      throw new BadRequestException(`Cannot deliver from status ${order.status}`);
    }

    const receiptCode = generateDeliveryReceipt(orderId);
    const now = new Date();
    if (!order.delivery) order.delivery = {};
    order.delivery.receiptCode = receiptCode;
    order.delivery.deliveredAt = now;
    order.status = OrderStatus.DELIVERED;
    order.statusHistory.push({
      status: OrderStatus.DELIVERED,
      timestamp: now,
      note: `Delivered · receipt ${receiptCode}`,
      updatedBy: riderUserId,
    });
    await order.save();

    this.trackingGateway.emitOrderStatus(orderId, OrderStatus.DELIVERED);
    this.trackingGateway.emitOrderEvent(orderId, 'delivered', {
      message: 'Laundry delivered',
      receiptCode,
    });

    if (canTransitionOrderStatus(OrderStatus.DELIVERED, OrderStatus.COMPLETED)) {
      order.status = OrderStatus.COMPLETED;
      order.statusHistory.push({
        status: OrderStatus.COMPLETED,
        timestamp: new Date(),
        note: 'Order completed',
        updatedBy: riderUserId,
      });
      await order.save();
      this.trackingGateway.emitOrderStatus(orderId, OrderStatus.COMPLETED);
      this.trackingGateway.emitOrderEvent(orderId, 'completed', {
        message: 'Order complete. Thank you!',
      });
      await this.reviewsService.notifyOrderCompleted(orderId);
    }

    const earnings = await this.ridersService.creditEarning(
      riderUserId,
      orderId,
      'delivery',
    );

    return {
      success: true,
      data: {
        orderId,
        status: order.status,
        receiptCode,
        delivery: order.delivery,
        earnings,
      },
    };
  }

  private hasCustomerReceived(order: OrderDocument) {
    return !!(
      order.delivery?.customerReceivedAt ||
      order.delivery?.customerVerifiedAt ||
      order.delivery?.arrivedAt
    );
  }

  private async getOrderForRider(orderId: string, riderUserId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const isAssigned = order.deliveryRiderId?.toString() === riderUserId;
    const isOffer =
      order.status === OrderStatus.READY_FOR_DELIVERY &&
      !order.deliveryRiderId &&
      !!order.delivery?.offeredAt;
    const isPickupRiderAwaitingDelivery =
      order.status === OrderStatus.READY_FOR_DELIVERY &&
      order.pickupRiderId?.toString() === riderUserId;

    if (!isOffer && !isAssigned && !isPickupRiderAwaitingDelivery) {
      throw new ForbiddenException();
    }
    return order;
  }

  private async getAssignedDeliveryOrder(orderId: string, riderUserId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.deliveryRiderId?.toString() !== riderUserId) {
      throw new ForbiddenException('Not your delivery task');
    }
    if (
      order.status !== OrderStatus.RIDER_ASSIGNED_DELIVERY &&
      order.status !== OrderStatus.READY_FOR_DELIVERY &&
      order.status !== OrderStatus.OUT_FOR_DELIVERY
    ) {
      throw new BadRequestException('Delivery task is not active');
    }
    return order;
  }

  private async buildDeliverySummary(order: OrderDocument) {
    const address = await this.addressModel.findById(order.deliveryAddressId);
    const customer = await this.userModel.findById(order.customerId).select('phone');
    const shopAddress = order.branchName
      ? { label: order.branchName, line1: order.branchName, city: '' }
      : null;

    return {
      _id: order._id.toString(),
      status: order.status,
      bookingType: order.bookingType,
      total: order.total,
      branchName: order.branchName,
      delivery: order.delivery,
      deliveryWorkflowSteps: DELIVERY_WORKFLOW_STEPS.map((s) => s.label),
      deliveryWorkflowStep: getDeliveryWorkflowStepIndex({
        status: order.status,
        delivery: order.delivery,
      }),
      shopLocation: shopAddress,
      deliveryAddress: address
        ? {
            label: address.label,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            province: address.province,
            postalCode: address.postalCode,
            latitude: address.latitude,
            longitude: address.longitude,
          }
        : null,
      customerPhoneMasked: customer?.phone ? `***${customer.phone.slice(-4)}` : undefined,
      customerReceived: this.hasCustomerReceived(order),
      customerSigned: !!order.delivery?.customerSignedAt,
      canPickupFromShop:
        order.status === OrderStatus.RIDER_ASSIGNED_DELIVERY &&
        !!order.delivery?.acceptedAt &&
        !order.delivery?.pickedUpFromShopAt,
      canGoOutForDelivery:
        !!order.delivery?.pickedUpFromShopAt &&
        order.status === OrderStatus.RIDER_ASSIGNED_DELIVERY,
      canMarkCustomerReceived:
        order.status === OrderStatus.OUT_FOR_DELIVERY &&
        !this.hasCustomerReceived(order),
      canCapturePhoto:
        order.status === OrderStatus.OUT_FOR_DELIVERY &&
        this.hasCustomerReceived(order) &&
        !order.delivery?.photoUrl,
      canComplete:
        order.status === OrderStatus.OUT_FOR_DELIVERY &&
        !!order.delivery?.photoUrl &&
        !!order.delivery?.customerSignedAt,
    };
  }
}
