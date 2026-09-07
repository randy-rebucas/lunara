import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { NotificationDispatchService } from '../push/notification-dispatch.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { CreateReviewDto } from './dto/create-review.dto';
import { Notification, NotificationDocument, notificationExpiryFor } from './schemas/notification.schema';
import { Review, ReviewDocument } from './schemas/review.schema';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private trackingGateway: TrackingGateway,
    private notificationDispatch: NotificationDispatchService,
  ) {}

  async notifyOrderCompleted(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order || order.status !== OrderStatus.COMPLETED) return;

    const existing = await this.notificationModel.findOne({
      userId: order.customerId,
      'data.orderId': orderId,
      'data.type': 'review_request',
    });
    if (existing) return;

    const notification = await this.notificationDispatch.dispatch({
      userId: order.customerId.toString(),
      title: 'How was your laundry?',
      body: 'Your order is complete. Rate your experience to help us improve.',
      channelId: 'orders',
      data: { type: 'review_request', orderId },
    });

    this.trackingGateway.emitOrderEvent(orderId, 'reviewRequested', {
      message: 'Order complete — we would love your feedback!',
      notificationId: notification._id.toString(),
      reviewUrl: `/orders/${orderId}/review`,
    });

    return notification;
  }

  async getOrderReviewStatus(orderId: string, customerId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId.toString() !== customerId) {
      throw new BadRequestException('Not your order');
    }

    const review = await this.reviewModel.findOne({
      orderId: order._id,
      customerId: new Types.ObjectId(customerId),
    });

    const canReview = order.status === OrderStatus.COMPLETED && !review;

    return {
      success: true,
      data: {
        orderId: order._id.toString(),
        orderStatus: order.status,
        canReview,
        review: review ? this.serializeReview(review) : null,
      },
    };
  }

  async createReview(customerId: string, dto: CreateReviewDto) {
    const order = await this.orderModel.findById(dto.orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId.toString() !== customerId) {
      throw new BadRequestException('Not your order');
    }
    if (order.status !== OrderStatus.COMPLETED) {
      throw new BadRequestException('You can only review completed orders');
    }

    const existing = await this.reviewModel.findOne({
      orderId: order._id,
      customerId: new Types.ObjectId(customerId),
    });
    if (existing) throw new BadRequestException('You already reviewed this order');

    const review = await this.reviewModel.create({
      orderId: order._id,
      customerId: new Types.ObjectId(customerId),
      partnerId: order.partnerId,
      rating: dto.rating,
      comment: dto.comment?.trim() || undefined,
      publishedAt: new Date(),
    });

    await this.notificationModel.updateMany(
      {
        userId: new Types.ObjectId(customerId),
        'data.orderId': dto.orderId,
        'data.type': 'review_request',
      },
      { read: true },
    );

    this.trackingGateway.emitOrderEvent(dto.orderId, 'reviewPublished', {
      message: 'Thank you for your review!',
      rating: review.rating,
    });

    return {
      success: true,
      data: {
        review: this.serializeReview(review),
        message: 'Review published',
      },
    };
  }

  async listNotifications(userId: string, limit = 20) {
    const items = await this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit);

    return {
      success: true,
      data: items.map((n) => ({
        _id: n._id.toString(),
        title: n.title,
        body: n.body,
        read: n.read,
        data: n.data,
        createdAt: n.createdAt,
      })),
    };
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const notification = await this.notificationModel.findById(notificationId);
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId.toString() !== userId) {
      throw new BadRequestException('Not your notification');
    }
    notification.read = true;
    await notification.save();
    return { success: true, data: notification };
  }

  async markAllNotificationsRead(userId: string) {
    // `updateMany` bypasses document middleware, so the read-retention TTL shortening from
    // NotificationSchema's pre('save') hook needs setting explicitly here too.
    await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), read: false },
      { read: true, expiresAt: notificationExpiryFor(true) },
    );
    return { success: true, data: { ok: true } };
  }

  /** Real, published reviews for the public marketing site — no auth, so only rating/comment/first
   * name + last initial are exposed (never email/phone/full name). */
  async listFeatured(limit = 12, partnerId?: string) {
    const match: Record<string, unknown> = {
      rating: { $gte: 4 },
      comment: { $exists: true, $nin: [null, ''] },
    };
    if (partnerId && Types.ObjectId.isValid(partnerId)) {
      match.partnerId = new Types.ObjectId(partnerId);
    }
    const rows = await this.reviewModel.aggregate<{
      _id: Types.ObjectId;
      rating: number;
      comment: string;
      customer?: { firstName: string; lastName: string };
    }>([
      { $match: match },
      { $sort: { publishedAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'customers',
          localField: 'customerId',
          foreignField: 'userId',
          as: 'customer',
        },
      },
      { $unwind: '$customer' },
    ]);

    return {
      success: true,
      data: rows.map((r) => ({
        id: r._id.toString(),
        name: `${r.customer!.firstName} ${r.customer!.lastName?.charAt(0) ?? ''}.`.trim(),
        initials: `${r.customer!.firstName.charAt(0)}${r.customer!.lastName?.charAt(0) ?? ''}`.toUpperCase(),
        rating: r.rating,
        quote: r.comment,
      })),
    };
  }

  private serializeReview(review: ReviewDocument) {
    return {
      _id: review._id.toString(),
      orderId: review.orderId.toString(),
      rating: review.rating,
      comment: review.comment,
      publishedAt: review.publishedAt,
      createdAt: review.createdAt,
    };
  }
}
