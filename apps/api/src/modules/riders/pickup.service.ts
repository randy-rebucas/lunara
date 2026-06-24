import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import {
  getPickupWorkflowStepIndex,
  PICKUP_WORKFLOW_STEPS,
} from '@lunara/utils';
import { Address, AddressDocument } from '../addresses/schemas/address.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { RiderOfferPushService } from '../push/rider-offer-push.service';
import { CollectLaundryDto, DropAtShopDto, VerifyCustomerDto } from './dto/pickup.dto';
import { HandoffQrService } from '../handoff/handoff-qr.service';
import { PaymentsService } from '../payments/payments.service';
import { RidersService } from './riders.service';
import { RiderWalletService } from './rider-wallet.service';
import { buildRiderTaskDetails } from './rider-task-summary';

function generateReceiptCode(orderId: string) {
  const short = orderId.slice(-6).toUpperCase();
  return `PU-${short}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

function phoneVerificationHint(phone?: string) {
  if (!phone) return '0000';
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-4) || '0000';
}

@Injectable()
export class PickupService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Address.name) private addressModel: Model<AddressDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    private ridersService: RidersService,
    private trackingGateway: TrackingGateway,
    private riderOfferPush: RiderOfferPushService,
    private handoffQrService: HandoffQrService,
    private paymentsService: PaymentsService,
    private riderWalletService: RiderWalletService,
  ) {}

  async dispatchPickupSearch(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (
      order.status !== OrderStatus.SHOP_ASSIGNED &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        `Order must be shop-assigned before pickup dispatch (current status: ${order.status})`,
      );
    }
    if (!order.partnerAcceptedAt) {
      throw new BadRequestException(
        'Partner must accept the order at the shop before dispatching pickup riders',
      );
    }

    if (!order.pickup) order.pickup = {};
    order.pickup.offeredAt = new Date();
    await order.save();

    const summary = await this.buildPickupSummary(order);
    this.trackingGateway.emitPickupOffer(summary);
    void this.riderOfferPush.notifyOnlineRiders({
      title: 'New Pickup Assigned',
      body: `Pickup near ${order.branchName ?? 'laundry shop'} · ${order.bookingType.replace(/_/g, ' ')}`,
      data: {
        category: 'assignment',
        type: 'pickup_offer',
        orderId: order._id.toString(),
      },
      channelId: 'assignments',
    });
    this.trackingGateway.emitOrderEvent(orderId, 'findingRider', {
      message: 'Looking for a nearby rider…',
    });

    return { success: true, data: { dispatched: true, orderId } };
  }

  async getPickupOffers() {
    const orders = await this.orderModel
      .find({
        status: { $in: [OrderStatus.SHOP_ASSIGNED, OrderStatus.CONFIRMED] },
        dispatchStatus: 'dispatched',
        branchId: { $exists: true, $ne: null },
        partnerAcceptedAt: { $exists: true, $ne: null },
        $or: [{ pickupRequestedAt: { $exists: true } }, { 'pickup.offeredAt': { $exists: true } }],
        pickupRiderId: { $exists: false },
      })
      .sort({ scheduledPickupAt: 1 })
      .limit(20);

    const items = await Promise.all(orders.map((o) => this.buildPickupSummary(o)));
    return { success: true, data: items };
  }

  async getPickupTask(orderId: string, riderUserId: string) {
    const order = await this.getOrderForRider(orderId, riderUserId);
    return { success: true, data: await this.buildPickupSummary(order, riderUserId) };
  }

  async acceptPickup(orderId: string, riderUserId: string) {
    const rider = await this.ridersService.findOrCreate(riderUserId);
    if (!rider.isOnline) {
      throw new BadRequestException('Go online to accept pickup jobs');
    }

    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.dispatchStatus !== 'dispatched' || !order.branchId) {
      throw new BadRequestException('Order is not ready for rider pickup');
    }
    if (!order.partnerAcceptedAt) {
      throw new BadRequestException('Partner has not accepted this order yet');
    }
    if (
      (order.status !== OrderStatus.SHOP_ASSIGNED && order.status !== OrderStatus.CONFIRMED) ||
      order.pickupRiderId
    ) {
      throw new BadRequestException('Pickup no longer available');
    }

    const customer = await this.userModel.findById(order.customerId);
    const now = new Date();
    order.pickupRiderId = new Types.ObjectId(riderUserId);
    order.status = OrderStatus.RIDER_ASSIGNED_PICKUP;
    if (!order.pickup) order.pickup = {};
    order.pickup.acceptedAt = now;
    order.pickup.verificationHint = phoneVerificationHint(customer?.phone);
    order.statusHistory.push({
      status: OrderStatus.RIDER_ASSIGNED_PICKUP,
      timestamp: now,
      note: 'Rider accepted pickup',
      updatedBy: riderUserId,
    });
    await order.save();

    this.trackingGateway.emitOrderStatus(orderId, OrderStatus.RIDER_ASSIGNED_PICKUP);
    this.trackingGateway.emitOrderEvent(orderId, 'riderAssigned', {
      message: 'A rider accepted your pickup',
      riderId: riderUserId,
    });

    return { success: true, data: await this.buildPickupSummary(order, riderUserId) };
  }

  async rejectPickup(orderId: string, riderUserId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const isOpenOffer =
      (order.status === OrderStatus.SHOP_ASSIGNED || order.status === OrderStatus.CONFIRMED) &&
      !order.pickupRiderId;

    if (isOpenOffer) {
      return { success: true, data: { dismissed: true, orderId } };
    }

    if (order.pickupRiderId?.toString() !== riderUserId) {
      throw new ForbiddenException('Not your pickup task');
    }
    if (order.pickup?.arrivedAt || order.pickup?.collectedAt) {
      throw new BadRequestException('Cannot reject after pickup has started');
    }

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
      note: 'Rider rejected pickup assignment',
      updatedBy: riderUserId,
    });
    await order.save();

    this.trackingGateway.emitDispatchQueueUpdated({
      reason: 'pickup_rider_rejected',
      orderId,
    });

    return { success: true, data: await this.buildPickupSummary(order, riderUserId) };
  }

  async markArrived(orderId: string, riderUserId: string) {
    const order = await this.getActivePickupOrder(orderId, riderUserId, true);
    if (!order.pickup) order.pickup = {};
    order.pickup.arrivedAt = new Date();
    await order.save();

    this.trackingGateway.emitOrderEvent(orderId, 'riderArrived', {
      message: 'Your rider has arrived',
    });

    return { success: true, data: await this.buildPickupSummary(order, riderUserId) };
  }

  async verifyCustomer(orderId: string, riderUserId: string, dto: VerifyCustomerDto) {
    const order = await this.getActivePickupOrder(orderId, riderUserId, true);
    const customer = await this.userModel.findById(order.customerId).select('phone');
    const expected = phoneVerificationHint(customer?.phone);
    const code = this.handoffQrService.resolvePickupVerificationCode(dto, orderId);
    if (code !== expected) {
      throw new BadRequestException('Verification code does not match customer phone');
    }
    if (!order.pickup) order.pickup = {};
    if (!order.pickup.verificationHint) {
      order.pickup.verificationHint = expected;
    }
    order.pickup.customerVerifiedAt = new Date();
    await order.save();

    return {
      success: true,
      data: { verified: true, message: 'Customer verified' },
    };
  }

  async collectCash(orderId: string, riderUserId: string) {
    const order = await this.getActivePickupOrder(orderId, riderUserId, true);
    if (!order.pickup?.customerVerifiedAt) {
      throw new BadRequestException('Verify customer before collecting cash');
    }
    const payment = await this.paymentsService.collectCashForOrder(orderId, riderUserId, 'pickup');
    // Awaited (not fire-and-forget): a silently-dropped failure here means real cash the rider
    // collected is never tracked as owed back to the platform.
    await this.riderWalletService.netEarningsAgainstCash(
      riderUserId,
      orderId,
      payment._id.toString(),
      payment.amount,
      'pickup',
    );
    return { success: true, data: await this.buildPickupSummary(order, riderUserId) };
  }

  async collectLaundry(orderId: string, riderUserId: string, dto: CollectLaundryDto) {
    const order = await this.getActivePickupOrder(orderId, riderUserId);
    if (!order.pickup?.customerVerifiedAt) {
      throw new BadRequestException('Verify customer before collecting laundry');
    }
    await this.paymentsService.assertCashCollectedForStage(orderId, 'pickup');
    if (!order.pickup) order.pickup = {};
    order.pickup.actualWeightKg = dto.actualWeightKg;
    order.pickup.notes = dto.notes;
    order.pickup.collectedAt = new Date();

    if (
      order.status === OrderStatus.RIDER_ASSIGNED_PICKUP ||
      order.status === OrderStatus.RIDER_ASSIGNED
    ) {
      order.status = OrderStatus.PICKED_UP;
      order.statusHistory.push({
        status: OrderStatus.PICKED_UP,
        timestamp: new Date(),
        note: 'Laundry picked up from customer',
        updatedBy: riderUserId,
      });
      this.trackingGateway.emitOrderStatus(orderId, OrderStatus.PICKED_UP);
      this.trackingGateway.emitOrderEvent(orderId, 'pickedUp', {
        message: 'Your laundry has been picked up',
      });
    }
    await order.save();

    return { success: true, data: await this.buildPickupSummary(order, riderUserId) };
  }

  async capturePhoto(orderId: string, riderUserId: string, photoUrl: string) {
    const order = await this.getActivePickupOrder(orderId, riderUserId);
    if (!order.pickup?.collectedAt) {
      throw new BadRequestException('Mark laundry collected before capturing photo');
    }
    if (order.status !== OrderStatus.PICKED_UP) {
      throw new BadRequestException('Complete pickup from customer first');
    }
    if (!order.pickup) order.pickup = {};
    order.pickup.photoUrl = photoUrl;
    await order.save();

    return { success: true, data: await this.buildPickupSummary(order, riderUserId) };
  }

  async generatePickupReceipt(orderId: string, riderUserId: string) {
    const order = await this.getActivePickupOrder(orderId, riderUserId);
    if (!order.pickup?.photoUrl) {
      throw new BadRequestException('Capture pickup photo before generating receipt');
    }
    if (order.status !== OrderStatus.PICKED_UP) {
      throw new BadRequestException('Order must be in picked_up status');
    }
    if (!order.pickup) order.pickup = {};
    const receiptCode = order.pickup.receiptCode ?? generateReceiptCode(orderId);
    order.pickup.receiptCode = receiptCode;
    order.pickup.receiptGeneratedAt = new Date();
    await order.save();

    this.trackingGateway.emitOrderEvent(orderId, 'pickupReceiptGenerated', {
      message: 'Pickup receipt generated',
      receiptCode,
    });

    return {
      success: true,
      data: {
        ...(await this.buildPickupSummary(order, riderUserId)),
        receiptCode,
      },
    };
  }

  async dropAtShop(orderId: string, riderUserId: string, dto?: DropAtShopDto) {
    const order = await this.getActivePickupOrder(orderId, riderUserId);
    if (!order.pickup?.receiptCode) {
      throw new BadRequestException('Generate pickup receipt before delivering to shop');
    }
    if (dto?.qrPayload) {
      this.handoffQrService.validateOrderHandoverQr(dto.qrPayload, order);
    }
    if (!order.pickup) order.pickup = {};
    const now = new Date();
    order.pickup.inTransitToShopAt = order.pickup.inTransitToShopAt ?? now;
    order.pickup.droppedAtShop = now;

    if (order.status === OrderStatus.PICKED_UP) {
      order.status = OrderStatus.IN_TRANSIT_TO_SHOP;
      order.statusHistory.push({
        status: OrderStatus.IN_TRANSIT_TO_SHOP,
        timestamp: now,
        note: `Delivered to ${order.branchName ?? 'assigned shop'}`,
        updatedBy: riderUserId,
      });
      this.trackingGateway.emitOrderStatus(orderId, OrderStatus.IN_TRANSIT_TO_SHOP);
    }
    await order.save();

    this.trackingGateway.emitOrderEvent(orderId, 'inTransitToShop', {
      message: 'Laundry delivered to partner shop',
      branchName: order.branchName,
    });

    const earnings = await this.ridersService.creditEarning(riderUserId, orderId, 'pickup');

    return {
      success: true,
      data: {
        ...(await this.buildPickupSummary(order, riderUserId)),
        earnings,
      },
    };
  }

  /** @deprecated Shop confirms intake via partner receiving workflow */
  async completePickup(orderId: string, riderUserId: string) {
    const order = await this.getActivePickupOrder(orderId, riderUserId);
    if (order.status !== OrderStatus.IN_TRANSIT_TO_SHOP) {
      throw new BadRequestException('Deliver laundry to shop first');
    }
    throw new BadRequestException(
      'Partner shop must receive laundry (receive → verify weight → confirm items)',
    );
  }

  private async getOrderForRider(orderId: string, riderUserId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const isOffer =
      (order.status === OrderStatus.SHOP_ASSIGNED || order.status === OrderStatus.CONFIRMED) &&
      !order.pickupRiderId;
    const isAssigned = order.pickupRiderId?.toString() === riderUserId;

    if (!isOffer && !isAssigned) throw new ForbiddenException();
    return order;
  }

  private async getActivePickupOrder(
    orderId: string,
    riderUserId: string,
    prePickupOnly = false,
  ) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.pickupRiderId?.toString() !== riderUserId) {
      throw new ForbiddenException('Not your pickup task');
    }

    const prePickup = [
      OrderStatus.RIDER_ASSIGNED_PICKUP,
      OrderStatus.RIDER_ASSIGNED,
    ];
    const active = [
      ...prePickup,
      OrderStatus.PICKED_UP,
      OrderStatus.IN_TRANSIT_TO_SHOP,
    ];

    const allowed = prePickupOnly ? prePickup : active;
    if (!allowed.includes(order.status)) {
      throw new BadRequestException(`Pickup step not available (status: ${order.status})`);
    }
    return order;
  }

  private async buildPickupSummary(order: OrderDocument, riderUserId?: string) {
    const address = await this.addressModel.findById(order.pickupAddressId);
    const isAssigned = order.pickupRiderId?.toString() === riderUserId;
    const isOffer =
      (order.status === OrderStatus.SHOP_ASSIGNED || order.status === OrderStatus.CONFIRMED) &&
      !order.pickupRiderId;
    const taskDetails = await buildRiderTaskDetails(
      order,
      {
        customerModel: this.customerModel,
        branchModel: this.branchModel,
        userModel: this.userModel,
        addressModel: this.addressModel,
      },
      {
        includeDialablePhone: isAssigned,
        customerAddressId: order.pickupAddressId,
      },
    );

    const canReject =
      isOffer ||
      (isAssigned &&
        !order.pickup?.arrivedAt &&
        !order.pickup?.collectedAt &&
        [
          OrderStatus.RIDER_ASSIGNED_PICKUP,
          OrderStatus.RIDER_ASSIGNED,
        ].includes(order.status));

    const cashPayment = await this.paymentsService.getRiderCashPaymentInfo(
      order._id.toString(),
      'pickup',
      !!order.pickup?.customerVerifiedAt,
    );

    if (cashPayment?.collected) {
      const remittance = await this.riderWalletService.getRemittanceForOrder(
        order._id.toString(),
        'pickup',
      );
      if (remittance) {
        cashPayment.earningOffset = remittance.earningOffset;
        cashPayment.netRemittance = remittance.netRemittance;
      }
    }

    return {
      _id: order._id.toString(),
      status: order.status,
      branchName: order.branchName,
      branchCode: order.branchCode,
      pickupWorkflowStep: getPickupWorkflowStepIndex({
        status: order.status,
        pickup: order.pickup,
      }),
      pickupWorkflowSteps: PICKUP_WORKFLOW_STEPS.map((s) => s.label),
      bookingType: order.bookingType,
      estimatedWeightKg: order.estimatedWeightKg,
      scheduledPickupAt: order.scheduledPickupAt,
      total: order.total,
      pickup: order.pickup,
      pickupAddress: address
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
      customerPhoneMasked: taskDetails.customerPhoneMasked,
      customerPhone: taskDetails.customerPhone,
      customerName: taskDetails.customerName,
      orderNumber: taskDetails.orderNumber,
      specialInstructions: taskDetails.specialInstructions,
      shopName: taskDetails.shopName,
      shopPhone: taskDetails.shopPhone,
      shopPhoneMasked: taskDetails.shopPhoneMasked,
      canReject,
      shopLocation: taskDetails.shopLocation,
      cashPayment,
    };
  }
}
