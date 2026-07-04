import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import { formatCurrency, type RiderEarningType } from '@lunara/utils';
import { NotificationDispatchService } from '../push/notification-dispatch.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Notification, NotificationDocument } from '../reviews/schemas/notification.schema';
import { Rider, RiderDocument } from './schemas/rider.schema';
import {
  inferRiderNotificationCategory,
  RIDER_NOTIFICATION_CATEGORY,
  RIDER_NOTIFICATION_TITLES,
  RIDER_NOTIFICATION_TYPES,
  riderNotificationChannelId,
} from './rider-notification.constants';

const OVERDUE_GRACE_MINUTES = 15;
const REMINDER_DEDUPE_HOURS = 24;

@Injectable()
export class RiderNotificationService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    private notificationDispatch: NotificationDispatchService,
    private trackingGateway: TrackingGateway,
  ) {}

  async notifyPickupAssigned(
    riderUserId: string,
    order: Pick<OrderDocument, '_id' | 'branchName' | 'bookingType' | 'status'>,
  ) {
    const title = RIDER_NOTIFICATION_TITLES.NEW_PICKUP_ASSIGNED;
    const body = `Pickup assigned — ${order.branchName ?? 'laundry shop'} · ${order.bookingType.replace(/_/g, ' ')}`;
    const data = {
      category: RIDER_NOTIFICATION_CATEGORY.ASSIGNMENT,
      type: RIDER_NOTIFICATION_TYPES.PICKUP_ASSIGNMENT,
      orderId: order._id.toString(),
      status: OrderStatus.RIDER_ASSIGNED_PICKUP,
      branchName: order.branchName,
    };

    await this.dispatch(riderUserId, title, body, data, 'pickup_assignment');
    this.trackingGateway.emitRiderAssignment(riderUserId, { ...data, title, body });
  }

  async notifyDeliveryAssigned(
    riderUserId: string,
    order: Pick<OrderDocument, '_id' | 'branchName' | 'bookingType' | 'status'>,
  ) {
    const title = RIDER_NOTIFICATION_TITLES.NEW_DELIVERY_ASSIGNED;
    const body = `Delivery assigned — ${order.branchName ?? 'shop'} → customer · ${order.bookingType.replace(/_/g, ' ')}`;
    const data = {
      category: RIDER_NOTIFICATION_CATEGORY.ASSIGNMENT,
      type: RIDER_NOTIFICATION_TYPES.DELIVERY_ASSIGNMENT,
      orderId: order._id.toString(),
      status: OrderStatus.RIDER_ASSIGNED_DELIVERY,
      branchName: order.branchName,
    };

    await this.dispatch(riderUserId, title, body, data, 'delivery_assignment');
    this.trackingGateway.emitDeliveryAssignment(riderUserId, { ...data, title, body });
  }

  async notifyAssignmentReassigned(
    riderUserId: string,
    order: Pick<OrderDocument, '_id' | 'branchName' | 'bookingType'>,
    leg: 'pickup' | 'delivery',
  ) {
    const title = RIDER_NOTIFICATION_TITLES.ASSIGNMENT_REASSIGNED;
    const body = `Your ${leg} for ${order.branchName ?? 'this order'} · ${order.bookingType.replace(/_/g, ' ')} was reassigned to another rider.`;
    const data = {
      category: RIDER_NOTIFICATION_CATEGORY.SYSTEM,
      type: RIDER_NOTIFICATION_TYPES.ASSIGNMENT_REASSIGNED,
      orderId: order._id.toString(),
      leg,
    };

    await this.dispatch(riderUserId, title, body, data, 'assignmentReassigned');
  }

  async notifyEarningsCredited(
    riderUserId: string,
    referenceId: string,
    earningType: RiderEarningType,
    amount: number,
    note?: string,
  ) {
    const title = RIDER_NOTIFICATION_TITLES.EARNINGS_CREDITED;
    const label = earningType === 'pickup' || earningType === 'delivery'
      ? `${earningType} · order ${referenceId.slice(-6).toUpperCase()}`
      : note?.trim() || earningType;
    const body = `${formatCurrency(amount)} credited — ${label}`;
    const data = {
      category: RIDER_NOTIFICATION_CATEGORY.EARNINGS,
      type: RIDER_NOTIFICATION_TYPES.EARNINGS_CREDITED,
      orderId: earningType === 'pickup' || earningType === 'delivery' ? referenceId : undefined,
      earningType,
      amount,
    };

    await this.dispatch(riderUserId, title, body, data, 'earnings_credited');
  }

  async notifyPickupOverdue(riderUserId: string, order: OrderDocument) {
    const orderId = order._id.toString();
    const dedupeSince = new Date(Date.now() - REMINDER_DEDUPE_HOURS * 60 * 60 * 1000);
    const existing = await this.notificationModel.findOne({
      userId: new Types.ObjectId(riderUserId),
      'data.type': RIDER_NOTIFICATION_TYPES.PICKUP_OVERDUE,
      'data.orderId': orderId,
      createdAt: { $gte: dedupeSince },
    });
    if (existing) return;

    const title = RIDER_NOTIFICATION_TITLES.PICKUP_OVERDUE;
    const body = `Pickup is overdue for order ${orderId.slice(-6).toUpperCase()} — complete collection soon.`;
    const data = {
      category: RIDER_NOTIFICATION_CATEGORY.REMINDER,
      type: RIDER_NOTIFICATION_TYPES.PICKUP_OVERDUE,
      orderId,
      status: order.status,
      branchName: order.branchName,
    };

    await this.dispatch(riderUserId, title, body, data, 'pickup_overdue');
  }

  async notifyPlatformAnnouncement(
    riderUserId: string,
    body: string,
    title: string = RIDER_NOTIFICATION_TITLES.PLATFORM_ANNOUNCEMENT,
  ) {
    const data = {
      category: RIDER_NOTIFICATION_CATEGORY.SYSTEM,
      type: RIDER_NOTIFICATION_TYPES.PLATFORM_ANNOUNCEMENT,
    };

    await this.dispatch(riderUserId, title, body, data, 'platform_announcement');
  }

  async broadcastPlatformAnnouncement(body: string, title?: string, userIds?: string[]) {
    const riders = userIds?.length
      ? await this.riderModel.find({ userId: { $in: userIds.map((id) => new Types.ObjectId(id)) } })
      : await this.riderModel.find().select('userId');

    for (const rider of riders) {
      await this.notifyPlatformAnnouncement(rider.userId.toString(), body, title);
    }

    return riders.length;
  }

  async syncOverduePickupReminders(riderUserId: string) {
    const orders = await this.orderModel.find({
      pickupRiderId: new Types.ObjectId(riderUserId),
      status: { $in: [OrderStatus.RIDER_ASSIGNED_PICKUP, OrderStatus.RIDER_ASSIGNED] },
      'pickup.collectedAt': { $exists: false },
    });

    const now = Date.now();
    for (const order of orders) {
      const dueAt = order.slaPickupDueAt ?? order.scheduledPickupAt;
      if (!dueAt) continue;
      const overdueMs = now - dueAt.getTime();
      if (overdueMs >= OVERDUE_GRACE_MINUTES * 60 * 1000) {
        await this.notifyPickupOverdue(riderUserId, order);
      }
    }
  }

  private async dispatch(
    riderUserId: string,
    title: string,
    body: string,
    data: Record<string, unknown>,
    socketType: string,
  ) {
    const category =
      (data.category as string | undefined) ?? inferRiderNotificationCategory(data.type as string | undefined);
    const payload = { ...data, category };

    await this.notificationDispatch.dispatch({
      userId: riderUserId,
      title,
      body,
      channelId: riderNotificationChannelId(category as typeof RIDER_NOTIFICATION_CATEGORY.ASSIGNMENT),
      data: payload,
    });

    this.trackingGateway.emitRiderNotification(riderUserId, {
      type: socketType,
      title,
      body,
      ...payload,
    });
  }
}
