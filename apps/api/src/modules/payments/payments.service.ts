import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@lunara/types';
import {
  generatePaymentReceiptCode,
  isPaymongoMethod,
  buildRiderCashPaymentInfo,
  type CashTiming,
  type RiderCashPaymentInfo,
} from '@lunara/utils';
import { BranchesService } from '../branches/branches.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { WalletsService } from '../wallets/wallets.service';
import { PaymongoService } from './paymongo.service';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private walletsService: WalletsService,
    private trackingGateway: TrackingGateway,
    private paymongo: PaymongoService,
    private branchesService: BranchesService,
    private ledgerService: LedgerService,
  ) {}

  getCustomerWebUrl() {
    return process.env.CUSTOMER_WEB_URL ?? 'http://localhost:3000';
  }

  resolveWebOrigin(clientOrigin?: string) {
    const fallback = this.getCustomerWebUrl().replace(/\/$/, '');
    if (!clientOrigin?.trim()) return fallback;

    try {
      const url = new URL(clientOrigin);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;

      if (process.env.NODE_ENV === 'production') {
        const allowed = new URL(fallback);
        if (url.host !== allowed.host) return fallback;
      }

      return url.origin;
    } catch {
      return fallback;
    }
  }

  getOrderSuccessRedirectUrl(orderId: string, paymentId: string, baseUrl?: string) {
    const base = (baseUrl ?? this.getCustomerWebUrl()).replace(/\/$/, '');
    return `${base}/checkout/${orderId}/success?paymentId=${paymentId}`;
  }

  getWalletTopupSuccessUrl(paymentId: string, baseUrl?: string) {
    const base = (baseUrl ?? this.getCustomerWebUrl()).replace(/\/$/, '');
    return `${base}/wallet?topupPaymentId=${paymentId}`;
  }

  getRedirectUrlAfterPayment(payment: {
    _id: string;
    orderId?: string;
    purpose?: string;
    returnOrigin?: string;
  }) {
    const base = payment.returnOrigin ?? this.getCustomerWebUrl();
    if (payment.purpose === 'wallet_topup') {
      return this.getWalletTopupSuccessUrl(payment._id, base);
    }
    if (!payment.orderId) {
      return base.replace(/\/$/, '');
    }
    return this.getOrderSuccessRedirectUrl(payment.orderId, payment._id, base);
  }

  async getForOrder(userId: string, orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId.toString() !== userId) {
      throw new BadRequestException('Not your order');
    }

    const payment = await this.paymentModel
      .findOne({ orderId: order._id, purpose: 'order' })
      .sort({ createdAt: -1 });

    if (payment?.status === PaymentStatus.PENDING && payment.paymongoSessionId) {
      try {
        await this.syncPaymongoPayment(payment);
      } catch (err) {
        this.logger.debug(`PayMongo sync skipped for order ${orderId}: ${err}`);
      }
    }

    const refreshed = payment
      ? await this.paymentModel.findById(payment._id)
      : null;

    return {
      success: true,
      data: {
        order: {
          _id: order._id,
          status: order.status,
          total: order.total,
          bookingType: order.bookingType,
        },
        payment: refreshed ? this.serializePayment(refreshed) : null,
      },
    };
  }

  async getById(userId: string, paymentId: string) {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.userId.toString() !== userId) {
      throw new BadRequestException('Not your payment');
    }

    if (payment.status === PaymentStatus.PENDING && payment.paymongoSessionId) {
      try {
        await this.syncPaymongoPayment(payment);
      } catch (err) {
        this.logger.debug(`PayMongo sync skipped for ${paymentId}: ${err}`);
      }
    }

    const refreshed = await this.paymentModel.findById(paymentId);
    const order =
      refreshed?.orderId != null
        ? await this.orderModel.findById(refreshed.orderId)
        : null;

    return {
      success: true,
      data: {
        payment: this.serializePayment(refreshed!),
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

  async syncPayment(userId: string, paymentId: string) {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.userId.toString() !== userId) {
      throw new BadRequestException('Not your payment');
    }
    await this.syncPaymongoPayment(payment);
    const refreshed = await this.paymentModel.findById(paymentId);
    return { success: true, data: this.serializePayment(refreshed!) };
  }

  async createIntent(
    userId: string,
    orderId: string,
    method: PaymentMethod,
    cashTiming?: CashTiming,
    clientOrigin?: string,
  ) {
    const webOrigin = this.resolveWebOrigin(clientOrigin);
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId.toString() !== userId) {
      throw new BadRequestException('Not your order');
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is cancelled');
    }
    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.PENDING_DISPATCH
    ) {
      throw new BadRequestException('Order is no longer awaiting payment');
    }

    const paid = await this.paymentModel.findOne({
      orderId: order._id,
      purpose: 'order',
      status: PaymentStatus.PAID,
    });
    if (paid) throw new BadRequestException('Order already paid');

    if (method === PaymentMethod.CASH && !cashTiming) {
      throw new BadRequestException('Choose when you will pay cash: pickup or delivery');
    }

    await this.paymentModel.deleteMany({
      orderId: order._id,
      purpose: 'order',
      status: PaymentStatus.PENDING,
    });

    const payment = await this.paymentModel.create({
      orderId: order._id,
      userId: new Types.ObjectId(userId),
      purpose: 'order',
      method,
      amount: order.total,
      status: PaymentStatus.PENDING,
      cashTiming: method === PaymentMethod.CASH ? cashTiming : undefined,
      returnOrigin: webOrigin,
    });

    payment.receiptCode = generatePaymentReceiptCode(orderId, payment._id.toString());

    if (method === PaymentMethod.WALLET) {
      await this.walletsService.debit(
        userId,
        order.total,
        payment._id.toString(),
        `Payment for order ${orderId}`,
      );
      try {
        await this.markOrderPaid(payment, order, `wallet-${payment._id}`);
      } catch (err) {
        await this.ledgerService.reverse(
          `payment:${payment._id.toString()}`,
          `payment-rollback:${payment._id.toString()}`,
          'refund',
          payment._id.toString(),
        );
        await this.walletsService.credit(
          userId,
          order.total,
          `refund-wallet-${payment._id}`,
          `Refund — order payment failed for ${orderId}`,
        );
        payment.status = PaymentStatus.FAILED;
        await payment.save();
        throw err;
      }
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
      const checkout = await this.startPaymongoCheckout(payment, {
        description: `Lunara order ${orderId.slice(-6)}`,
        lineItemName: 'Laundry service',
        paymentMethod: method,
        successUrl: this.getOrderSuccessRedirectUrl(orderId, payment._id.toString(), webOrigin),
        cancelUrl: `${webOrigin}/checkout/${orderId}`,
        metadata: {
          lunara_payment_id: payment._id.toString(),
          lunara_purpose: 'order',
          lunara_user_id: userId,
        },
      });

      return {
        success: true,
        data: {
          payment: this.serializePayment(payment),
          paid: false,
          checkoutUrl: checkout.checkoutUrl,
          provider: 'paymongo',
          message: 'Continue to PayMongo to complete payment',
        },
      };
    }

    await payment.save();
    return { success: true, data: { payment: this.serializePayment(payment) } };
  }

  async createWalletTopupIntent(
    userId: string,
    amount: number,
    method: PaymentMethod,
    clientOrigin?: string,
  ) {
    if (!isPaymongoMethod(method)) {
      throw new BadRequestException('Wallet top-up requires GCash, Maya, or card via PayMongo');
    }

    const webOrigin = this.resolveWebOrigin(clientOrigin);

    await this.paymentModel.deleteMany({
      userId: new Types.ObjectId(userId),
      purpose: 'wallet_topup',
      status: PaymentStatus.PENDING,
    });

    const payment = await this.paymentModel.create({
      userId: new Types.ObjectId(userId),
      purpose: 'wallet_topup',
      method,
      amount,
      status: PaymentStatus.PENDING,
      returnOrigin: webOrigin,
    });

    payment.receiptCode = generatePaymentReceiptCode(userId, payment._id.toString());

    const checkout = await this.startPaymongoCheckout(payment, {
      description: 'Lunara wallet top-up',
      lineItemName: 'Wallet top-up',
      paymentMethod: method,
      successUrl: this.getWalletTopupSuccessUrl(payment._id.toString(), webOrigin),
      cancelUrl: `${webOrigin}/wallet`,
      metadata: {
        lunara_payment_id: payment._id.toString(),
        lunara_purpose: 'wallet_topup',
        lunara_user_id: userId,
      },
    });

    return {
      success: true,
      data: {
        payment: this.serializePayment(payment),
        checkoutUrl: checkout.checkoutUrl,
        provider: 'paymongo',
        message: 'Continue to PayMongo to complete your top-up',
      },
    };
  }

  async confirmPayment(paymentId: string, externalId?: string) {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.PAID) {
      return { success: true, data: this.serializePayment(payment) };
    }

    await this.fulfillPayment(payment, externalId);
    const refreshed = await this.paymentModel.findById(paymentId);
    return { success: true, data: this.serializePayment(refreshed!) };
  }

  async handlePaymongoWebhook(rawBody: Buffer, signatureHeader: string | undefined) {
    if (!this.paymongo.verifyWebhookSignature(rawBody, signatureHeader)) {
      throw new BadRequestException('Invalid PayMongo webhook signature');
    }

    const event = this.paymongo.parseWebhookEvent(rawBody);
    if (!event || !this.paymongo.isPaidWebhookEvent(event.type)) {
      return { success: true, data: { ignored: true } };
    }

    const paymentId = event.metadata.lunara_payment_id;
    if (!paymentId) {
      this.logger.warn('PayMongo webhook missing lunara_payment_id metadata');
      return { success: true, data: { ignored: true } };
    }

    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) {
      this.logger.warn(`PayMongo webhook for unknown payment ${paymentId}`);
      return { success: true, data: { ignored: true } };
    }

    if (payment.status === PaymentStatus.PAID) {
      return { success: true, data: this.serializePayment(payment) };
    }

    await this.fulfillPayment(payment, event.paymongoPaymentId);
    const refreshed = await this.paymentModel.findById(paymentId);
    return { success: true, data: this.serializePayment(refreshed!) };
  }

  private async startPaymongoCheckout(
    payment: PaymentDocument,
    params: {
      description: string;
      lineItemName: string;
      paymentMethod: PaymentMethod;
      successUrl: string;
      cancelUrl: string;
      metadata: Record<string, string>;
    },
  ) {
    if (this.paymongo.isConfigured()) {
      const session = await this.paymongo.createCheckoutSession({
        amount: payment.amount,
        description: params.description,
        lineItemName: params.lineItemName,
        paymentMethod: params.paymentMethod,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
        metadata: params.metadata,
      });
      payment.checkoutUrl = session.checkoutUrl;
      payment.paymongoSessionId = session.sessionId;
      payment.externalId = session.sessionId;
      await payment.save();
      return { checkoutUrl: session.checkoutUrl };
    }

    const checkoutUrl = this.getMockPaymongoCheckoutUrl(
      payment._id.toString(),
      params.paymentMethod,
      payment.amount,
      payment.purpose,
    );
    payment.checkoutUrl = checkoutUrl;
    payment.externalId = `mock-paymongo-${payment._id}`;
    await payment.save();
    return { checkoutUrl };
  }

  private getMockPaymongoCheckoutUrl(
    paymentId: string,
    method: PaymentMethod,
    amount: number,
    purpose: string,
  ) {
    const base = process.env.API_URL ?? 'http://localhost:3001';
    return `${base}/api/v1/payments/mock/paymongo/checkout?paymentId=${paymentId}&method=${method}&amount=${amount}&purpose=${purpose}`;
  }

  private async syncPaymongoPayment(payment: PaymentDocument) {
    if (!payment.paymongoSessionId || !this.paymongo.isConfigured()) return;
    if (payment.status === PaymentStatus.PAID) return;

    const session = await this.paymongo.getCheckoutSession(payment.paymongoSessionId);
    if (session.isPaid) {
      await this.fulfillPayment(payment, session.paymentId);
      return;
    }
    if (session.sessionStatus === 'expired' && payment.status === PaymentStatus.PENDING) {
      payment.status = PaymentStatus.FAILED;
      await payment.save();
    }
  }

  private async fulfillPayment(payment: PaymentDocument, externalId?: string) {
    if (payment.status === PaymentStatus.PAID) return;

    if (payment.purpose === 'wallet_topup') {
      await this.markWalletTopupPaid(payment, externalId);
      return;
    }

    const order = await this.orderModel.findById(payment.orderId);
    if (!order) throw new NotFoundException('Order not found');
    await this.markOrderPaid(payment, order, externalId);
  }

  private async markWalletTopupPaid(payment: PaymentDocument, externalId?: string) {
    payment.status = PaymentStatus.PAID;
    payment.paidAt = new Date();
    if (externalId) payment.externalId = externalId;
    await payment.save();

    await this.walletsService.credit(
      payment.userId.toString(),
      payment.amount,
      `topup-${payment._id}`,
      'Wallet top-up via PayMongo',
    );

    await this.ledgerService.post(
      `payment:${payment._id.toString()}`,
      'wallet_topup',
      payment._id.toString(),
      [
        {
          accountType: 'platform_cash',
          direction: 'debit',
          amount: payment.amount,
          description: `PayMongo wallet top-up received from user ${payment.userId.toString()}`,
        },
        {
          accountType: 'customer_wallet_liability',
          accountSubject: payment.userId.toString(),
          direction: 'credit',
          amount: payment.amount,
          description: `Wallet balance increased for user ${payment.userId.toString()}`,
        },
      ],
    );
  }

  private async markOrderPaid(
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

    // Wallet-funded orders draw down an already-recognized liability, not new cash —
    // crediting platform_cash again here would double-count money already posted at top-up.
    const sourceAccount =
      payment.method === PaymentMethod.WALLET
        ? ({
            accountType: 'customer_wallet_liability' as const,
            accountSubject: payment.userId.toString(),
          })
        : ({ accountType: 'platform_cash' as const });

    await this.ledgerService.post(
      `payment:${payment._id.toString()}`,
      'payment',
      payment._id.toString(),
      [
        {
          ...sourceAccount,
          direction: 'debit',
          amount: payment.amount,
          description:
            payment.method === PaymentMethod.WALLET
              ? `Wallet debited for order ${order._id.toString().slice(-6)}`
              : `PayMongo payment received for order ${order._id.toString().slice(-6)}`,
        },
        {
          accountType: 'order_revenue_clearing',
          direction: 'credit',
          amount: payment.amount,
          description: `Order revenue recognized from digital payment (order ${order._id.toString().slice(-6)})`,
        },
      ],
    );

    await this.confirmOrder(order);
  }

  private async confirmOrder(order: OrderDocument) {
    if (order.status !== OrderStatus.PENDING) return;

    // Partner white-labeled bookings already have their branch pre-resolved at checkout
    // (booking.service.ts) — those go straight to their own shop and skip the shared
    // admin dispatch queue entirely.
    if (order.branchId) {
      await this.branchesService.finalizePreResolvedShopAssignment(order);
      return;
    }

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

  async getRiderCashPaymentInfo(
    orderId: string,
    stage: 'pickup' | 'delivery',
    readyToCollect: boolean,
  ): Promise<RiderCashPaymentInfo | null> {
    const payment = await this.paymentModel
      .findOne({
        orderId: new Types.ObjectId(orderId),
        purpose: 'order',
        method: PaymentMethod.CASH,
      })
      .sort({ createdAt: -1 });

    if (!payment?.cashTiming) return null;

    return buildRiderCashPaymentInfo({
      timing: payment.cashTiming as CashTiming,
      amount: payment.amount,
      status: payment.status,
      receiptCode: payment.receiptCode,
      stage,
      readyToCollect,
    });
  }

  async assertCashCollectedForStage(orderId: string, stage: 'pickup' | 'delivery') {
    const payment = await this.paymentModel.findOne({
      orderId: new Types.ObjectId(orderId),
      purpose: 'order',
      method: PaymentMethod.CASH,
      cashTiming: stage,
    });
    if (!payment) return;
    if (payment.status !== PaymentStatus.PAID) {
      throw new BadRequestException(
        stage === 'pickup'
          ? 'Collect cash from customer before picking up laundry'
          : 'Collect cash from customer before completing delivery',
      );
    }
  }

  async collectCashForOrder(orderId: string, riderUserId: string, stage: 'pickup' | 'delivery') {
    const payment = await this.paymentModel.findOne({
      orderId: new Types.ObjectId(orderId),
      purpose: 'order',
      method: PaymentMethod.CASH,
      cashTiming: stage,
    });
    if (!payment) {
      throw new BadRequestException('No cash payment due at this stage');
    }
    if (payment.status === PaymentStatus.PAID) {
      return payment;
    }

    payment.status = PaymentStatus.PAID;
    payment.paidAt = new Date();
    payment.cashCollectedBy = new Types.ObjectId(riderUserId);
    payment.externalId = `cash-${stage}-${payment._id}`;
    await payment.save();

    this.trackingGateway.emitOrderEvent(orderId, 'paymentReceived', {
      message: 'Cash payment received',
      amount: payment.amount,
      method: PaymentMethod.CASH,
      receiptCode: payment.receiptCode,
    });

    return payment;
  }

  serializePayment(payment: PaymentDocument) {
    return {
      _id: payment._id.toString(),
      orderId: payment.orderId?.toString(),
      purpose: payment.purpose,
      method: payment.method,
      status: payment.status,
      amount: payment.amount,
      receiptCode: payment.receiptCode,
      cashTiming: payment.cashTiming,
      paidAt: payment.paidAt,
      checkoutUrl: payment.checkoutUrl,
      externalId: payment.externalId,
      paymongoSessionId: payment.paymongoSessionId,
      returnOrigin: payment.returnOrigin,
      createdAt: payment.createdAt,
    };
  }
}
