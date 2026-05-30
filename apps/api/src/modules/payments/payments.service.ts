import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@lunara/types';
import {
  generatePaymentReceiptCode,
  isPaymongoMethod,
  type CashTiming,
} from '@lunara/utils';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { WalletsService } from '../wallets/wallets.service';
import { Payment, PaymentDocument } from './schemas/payment.schema';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private walletsService: WalletsService,
    private trackingGateway: TrackingGateway,
  ) {}

  getCustomerWebUrl() {
    return process.env.CUSTOMER_WEB_URL ?? 'http://localhost:3000';
  }

  getSuccessRedirectUrl(orderId: string, paymentId: string) {
    const base = this.getCustomerWebUrl();
    return `${base}/checkout/${orderId}/success?paymentId=${paymentId}`;
  }

  async getForOrder(userId: string, orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId.toString() !== userId) {
      throw new BadRequestException('Not your order');
    }

    const payment = await this.paymentModel
      .findOne({ orderId: order._id })
      .sort({ createdAt: -1 });

    return {
      success: true,
      data: {
        order: {
          _id: order._id,
          status: order.status,
          total: order.total,
          bookingType: order.bookingType,
        },
        payment: payment ? this.serializePayment(payment) : null,
      },
    };
  }

  async getById(userId: string, paymentId: string) {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.userId.toString() !== userId) {
      throw new BadRequestException('Not your payment');
    }
    const order = await this.orderModel.findById(payment.orderId);
    return {
      success: true,
      data: {
        payment: this.serializePayment(payment),
        order: order
          ? {
              _id: order._id,
              status: order.status,
              total: order.total,
              bookingType: order.bookingType,
            }
          : null,
      },
    };
  }

  async createIntent(
    userId: string,
    orderId: string,
    method: PaymentMethod,
    cashTiming?: CashTiming,
  ) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId.toString() !== userId) {
      throw new BadRequestException('Not your order');
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is cancelled');
    }

    const paid = await this.paymentModel.findOne({
      orderId: order._id,
      status: PaymentStatus.PAID,
    });
    if (paid) throw new BadRequestException('Order already paid');

    if (method === PaymentMethod.CASH && !cashTiming) {
      throw new BadRequestException('Choose when you will pay cash: pickup or delivery');
    }

    await this.paymentModel.deleteMany({
      orderId: order._id,
      status: PaymentStatus.PENDING,
    });

    const payment = await this.paymentModel.create({
      orderId: order._id,
      userId: new Types.ObjectId(userId),
      method,
      amount: order.total,
      status: PaymentStatus.PENDING,
      cashTiming: method === PaymentMethod.CASH ? cashTiming : undefined,
    });

    payment.receiptCode = generatePaymentReceiptCode(orderId, payment._id.toString());

    if (method === PaymentMethod.WALLET) {
      await this.walletsService.debit(
        userId,
        order.total,
        payment._id.toString(),
        `Payment for order ${orderId}`,
      );
      await this.markPaid(payment, order, `wallet-${payment._id}`);
      return {
        success: true,
        data: {
          payment: this.serializePayment(payment),
          paid: true,
          receiptCode: payment.receiptCode,
        },
      };
    }

    if (method === PaymentMethod.CASH) {
      await payment.save();
      await this.confirmOrder(order);
      return {
        success: true,
        data: {
          payment: this.serializePayment(payment),
          paid: false,
          cash: true,
          cashTiming,
          receiptCode: payment.receiptCode,
          message:
            cashTiming === 'pickup'
              ? 'Pay cash to your rider on pickup. Booking confirmed.'
              : 'Pay cash when your laundry is delivered. Booking confirmed.',
        },
      };
    }

    if (isPaymongoMethod(method)) {
      const checkoutUrl = this.getPaymongoCheckoutUrl(payment._id.toString(), method, order.total);
      payment.checkoutUrl = checkoutUrl;
      payment.externalId = `paymongo-${method}-${payment._id}`;
      await payment.save();
      return {
        success: true,
        data: {
          payment: this.serializePayment(payment),
          paid: false,
          checkoutUrl,
          provider: 'paymongo',
          message: 'Continue to PayMongo to complete payment',
        },
      };
    }

    await payment.save();
    return { success: true, data: { payment: this.serializePayment(payment) } };
  }

  async confirmPayment(paymentId: string, externalId?: string) {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.PAID) {
      return { success: true, data: this.serializePayment(payment) };
    }

    const order = await this.orderModel.findById(payment.orderId);
    if (!order) throw new NotFoundException('Order not found');

    await this.markPaid(payment, order, externalId);
    return { success: true, data: this.serializePayment(payment) };
  }

  private async markPaid(
    payment: PaymentDocument,
    order: OrderDocument,
    externalId?: string,
  ) {
    payment.status = PaymentStatus.PAID;
    payment.paidAt = new Date();
    if (externalId) payment.externalId = externalId;
    if (!payment.receiptCode) {
      payment.receiptCode = generatePaymentReceiptCode(
        order._id.toString(),
        payment._id.toString(),
      );
    }
    await payment.save();
    await this.confirmOrder(order);
  }

  private async confirmOrder(order: OrderDocument) {
    if (order.status === OrderStatus.PENDING) {
      order.status = OrderStatus.PENDING_DISPATCH;
      order.statusHistory.push({
        status: OrderStatus.PENDING_DISPATCH,
        timestamp: new Date(),
        note: 'Payment confirmed — pending dispatch to laundry shop',
      });
      await order.save();
      this.trackingGateway.emitOrderEvent(order._id.toString(), 'awaitingDispatch', {
        message:
          'Payment received. Lunara is assigning your laundry partner — pickup starts after dispatch.',
      });
      this.trackingGateway.emitAdminDispatcherAlert({
        type: 'awaiting_shop',
        orderId: order._id.toString(),
        status: order.status,
        message: 'New paid order — assign laundry shop',
      });
      this.trackingGateway.emitDispatchQueueUpdated({
        reason: 'payment_confirmed',
        orderId: order._id.toString(),
      });
    }
  }

  private getPaymongoCheckoutUrl(paymentId: string, method: PaymentMethod, amount: number) {
    const base = process.env.API_URL ?? 'http://localhost:3001';
    return `${base}/api/v1/payments/mock/paymongo/checkout?paymentId=${paymentId}&method=${method}&amount=${amount}`;
  }

  serializePayment(payment: PaymentDocument) {
    return {
      _id: payment._id.toString(),
      orderId: payment.orderId.toString(),
      method: payment.method,
      status: payment.status,
      amount: payment.amount,
      receiptCode: payment.receiptCode,
      cashTiming: payment.cashTiming,
      paidAt: payment.paidAt,
      checkoutUrl: payment.checkoutUrl,
      externalId: payment.externalId,
      createdAt: payment.createdAt,
    };
  }
}
