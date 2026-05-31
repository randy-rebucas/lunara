import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus, UserRole } from '@lunara/types';
import {
  assertHandoffQrKind,
  buildHandoffQrPayload,
  HANDOFF_QR_KIND,
  parseHandoffQrPayload,
} from '@lunara/utils';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

function phoneVerificationHint(phone?: string) {
  if (!phone) return '0000';
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-4) || '0000';
}

@Injectable()
export class HandoffQrService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  parseQrPayload(raw: string) {
    const parsed = parseHandoffQrPayload(raw);
    if (!parsed) {
      throw new BadRequestException('Invalid QR code');
    }
    return parsed;
  }

  resolvePickupVerificationCode(input: { code?: string; qrPayload?: string }, expectedOrderId: string) {
    if (input.code) return input.code;
    if (!input.qrPayload) {
      throw new BadRequestException('Verification code or QR payload is required');
    }
    const parsed = this.parseQrPayload(input.qrPayload);
    assertHandoffQrKind(parsed, HANDOFF_QR_KIND.CUSTOMER_PICKUP);
    if (parsed.orderId !== expectedOrderId) {
      throw new BadRequestException('QR code is for a different order');
    }
    return parsed.secret;
  }

  resolveDeliveryVerificationCode(qrPayload: string, expectedOrderId: string) {
    const parsed = this.parseQrPayload(qrPayload);
    assertHandoffQrKind(parsed, HANDOFF_QR_KIND.CUSTOMER_DELIVERY);
    if (parsed.orderId !== expectedOrderId) {
      throw new BadRequestException('QR code is for a different order');
    }
    return parsed.secret;
  }

  validateOrderHandoverQr(qrPayload: string, order: OrderDocument) {
    const parsed = this.parseQrPayload(qrPayload);
    assertHandoffQrKind(parsed, HANDOFF_QR_KIND.ORDER_HANDOVER);
    if (parsed.orderId !== order._id.toString()) {
      throw new BadRequestException('QR code is for a different order');
    }
    if (!order.pickup?.receiptCode || parsed.secret !== order.pickup.receiptCode) {
      throw new BadRequestException('Order QR does not match pickup receipt');
    }
  }

  async getCustomerHandoffQr(orderId: string, customerId: string, context: 'pickup' | 'delivery') {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId.toString() !== customerId) throw new ForbiddenException();

    const customer = await this.userModel.findById(customerId).select('phone');
    const secret = phoneVerificationHint(customer?.phone);

    if (context === 'pickup') {
      if (!order.pickupRiderId) {
        throw new BadRequestException('Pickup rider has not been assigned yet');
      }
      if (
        order.status !== OrderStatus.RIDER_ASSIGNED_PICKUP &&
        order.status !== OrderStatus.RIDER_ASSIGNED
      ) {
        throw new BadRequestException('Pickup verification QR is not available for this order');
      }
      if (order.pickup?.customerVerifiedAt) {
        throw new BadRequestException('Customer already verified for pickup');
      }
      return {
        context,
        label: 'Show this QR to your rider',
        payload: buildHandoffQrPayload(HANDOFF_QR_KIND.CUSTOMER_PICKUP, orderId, secret),
      };
    }

    if (order.status !== OrderStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException('Delivery verification QR is not available yet');
    }
    if (order.delivery?.customerVerifiedAt || order.delivery?.customerReceivedAt) {
      throw new BadRequestException('Delivery already confirmed');
    }

    return {
      context,
      label: 'Show this QR to your rider',
      payload: buildHandoffQrPayload(HANDOFF_QR_KIND.CUSTOMER_DELIVERY, orderId, secret),
    };
  }

  async getOrderHandoffQr(orderId: string, user: { sub: string; role: UserRole }) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    if (user.role === UserRole.PARTNER) {
      if (order.partnerId?.toString() !== user.sub) {
        throw new ForbiddenException();
      }
    } else if (user.role === UserRole.RIDER) {
      if (order.pickupRiderId?.toString() !== user.sub) {
        throw new ForbiddenException();
      }
    } else if (user.role !== UserRole.ADMIN && user.role !== UserRole.STAFF) {
      throw new ForbiddenException();
    }

    if (!order.pickup?.receiptCode) {
      throw new BadRequestException('Pickup receipt has not been generated yet');
    }

    return {
      context: 'order_handover' as const,
      label: 'Order handover QR',
      receiptCode: order.pickup.receiptCode,
      payload: buildHandoffQrPayload(
        HANDOFF_QR_KIND.ORDER_HANDOVER,
        orderId,
        order.pickup.receiptCode,
      ),
    };
  }
}
