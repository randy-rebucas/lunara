import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationChannel, OrderStatus, PaymentStatus } from '@lunara/types';
import { REFUND_FLOW } from '@lunara/utils';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { Notification, NotificationDocument } from '../reviews/schemas/notification.schema';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { WalletsService } from '../wallets/wallets.service';
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
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    private walletsService: WalletsService,
    private trackingGateway: TrackingGateway,
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
    const customers = await this.orderModel
      .find({ _id: { $in: items.map((r) => r.orderId) } })
      .select('customerId bookingType total status');

    const orderMap = new Map(customers.map((o) => [o._id.toString(), o]));

    return {
      success: true,
      data: {
        items: items.map((r) => ({
          ...this.serializeRefund(r),
          orderStatus: orderMap.get(r.orderId.toString())?.status,
          bookingType: orderMap.get(r.orderId.toString())?.bookingType,
        })),
        counts: {
          pending: await this.refundModel.countDocuments({ status: RefundStatus.PENDING }),
          underReview: await this.refundModel.countDocuments({
            status: RefundStatus.UNDER_REVIEW,
          }),
          approved: await this.refundModel.countDocuments({ status: RefundStatus.APPROVED }),
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
                order.status !== OrderStatus.REFUNDED,
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

      case RefundReviewAction.APPROVE:
        if (!refund.orderVerifiedAt) {
          throw new BadRequestException('Verify the order before approving');
        }
        refund.status = RefundStatus.APPROVED;
        refund.stage = RefundStage.DECISION;
        refund.approvedAmount = dto.approvedAmount ?? refund.requestedAmount;
        if (dto.adminNote) refund.adminNote = dto.adminNote;
        pushTimeline(
          'decision',
          `Approved — ₱${refund.approvedAmount}`,
          dto.adminNote,
        );
        break;

      case RefundReviewAction.REJECT:
        refund.status = RefundStatus.REJECTED;
        refund.stage = RefundStage.DECISION;
        refund.rejectionReason = dto.rejectionReason ?? dto.adminNote ?? 'Refund denied';
        pushTimeline('decision', 'Refund rejected', refund.rejectionReason);
        break;

      case RefundReviewAction.PROCESS:
        if (refund.status !== RefundStatus.APPROVED) {
          throw new BadRequestException('Approve the refund before processing');
        }
        await this.executeRefund(refund);
        refund.status = RefundStatus.PROCESSED;
        refund.stage = RefundStage.PROCESSED;
        refund.processedAt = new Date();
        pushTimeline(
          'processed',
          `₱${refund.approvedAmount} refunded to wallet`,
          dto.adminNote,
        );
        break;

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
      : null;

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

    if (order.status !== OrderStatus.REFUNDED) {
      order.status = OrderStatus.REFUNDED;
      order.statusHistory.push({
        status: OrderStatus.REFUNDED,
        timestamp: new Date(),
        note: `Refund processed — ₱${amount}`,
      });
      await order.save();
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

    const notification = await this.notificationModel.create({
      userId: refund.customerId,
      title,
      body,
      channel: NotificationChannel.IN_APP,
      read: false,
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
