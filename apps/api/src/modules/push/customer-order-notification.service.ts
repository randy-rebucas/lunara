import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { orderEventTitle, resolveOrderEventMessage } from '@lunara/utils';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { NotificationDispatchService } from './notification-dispatch.service';

const DEDUPE_MS = 45_000;

@Injectable()
export class CustomerOrderNotificationService {
  private readonly logger = new Logger(CustomerOrderNotificationService.name);
  private readonly recent = new Map<string, number>();
  private readonly customerIdByOrderId = new Map<string, string>();

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly notificationDispatch: NotificationDispatchService,
  ) {}

  async notifyOrderEvent(
    orderId: string,
    event: string,
    payload: Record<string, unknown> = {},
  ) {
    const body = resolveOrderEventMessage(event, {
      message: typeof payload.message === 'string' ? payload.message : undefined,
    });
    if (!body) return;

    if (event === 'reviewRequested' || event === 'reviewPublished') {
      return;
    }

    const dedupeKey = `${orderId}:event:${event}`;
    if (this.isDuplicate(dedupeKey)) return;

    const customerId = await this.resolveCustomerId(orderId);
    if (!customerId) return;

    try {
      await this.notificationDispatch.dispatch({
        userId: customerId,
        title: orderEventTitle(event),
        body,
        channelId: 'orders',
        data: {
          type: 'order_update',
          orderId,
          event,
          status: typeof payload.status === 'string' ? payload.status : undefined,
        },
      });
    } catch (err) {
      this.logger.warn(`Customer notification failed for ${orderId}/${event}: ${err}`);
    }
  }

  async notifyOrderStatus(orderId: string, status: string) {
    const dedupeKey = `${orderId}:status:${status}`;
    if (this.isDuplicate(dedupeKey)) return;

    const customerId = await this.resolveCustomerId(orderId);
    if (!customerId) return;

    const label = status.replace(/_/g, ' ');
    try {
      await this.notificationDispatch.dispatch({
        userId: customerId,
        title: 'Order status updated',
        body: `Your order is now ${label}.`,
        channelId: 'orders',
        data: { type: 'order_update', orderId, status },
      });
    } catch (err) {
      this.logger.warn(`Customer status notification failed for ${orderId}: ${err}`);
    }
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

  private async resolveCustomerId(orderId: string): Promise<string | undefined> {
    const cached = this.customerIdByOrderId.get(orderId);
    if (cached) return cached;

    const order = await this.orderModel.findById(orderId).select('customerId').lean();
    const customerId = order?.customerId?.toString();
    if (customerId) {
      this.customerIdByOrderId.set(orderId, customerId);
    }
    return customerId;
  }
}
