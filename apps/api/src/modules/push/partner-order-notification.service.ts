import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '@lunara/types';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { NotificationDispatchService } from './notification-dispatch.service';
import {
  inferPartnerNotificationCategory,
  partnerNotificationTypeFromEvent,
  partnerOrderEventTitle,
  partnerOrderStatusTitle,
  PARTNER_NOTIFICATION_TYPES,
  PARTNER_RELEVANT_ORDER_EVENTS,
  PARTNER_RELEVANT_ORDER_STATUSES,
} from './partner-notification.constants';

const DEDUPE_MS = 45_000;

@Injectable()
export class PartnerOrderNotificationService {
  private readonly logger = new Logger(PartnerOrderNotificationService.name);
  private readonly recent = new Map<string, number>();
  private readonly orderCache = new Map<
    string,
    { partnerId?: string; branchId?: string; branchName?: string; bookingType?: string }
  >();

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly notificationDispatch: NotificationDispatchService,
    @Inject(forwardRef(() => TrackingGateway))
    private readonly trackingGateway: TrackingGateway,
  ) {}

  async notifyOrderEvent(
    orderId: string,
    event: string,
    payload: Record<string, unknown> = {},
  ) {
    if (!PARTNER_RELEVANT_ORDER_EVENTS.has(event)) return;
    if (event === 'partnerAccepted') return;

    const dedupeKey = `${orderId}:event:${event}`;
    if (this.isDuplicate(dedupeKey)) return;

    const order = await this.resolveOrder(orderId);
    if (!order?.partnerId && !order?.branchId) return;

    const title = partnerOrderEventTitle(event);
    const body =
      (typeof payload.message === 'string' && payload.message) ||
      this.defaultBodyForEvent(event, order);
    const type = partnerNotificationTypeFromEvent(event);

    await this.dispatchToPortalRecipients(order, {
      title,
      body,
      type,
      orderId,
      event,
      status: typeof payload.status === 'string' ? payload.status : undefined,
      branchName: order.branchName,
    });
  }

  async notifyOrderStatus(orderId: string, status: string) {
    if (!PARTNER_RELEVANT_ORDER_STATUSES.has(status)) return;

    const dedupeKey = `${orderId}:status:${status}`;
    if (this.isDuplicate(dedupeKey)) return;

    const order = await this.resolveOrder(orderId);
    if (!order?.partnerId && !order?.branchId) return;

    const title = partnerOrderStatusTitle(status);
    const body = `Order ${orderId.slice(-6).toUpperCase()} is now ${status.replace(/_/g, ' ')}.`;
    const type =
      status === 'ready_for_delivery'
        ? PARTNER_NOTIFICATION_TYPES.READY_FOR_DELIVERY
        : PARTNER_NOTIFICATION_TYPES.ORDER_STATUS;

    await this.dispatchToPortalRecipients(order, {
      title,
      body,
      type,
      orderId,
      status,
      branchName: order.branchName,
    });
  }

  async notifyPickupRequested(orderId: string, _partnerUserId: string) {
    const order = await this.resolveOrder(orderId);
    if (!order) return;

    await this.dispatchToPortalRecipients(order, {
      title: 'Pickup requested',
      body: 'Pickup rider search started. Admin dispatch will assign a rider.',
      type: PARTNER_NOTIFICATION_TYPES.PICKUP_REQUESTED,
      orderId,
      event: 'pickupRequested',
    });
  }

  async notifyDeliveryRequested(orderId: string) {
    const order = await this.resolveOrder(orderId);
    if (!order) return;

    await this.dispatchToPortalRecipients(order, {
      title: 'Delivery requested',
      body: 'A delivery rider will be assigned for this order.',
      type: PARTNER_NOTIFICATION_TYPES.DELIVERY_REQUESTED,
      orderId,
      event: 'deliveryRequested',
    });
  }

  private async dispatchToPortalRecipients(
    order: {
      orderId: string;
      partnerId?: string;
      branchId?: string;
      branchName?: string;
    },
    input: {
      title: string;
      body: string;
      type: string;
      orderId: string;
      event?: string;
      status?: string;
      branchName?: string;
    },
  ) {
    const recipientIds = await this.resolveRecipientUserIds(order.partnerId, order.branchId);
    if (recipientIds.length === 0) return;

    const category = inferPartnerNotificationCategory(input.type);
    const data = {
      category,
      type: input.type,
      orderId: input.orderId,
      event: input.event,
      status: input.status,
      branchName: input.branchName ?? order.branchName,
    };

    for (const userId of recipientIds) {
      try {
        await this.notificationDispatch.dispatch({
          userId,
          title: input.title,
          body: input.body,
          channelId: 'partner_orders',
          data,
        });
        this.trackingGateway.emitPartnerNotification(userId, {
          title: input.title,
          body: input.body,
          ...data,
        });
      } catch (err) {
        this.logger.warn(`Partner notification failed for ${userId}: ${err}`);
      }
    }

    if (order.partnerId) {
      this.trackingGateway.emitPartnerNotificationToRoom(order.partnerId, {
        title: input.title,
        body: input.body,
        ...data,
      });
    }
    if (order.branchId) {
      this.trackingGateway.emitPartnerNotificationToBranch(order.branchId, {
        title: input.title,
        body: input.body,
        ...data,
      });
    }
  }

  private async resolveRecipientUserIds(
    partnerId?: string,
    branchId?: string,
  ): Promise<string[]> {
    const ids = new Set<string>();
    if (partnerId) ids.add(partnerId);

    if (branchId) {
      const staff = await this.userModel
        .find({
          role: UserRole.STAFF,
          isActive: true,
          branchId: new Types.ObjectId(branchId),
        })
        .select('_id');
      for (const s of staff) {
        ids.add(s._id.toString());
      }
    }

    return [...ids];
  }

  private defaultBodyForEvent(
    event: string,
    order: { branchName?: string; bookingType?: string },
  ): string {
    const shop = order.branchName ?? 'your shop';
    switch (event) {
      case 'shopAssigned':
        return `A paid order was assigned to ${shop}. Accept it in Incoming orders.`;
      case 'riderAssignedPickup':
      case 'riderAssigned':
        return `A rider was assigned to pick up laundry for ${shop}.`;
      case 'pickedUp':
        return 'Laundry was collected from the customer.';
      case 'inTransitToShop':
        return `Laundry is on the way to ${shop}. Open shop receiving when it arrives.`;
      case 'laundryReceivedAtShop':
        return 'Rider dropped off laundry — complete shop receiving.';
      case 'receivedAtShop':
        return 'Intake is complete. Start processing in the queue.';
      case 'staffAssigned':
        return 'A staff member was assigned to this order.';
      case 'staffJobAccepted':
        return 'A staff member accepted this order for processing.';
      case 'awaitingDeliveryDispatch':
        return 'Laundry is ready. Request or wait for delivery rider assignment.';
      case 'riderAssignedDelivery':
      case 'deliveryRiderAssigned':
        return 'A delivery rider was assigned to return laundry to the customer.';
      case 'riderPickedUpFromShop':
      case 'outForDelivery':
        return 'Clean laundry is on the way to the customer.';
      case 'delivered':
      case 'completed':
        return 'The customer received their laundry. Order complete.';
      default:
        return `Update for ${shop}.`;
    }
  }

  private async resolveOrder(orderId: string) {
    const cached = this.orderCache.get(orderId);
    if (cached) {
      return { orderId, ...cached };
    }

    const order = await this.orderModel
      .findById(orderId)
      .select('partnerId branchId branchName bookingType')
      .lean();
    if (!order) return undefined;

    const snapshot = {
      partnerId: order.partnerId?.toString(),
      branchId: order.branchId?.toString(),
      branchName: order.branchName as string | undefined,
      bookingType: order.bookingType as string | undefined,
    };
    this.orderCache.set(orderId, snapshot);
    return { orderId, ...snapshot };
  }

  private isDuplicate(key: string) {
    const now = Date.now();
    const prev = this.recent.get(key);
    if (prev && now - prev < DEDUPE_MS) return true;
    this.recent.set(key, now);
    if (this.recent.size > 500) {
      for (const [k, ts] of this.recent) {
        if (now - ts > DEDUPE_MS * 2) this.recent.delete(k);
      }
    }
    return false;
  }
}
