import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus, UserRole } from '@lunara/types';
import {
  BranchPricingMode,
  canTransitionOrderStatus,
  computeServiceSubtotal,
  getShopReceivingStepIndex,
  SHOP_RECEIVING_STEPS,
} from '@lunara/utils';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { BranchesService } from '../branches/branches.service';
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
    private branchesService: BranchesService,
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
    order.pickup.actualWeightKg = dto.verifiedWeightKg;
    order.pickup.actualLoadCount = dto.verifiedLoadCount;
    order.pickup.actualPieceCount = dto.verifiedPieceCount;

    // PER_KG/PER_LOAD/PER_PIECE orders were only estimated at booking time — finalize the real
    // price now that the shop has physically weighed/counted the laundry, using the rates
    // snapshotted at booking time (not the branch's possibly-since-changed live rates).
    if (order.pricingMode && order.pricingMode !== BranchPricingMode.FLAT_BAG) {
      const finalServiceSubtotal = computeServiceSubtotal(order.pricingMode, order.pricingSnapshot, {
        weightKg: dto.verifiedWeightKg,
        loadCount: dto.verifiedLoadCount,
        pieceCount: dto.verifiedPieceCount,
      });
      const addonsSubtotal = order.addons.reduce((sum, a) => sum + a.price, 0);
      const finalTotal = finalServiceSubtotal + addonsSubtotal + order.deliveryFee - order.discount;

      let finalPartnerPayout: number | undefined;
      if (order.branchId && order.pricingModel === 'commission') {
        const branch = await this.branchesService.getActivePartnerShop(order.branchId.toString());
        const baseAddonsSum = await order.addons.reduce(async (accPromise, a) => {
          const acc = await accPromise;
          const basePrice = await this.branchesService.resolveBranchAddonPrice(branch, a.id);
          return acc + basePrice;
        }, Promise.resolve(0));
        finalPartnerPayout = Math.round(
          finalServiceSubtotal * (1 - branch.commissionRate) + baseAddonsSum,
        );
      }

      order.finalServiceSubtotal = finalServiceSubtotal;
      order.finalTotal = finalTotal;
      order.finalPartnerPayout = finalPartnerPayout;
      order.pickup.priceConfirmedAt = new Date();

      // Settlement/revenue/payout calculations read subtotal/total/baseSubtotal directly and have
      // no notion of "final" pricing — snapshot the booking-time estimate for display, then
      // overwrite the authoritative fields so every downstream calculation picks up the real
      // amount automatically. (Whether/how the customer's already-captured payment is adjusted
      // for the difference is a separate payments-module concern, not handled here.)
      order.estimatedSubtotal = order.subtotal;
      order.estimatedTotal = order.total;
      order.estimatedBaseSubtotal = order.baseSubtotal;
      order.subtotal = finalServiceSubtotal + addonsSubtotal;
      order.total = finalTotal;
      if (finalPartnerPayout != null) order.baseSubtotal = finalPartnerPayout;
    }

    await order.save();

    this.trackingGateway.emitOrderEvent(orderId, 'shopWeightVerified', {
      message: 'Shop verified laundry weight',
      verifiedWeightKg: dto.verifiedWeightKg,
      finalTotal: order.finalTotal,
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
        // Before finalization these are the same value; after, `total` has been overwritten with
        // the finalized amount (see verifyWeight), so fall back to the pre-finalization snapshot.
        total: order.estimatedTotal ?? order.total,
        estimatedWeightKg: order.estimatedWeightKg,
        estimatedLoadCount: order.estimatedLoadCount,
        estimatedPieceCount: order.estimatedPieceCount,
        branchName: order.branchName,
        pickup: order.pickup,
        pricingMode: order.pricingMode,
        finalServiceSubtotal: order.finalServiceSubtotal,
        finalTotal: order.finalTotal,
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
