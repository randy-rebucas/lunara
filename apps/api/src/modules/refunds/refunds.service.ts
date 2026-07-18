import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@lunara/types';
import { REFUND_FLOW, isRefundablePaymentMethod } from '@lunara/utils';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { NotificationDispatchService } from '../push/notification-dispatch.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { WalletsService } from '../wallets/wallets.service';
import { LedgerService } from '../ledger/ledger.service';
import { PartnerOperationsService } from '../partner/partner-operations.service';
import { EmailService } from '../../common/email/email.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { RefundReviewAction, ReviewRefundDto } from './dto/review-refund.dto';
import {
  RefundRequest,
  RefundRequestDocument,
  RefundStage,
  RefundStatus,
} from './schemas/refund-request.schema';

const REFUNDABLE_ORDER_STATUSES = [
  OrderStatus.PENDING_DISPATCH,
  OrderStatus.SHOP_ASSIGNED,
  OrderStatus.CONFIRMED,
  OrderStatus.RIDER_ASSIGNED_PICKUP,
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT_TO_SHOP,
  OrderStatus.RECEIVED_AT_SHOP,
  OrderStatus.RECEIVED,
  OrderStatus.SORTING,
  OrderStatus.WASHING,
  OrderStatus.DRYING,
  OrderStatus.FOLDING,
  OrderStatus.IRONING,
  OrderStatus.QUALITY_CHECK,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
];

@Injectable()
export class RefundsService {
  constructor(
    @InjectModel(RefundRequest.name) private refundModel: Model<RefundRequestDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private walletsService: WalletsService,
    private trackingGateway: TrackingGateway,
    private notificationDispatch: NotificationDispatchService,
    private ledgerService: LedgerService,
    private emailService: EmailService,
    private partnerOperationsService: PartnerOperationsService,
  ) {}

  async createRequest(customerId: string, dto: CreateRefundDto) {
    const order = await this.orderModel.findById(dto.orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId.toString() !== customerId) {
      throw new ForbiddenException('This order does not belong to you');
    }
    if (order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('This order has already been refunded');
    }
    if (!REFUNDABLE_ORDER_STATUSES.includes(order.status)) {
      throw new BadRequestException('This order is not eligible for a refund request');
    }

    const payment = await this.paymentModel.findOne({
      orderId: order._id,
      status: PaymentStatus.PAID,
    });
    if (!payment) {
      throw new BadRequestException(
        'No completed payment found for this order. Refunds apply to paid orders.',
      );
    }
    if (payment.method === PaymentMethod.CASH || !isRefundablePaymentMethod(payment.method)) {
      throw new BadRequestException(
        'Cash on pickup or delivery orders are not eligible for wallet refunds. Contact support if you need help.',
      );
    }

    const existing = await this.refundModel.findOne({
      orderId: order._id,
      status: {
        $nin: [RefundStatus.REJECTED, RefundStatus.CLOSED, RefundStatus.PROCESSED],
      },
    });
    if (existing) {
      throw new BadRequestException('A refund request is already open for this order');
    }

    const requestedAmount = dto.requestedAmount ?? order.total;
    if (requestedAmount > order.total) {
      throw new BadRequestException('Requested amount cannot exceed order total');
    }

    const refund = await this.refundModel.create({
      orderId: order._id,
      customerId: new Types.ObjectId(customerId),
      paymentId: payment._id,
      reason: dto.reason,
      status: RefundStatus.PENDING,
      stage: RefundStage.SUBMITTED,
      requestedAmount,
      timeline: [
        {
          stage: RefundStage.SUBMITTED,
          label: 'Refund request submitted',
          at: new Date(),
        },
      ],
    });

    return { success: true, data: this.serializeRefund(refund) };
  }

  async listCustomerRefunds(customerId: string) {
    const items = await this.refundModel
      .find({ customerId: new Types.ObjectId(customerId) })
      .sort({ updatedAt: -1 })
      .limit(50);
    return { success: true, data: items.map((r) => this.serializeRefund(r)) };
  }

  async getCustomerRefund(customerId: string, refundId: string) {
    const refund = await this.refundModel.findById(refundId);
    if (!refund) throw new NotFoundException('Refund request not found');
    if (refund.customerId.toString() !== customerId) {
      throw new ForbiddenException('Access denied');
    }
    return {
      success: true,
      data: {
        refund: this.serializeRefund(refund),
        flow: REFUND_FLOW,
      },
    };
  }

  async listAdminRefunds(status?: string) {
    const filter = status ? { status } : {};
    const items = await this.refundModel.find(filter).sort({ updatedAt: -1 }).limit(100);
    const orders = await this.orderModel
      .find({ _id: { $in: items.map((r) => r.orderId) } })
      .select('customerId bookingType total status');
    const customers = await this.customerModel
      .find({ userId: { $in: items.map((r) => r.customerId) } })
      .select('userId firstName lastName avatarUrl')
      .lean();

    const orderMap = new Map(orders.map((o) => [o._id.toString(), o]));
    const customerMap = new Map(customers.map((c) => [c.userId.toString(), c]));

    const [pending, underReview, approved, total, processedAgg] = await Promise.all([
      this.refundModel.countDocuments({ status: RefundStatus.PENDING }),
      this.refundModel.countDocuments({ status: RefundStatus.UNDER_REVIEW }),
      this.refundModel.countDocuments({ status: RefundStatus.APPROVED }),
      this.refundModel.countDocuments({}),
      this.refundModel.aggregate<{ _id: null; count: number; amount: number }>([
        {
          $match: {
            $or: [
              { status: RefundStatus.PROCESSED },
              { status: RefundStatus.CLOSED, processedAt: { $ne: null } },
            ],
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            amount: { $sum: { $ifNull: ['$approvedAmount', '$requestedAmount'] } },
          },
        },
      ]),
    ]);
    const rejected = await this.refundModel.countDocuments({ status: RefundStatus.REJECTED });

    return {
      success: true,
      data: {
        items: items.map((r) => {
          const customer = customerMap.get(r.customerId.toString());
          return {
            ...this.serializeRefund(r),
            orderStatus: orderMap.get(r.orderId.toString())?.status,
            bookingType: orderMap.get(r.orderId.toString())?.bookingType,
            customerName: customer ? `${customer.firstName} ${customer.lastName}`.trim() : undefined,
            customerAvatarUrl: customer?.avatarUrl,
          };
        }),
        counts: {
          pending,
          underReview,
          approved,
          total,
          rejected,
          processed: processedAgg[0]?.count ?? 0,
          refundedAmount: processedAgg[0]?.amount ?? 0,
        },
      },
    };
  }

  async getAdminRefund(refundId: string) {
    const refund = await this.refundModel.findById(refundId);
    if (!refund) throw new NotFoundException('Refund request not found');

    const order = await this.orderModel.findById(refund.orderId);
    const payment = refund.paymentId
      ? await this.paymentModel.findById(refund.paymentId)
      : await this.paymentModel.findOne({ orderId: refund.orderId, status: PaymentStatus.PAID });

    return {
      success: true,
      data: {
        refund: this.serializeRefund(refund),
        flow: REFUND_FLOW,
        order: order ? this.serializeOrderForReview(order) : null,
        payment: payment
          ? {
              _id: payment._id.toString(),
              method: payment.method,
              status: payment.status,
              amount: payment.amount,
              paidAt: payment.paidAt,
              receiptCode: payment.receiptCode,
            }
          : null,
        verification: order
          ? {
              customerMatches: true,
              orderTotal: order.total,
              orderStatus: order.status,
              paymentMatchesOrder: payment?.amount === order.total,
              paymentPaid: payment?.status === PaymentStatus.PAID,
              eligibleForRefund:
                payment?.status === PaymentStatus.PAID &&
                order.status !== OrderStatus.REFUNDED &&
                isRefundablePaymentMethod(payment.method),
            }
          : null,
      },
    };
  }

  async reviewRefund(refundId: string, adminUserId: string, dto: ReviewRefundDto) {
    const refund = await this.refundModel.findById(refundId);
    if (!refund) throw new NotFoundException('Refund request not found');
    if (refund.status === RefundStatus.CLOSED) {
      throw new BadRequestException('Refund request is closed');
    }

    const pushTimeline = (stage: string, label: string, note?: string) => {
      refund.timeline.push({ stage, label, at: new Date(), note });
    };

    switch (dto.action) {
      case RefundReviewAction.START_REVIEW:
        refund.status = RefundStatus.UNDER_REVIEW;
        refund.stage = RefundStage.ADMIN_REVIEW;
        refund.reviewedBy = new Types.ObjectId(adminUserId);
        pushTimeline('admin_review', 'Admin review started', dto.adminNote);
        break;

      case RefundReviewAction.VERIFY_ORDER: {
        const order = await this.orderModel.findById(refund.orderId);
        if (!order) throw new NotFoundException('Order not found');
        const payment = await this.paymentModel.findOne({
          orderId: order._id,
          status: PaymentStatus.PAID,
        });
        if (!payment) {
          throw new BadRequestException('Order has no paid payment to refund');
        }
        refund.paymentId = payment._id;
        refund.orderVerifiedAt = new Date();
        refund.status = RefundStatus.VERIFIED;
        refund.stage = RefundStage.ORDER_VERIFIED;
        pushTimeline('order_verified', 'Order and payment verified', dto.adminNote);
        break;
      }

      case RefundReviewAction.APPROVE: {
        if (!refund.orderVerifiedAt) {
          throw new BadRequestException('Verify the order before approving');
        }
        const approvedAmount = dto.approvedAmount ?? refund.requestedAmount;
        if (approvedAmount <= 0) {
          throw new BadRequestException('Approved amount must be greater than zero');
        }
        // Bound to what was actually paid, not just the originally requested amount — an admin
        // could otherwise approve more than the customer ever paid for this order.
        const payment = refund.paymentId
          ? await this.paymentModel.findById(refund.paymentId)
          : null;
        const maxRefundable = payment?.amount ?? refund.requestedAmount;
        if (approvedAmount > maxRefundable) {
          throw new BadRequestException(
            `Approved amount cannot exceed the amount paid (₱${maxRefundable})`,
          );
        }
        refund.status = RefundStatus.APPROVED;
        refund.stage = RefundStage.DECISION;
        refund.approvedAmount = approvedAmount;
        if (dto.adminNote) refund.adminNote = dto.adminNote;
        pushTimeline(
          'decision',
          `Approved — ₱${refund.approvedAmount}`,
          dto.adminNote,
        );
        break;
      }

      case RefundReviewAction.REJECT:
        refund.status = RefundStatus.REJECTED;
        refund.stage = RefundStage.DECISION;
        refund.rejectionReason = dto.rejectionReason ?? dto.adminNote ?? 'Refund denied';
        pushTimeline('decision', 'Refund rejected', refund.rejectionReason);
        break;

      case RefundReviewAction.PROCESS: {
        // Atomically claim the APPROVED -> PROCESSED transition so two concurrent PROCESS calls
        // (double-click, retried request) can't both pass a stale in-memory status check and both
        // call executeRefund. The wallet/ledger layers are independently idempotent by reference,
        // but this closes the race at the source instead of relying solely on that backstop.
        const processedAt = new Date();
        const claimed = await this.refundModel.findOneAndUpdate(
          { _id: refund._id, status: RefundStatus.APPROVED },
          { status: RefundStatus.PROCESSED, processedAt },
          { new: false },
        );
        if (!claimed) {
          throw new BadRequestException('Approve the refund before processing');
        }
        try {
          await this.executeRefund(refund);
        } catch (err) {
          // Roll back the claim so the refund isn't stuck "processed" with no money moved.
          await this.refundModel.updateOne(
            { _id: refund._id },
            { status: RefundStatus.APPROVED, $unset: { processedAt: 1 } },
          );
          throw err;
        }
        refund.status = RefundStatus.PROCESSED;
        refund.stage = RefundStage.PROCESSED;
        refund.processedAt = processedAt;
        pushTimeline(
          'processed',
          `₱${refund.approvedAmount} refunded to wallet`,
          dto.adminNote,
        );
        break;
      }

      case RefundReviewAction.NOTIFY:
        await this.notifyCustomer(refund);
        refund.customerNotifiedAt = new Date();
        refund.stage = RefundStage.NOTIFIED;
        if (refund.status === RefundStatus.PROCESSED || refund.status === RefundStatus.REJECTED) {
          refund.status = RefundStatus.CLOSED;
        }
        pushTimeline('notified', 'Customer notified', dto.adminNote);
        break;

      default:
        throw new BadRequestException('Unknown review action');
    }

    if (dto.adminNote && dto.action !== RefundReviewAction.REJECT) {
      refund.adminNote = dto.adminNote;
    }
    await refund.save();
    return this.getAdminRefund(refundId);
  }

  private async executeRefund(refund: RefundRequestDocument) {
    const amount = refund.approvedAmount ?? refund.requestedAmount;
    if (!amount || amount <= 0) {
      throw new BadRequestException('Invalid refund amount');
    }

    const order = await this.orderModel.findById(refund.orderId);
    if (!order) throw new NotFoundException('Order not found');

    const payment = refund.paymentId
      ? await this.paymentModel.findById(refund.paymentId)
      : await this.paymentModel.findOne({
          orderId: refund.orderId,
          status: PaymentStatus.PAID,
        });
    if (!payment || !isRefundablePaymentMethod(payment.method)) {
      throw new BadRequestException(
        'Cannot process a wallet refund for cash on pickup or delivery payments',
      );
    }

    await this.walletsService.credit(
      refund.customerId.toString(),
      amount,
      `refund-${refund._id}`,
      `Refund for order ${order._id.toString().slice(-6)}`,
    );

    if (payment && payment.status === PaymentStatus.PAID) {
      payment.status = PaymentStatus.REFUNDED;
      await payment.save();
    }

    await this.ledgerService.post(
      `refund:${refund._id.toString()}`,
      'refund',
      refund._id.toString(),
      [
        {
          accountType: 'order_revenue_clearing',
          direction: 'debit',
          amount,
          description: `Refund reverses recognized revenue for order ${order._id.toString().slice(-6)}`,
        },
        {
          accountType: 'customer_wallet_liability',
          accountSubject: refund.customerId.toString(),
          direction: 'credit',
          amount,
          description: `Refund credited to wallet for order ${order._id.toString().slice(-6)}`,
        },
      ],
    );

    if (order.status !== OrderStatus.REFUNDED) {
      order.status = OrderStatus.REFUNDED;
      order.statusHistory.push({
        status: OrderStatus.REFUNDED,
        timestamp: new Date(),
        note: `Refund processed — ₱${amount}`,
      });
      await order.save();
    }

    if (order.settlementId) {
      await this.partnerOperationsService.recordSettlementClawback(order, amount);
    }

    this.trackingGateway.emitOrderEvent(order._id.toString(), 'refundProcessed', {
      message: `Refund of ₱${amount} credited to your wallet`,
      refundId: refund._id.toString(),
      amount,
    });
  }

  private async notifyCustomer(refund: RefundRequestDocument) {
    const isRejected = refund.status === RefundStatus.REJECTED;
    const isProcessed = refund.status === RefundStatus.PROCESSED;
    const isApproved = refund.status === RefundStatus.APPROVED;

    let title: string;
    let body: string;

    if (isRejected) {
      title = 'Refund request declined';
      body =
        refund.rejectionReason ??
        'Your refund request was reviewed and could not be approved.';
    } else if (isProcessed && refund.processedAt) {
      title = 'Refund processed';
      body = `₱${refund.approvedAmount ?? refund.requestedAmount} has been credited to your Lunara wallet.`;
    } else if (isApproved) {
      title = 'Refund approved';
      body = `Your refund of ₱${refund.approvedAmount ?? refund.requestedAmount} was approved and will be processed shortly.`;
    } else {
      title = 'Refund request update';
      body = 'Your refund request is being reviewed by our team.';
    }

    const notification = await this.notificationDispatch.dispatch({
      userId: refund.customerId.toString(),
      title,
      body,
      channelId: 'orders',
      data: {
        type: 'refund_update',
        refundId: refund._id.toString(),
        orderId: refund.orderId.toString(),
        status: refund.status,
      },
    });

    this.trackingGateway.emitOrderEvent(refund.orderId.toString(), 'refundNotified', {
      message: body,
      notificationId: notification._id.toString(),
      refundId: refund._id.toString(),
    });

    if (isApproved || isProcessed) {
      void this.sendRefundEmail(refund);
    }
  }

  private async sendRefundEmail(refund: RefundRequestDocument) {
    try {
      const user = await this.userModel.findById(refund.customerId).select('email').lean();
      if (!user?.email) return;
      const amount = refund.approvedAmount ?? refund.requestedAmount;
      await this.emailService.sendRefundApproved(user.email, refund.orderId.toString(), amount);
    } catch {
      // email is best-effort; silently skip
    }
  }

  private serializeOrderForReview(order: OrderDocument) {
    return {
      _id: order._id.toString(),
      status: order.status,
      bookingType: order.bookingType,
      total: order.total,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      discount: order.discount,
      createdAt: order.createdAt,
      statusHistory: order.statusHistory?.slice(-8),
    };
  }

  serializeRefund(r: RefundRequestDocument) {
    return {
      _id: r._id.toString(),
      orderId: r.orderId.toString(),
      customerId: r.customerId.toString(),
      paymentId: r.paymentId?.toString(),
      reason: r.reason,
      status: r.status,
      stage: r.stage,
      requestedAmount: r.requestedAmount,
      approvedAmount: r.approvedAmount,
      adminNote: r.adminNote,
      rejectionReason: r.rejectionReason,
      orderVerifiedAt: r.orderVerifiedAt,
      processedAt: r.processedAt,
      customerNotifiedAt: r.customerNotifiedAt,
      timeline: r.timeline,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
