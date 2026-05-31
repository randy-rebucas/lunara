import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus, UserRole } from '@lunara/types';
import {
  canTransitionOrderStatus,
  getShopReceivingStepIndex,
  SHOP_RECEIVING_STEPS,
} from '@lunara/utils';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { TrackingGateway } from '../realtime/tracking.gateway';
import {
  ConfirmShopItemsDto,
  ReceiveLaundryDto,
  VerifyShopWeightDto,
} from './dto/shop-receiving.dto';
import { assertOrderPortalAccess, resolvePortalBranchId } from './partner-access';

const RECEIVING_STATUSES = [
  OrderStatus.IN_TRANSIT_TO_SHOP,
  OrderStatus.RECEIVED_AT_SHOP,
];

@Injectable()
export class ShopReceivingService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private trackingGateway: TrackingGateway,
  ) {}

  async getReceiving(orderId: string, partnerUserId: string, role: UserRole) {
    const order = await this.getOrderForPartner(orderId, partnerUserId, role);
    return { success: true, data: this.buildView(order) };
  }

  async receiveLaundry(
    orderId: string,
    userId: string,
    role: UserRole,
    dto: ReceiveLaundryDto,
  ) {
    const order = await this.getOrderForPartner(orderId, userId, role);
    if (order.status !== OrderStatus.IN_TRANSIT_TO_SHOP) {
      throw new BadRequestException(
        `Receive laundry when rider has delivered (status: ${order.status})`,
      );
    }
    if (!order.partnerAcceptedAt) {
      throw new BadRequestException('Accept this order at your shop first');
    }

    if (!order.shopReceiving) order.shopReceiving = {};
    if (order.shopReceiving.receivedAt) {
      throw new BadRequestException('Laundry already marked received');
    }

    order.shopReceiving.receivedAt = new Date();
    order.shopReceiving.receivedBy = userId;
    if (dto.note) order.shopReceiving.notes = dto.note;
    await order.save();

    this.trackingGateway.emitOrderEvent(orderId, 'laundryReceivedAtShop', {
      message: 'Your laundry was received at the partner shop',
      note: dto.note,
    });
    this.emitPipeline(order);

    return { success: true, data: this.buildView(order) };
  }

  async verifyWeight(
    orderId: string,
    userId: string,
    role: UserRole,
    dto: VerifyShopWeightDto,
  ) {
    const order = await this.getOrderForPartner(orderId, userId, role);
    if (!RECEIVING_STATUSES.includes(order.status)) {
      throw new BadRequestException('Order is not in shop receiving');
    }
    if (!order.shopReceiving?.receivedAt) {
      throw new BadRequestException('Receive laundry before verifying weight');
    }
    if (order.shopReceiving.weightVerifiedAt) {
      throw new BadRequestException('Weight already verified');
    }

    order.shopReceiving.verifiedWeightKg = dto.verifiedWeightKg;
    order.shopReceiving.weightVerifiedAt = new Date();
    if (dto.note) order.shopReceiving.notes = dto.note;
    if (!order.laundryProcessing) {
      order.laundryProcessing = { completedSteps: [], ironingSkipped: false };
    }
    order.laundryProcessing.verifiedWeightKg = dto.verifiedWeightKg;
    await order.save();

    this.trackingGateway.emitOrderEvent(orderId, 'shopWeightVerified', {
      message: 'Shop verified laundry weight',
      verifiedWeightKg: dto.verifiedWeightKg,
    });
    this.emitPipeline(order);

    return { success: true, data: this.buildView(order) };
  }

  async confirmItems(
    orderId: string,
    userId: string,
    role: UserRole,
    dto: ConfirmShopItemsDto,
  ) {
    const order = await this.getOrderForPartner(orderId, userId, role);
    if (!order.shopReceiving?.receivedAt) {
      throw new BadRequestException('Receive laundry first');
    }
    if (order.shopReceiving.verifiedWeightKg == null) {
      throw new BadRequestException('Verify weight before confirming items');
    }
    if (order.shopReceiving.itemsConfirmedAt || order.status === OrderStatus.RECEIVED_AT_SHOP) {
      throw new BadRequestException('Items already confirmed at shop');
    }

    if (!canTransitionOrderStatus(order.status, OrderStatus.RECEIVED_AT_SHOP)) {
      throw new BadRequestException(`Cannot confirm from status ${order.status}`);
    }

    const now = new Date();
    order.shopReceiving.itemCount = dto.itemCount;
    order.shopReceiving.itemsConfirmedAt = now;
    order.shopReceiving.confirmedBy = userId;
    if (dto.note) order.shopReceiving.notes = dto.note;

    order.status = OrderStatus.RECEIVED_AT_SHOP;
    order.statusHistory.push({
      status: OrderStatus.RECEIVED_AT_SHOP,
      timestamp: now,
      note: `Confirmed ${dto.itemCount} item(s) at shop`,
      updatedBy: userId,
    });
    if (!order.laundryProcessing) {
      order.laundryProcessing = { completedSteps: [], ironingSkipped: false };
    }
    order.laundryProcessing.currentStepId = 'received';
    await order.save();

    this.trackingGateway.emitOrderStatus(orderId, OrderStatus.RECEIVED_AT_SHOP);
    this.trackingGateway.emitOrderEvent(orderId, 'receivedAtShop', {
      message: 'Laundry received and checked at the partner shop',
      itemCount: dto.itemCount,
      verifiedWeightKg: order.shopReceiving.verifiedWeightKg,
    });
    this.emitPipeline(order);

    return { success: true, data: this.buildView(order) };
  }

  private emitPipeline(order: OrderDocument) {
    const orderId = order._id.toString();
    this.trackingGateway.emitPartnerPipelineUpdated({
      orderId,
      status: order.status,
      partnerId: order.partnerId?.toString(),
      branchId: order.branchId?.toString(),
    });
  }

  private async getOrderForPartner(orderId: string, userId: string, role: UserRole) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (!order.branchId) throw new BadRequestException('Order has no assigned branch');

    const branchId = await resolvePortalBranchId(this.userModel, userId, role);
    assertOrderPortalAccess(order, userId, role, branchId);

    return order;
  }

  private buildView(order: OrderDocument) {
    const stepIndex = getShopReceivingStepIndex({
      status: order.status,
      shopReceiving: order.shopReceiving,
    });

    return {
      order: {
        _id: order._id.toString(),
        status: order.status,
        bookingType: order.bookingType,
        total: order.total,
        estimatedWeightKg: order.estimatedWeightKg,
        branchName: order.branchName,
        pickup: order.pickup,
      },
      shopReceiving: order.shopReceiving,
      workflowSteps: SHOP_RECEIVING_STEPS.map((s) => s.label),
      workflowStep: stepIndex,
      workflowStepLabel: SHOP_RECEIVING_STEPS[stepIndex]?.label,
      canReceive: order.status === OrderStatus.IN_TRANSIT_TO_SHOP && !order.shopReceiving?.receivedAt,
      canVerifyWeight:
        !!order.shopReceiving?.receivedAt &&
        order.shopReceiving.verifiedWeightKg == null &&
        order.status !== OrderStatus.RECEIVED_AT_SHOP,
      canConfirmItems:
        order.shopReceiving?.verifiedWeightKg != null &&
        !order.shopReceiving?.itemsConfirmedAt &&
        order.status === OrderStatus.IN_TRANSIT_TO_SHOP,
      isComplete:
        order.status === OrderStatus.RECEIVED_AT_SHOP || !!order.shopReceiving?.itemsConfirmedAt,
      processingHref: order.status === OrderStatus.RECEIVED_AT_SHOP ? true : undefined,
    };
  }
}
