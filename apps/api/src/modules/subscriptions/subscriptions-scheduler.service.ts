import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingService } from '../booking/booking.service';
import type { CreateBookingOrderDto } from '../booking/dto/booking.dto';
import { OrdersService } from '../orders/orders.service';
import { OrderDocument } from '../orders/schemas/order.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { NotificationDispatchService } from '../push/notification-dispatch.service';
import { Subscription, SubscriptionDocument } from './schemas/subscription.schema';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Auto-deactivate rather than retry forever once a subscription has failed this many
 * consecutive cycles in a row (e.g. its saved address was deleted, or its payment method
 * is no longer valid) — a permanently broken state won't self-heal by retrying daily. */
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Periodic sweep that auto-books the next pickup for each active subscription once its
 * `nextRunAt` arrives — reuses the exact same validation/pricing path as a manual booking
 * (BookingService.prepareOrderPayload → OrdersService.createFromBooking), so a subscription
 * order is indistinguishable from one the customer placed by hand.
 */
@Injectable()
export class SubscriptionsSchedulerService {
  private readonly logger = new Logger(SubscriptionsSchedulerService.name);

  constructor(
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    private readonly bookingService: BookingService,
    private readonly ordersService: OrdersService,
    private readonly notificationDispatch: NotificationDispatchService,
  ) {}

  private async wantsPush(userId: string): Promise<boolean> {
    const customer = await this.customerModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .select('notificationPreferences')
      .lean();
    return customer?.notificationPreferences?.push ?? true;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async sweepDueSubscriptions() {
    const due = await this.subscriptionModel
      .find({ active: true, nextRunAt: { $lte: new Date() } })
      .limit(100);

    for (const subscription of due) {
      // Atomic claim: guards against a customer pausing/cancelling this subscription between
      // the find() above and this iteration — if `active` or `nextRunAt` no longer match what
      // we fetched, someone else (pause/cancel/a concurrent tick) already acted on it, so skip
      // rather than booking an order the customer just tried to stop.
      const claimed = await this.subscriptionModel.findOneAndUpdate(
        { _id: subscription._id, active: true, nextRunAt: subscription.nextRunAt },
        { $set: { lastRunAt: new Date() } },
        { new: true },
      );
      if (!claimed) continue;

      const dto: CreateBookingOrderDto = {
        services: [
          {
            bookingType: subscription.bookingType,
            bagSizeId: subscription.bagSizeId,
            enteredWeightKg: subscription.enteredWeightKg,
            enteredLoadCount: subscription.enteredLoadCount,
            enteredPieceCount: subscription.enteredPieceCount,
          },
        ],
        branchId: subscription.branchId,
        addonIds: subscription.addonIds,
        couponCode: subscription.couponCode,
        pickupAddressId: subscription.pickupAddressId,
        deliveryAddressId: subscription.deliveryAddressId,
        scheduledPickupAt: subscription.nextRunAt.toISOString(),
      };

      try {
        const payload = await this.bookingService.prepareOrderPayload(
          subscription.userId.toString(),
          dto,
        );
        // Deterministic per-cycle key: if the sweep retries this subscription (crash between
        // order creation and the save() below, or an overlapping tick) before nextRunAt has
        // advanced, createFromBooking dedupes against the order already created for this cycle
        // instead of double-booking and double-charging the customer.
        const idempotencyKey = `subscription:${subscription._id.toString()}:${subscription.nextRunAt.toISOString()}`;
        const result = await this.ordersService.createFromBooking(
          subscription.userId.toString(),
          { ...payload, subscriptionId: subscription._id.toString(), idempotencyKey },
        );
        const order = result.data as OrderDocument;

        claimed.lastRunAt = new Date();
        claimed.lastOrderId = order._id;
        claimed.lastError = undefined;
        claimed.consecutiveFailures = 0;
        claimed.nextRunAt = new Date(
          claimed.nextRunAt.getTime() + claimed.frequencyDays * DAY_MS,
        );
        await claimed.save();

        const userId = claimed.userId.toString();
        void this.wantsPush(userId)
          .then((sendPush) =>
            this.notificationDispatch.dispatch({
              userId,
              title: 'Recurring pickup booked',
              body: 'Your recurring pickup order was created — open it to complete payment and confirm.',
              channelId: 'orders',
              sendPush,
              data: { type: 'subscription_booked', subscriptionId: claimed._id.toString(), orderId: order._id.toString() },
            }),
          )
          .catch(() => {});
      } catch (e) {
        // Slot/branch temporarily unavailable — back off a day and retry rather than spinning
        // every hour or silently dropping the subscription.
        this.logger.warn(
          `Subscription ${claimed._id.toString()} auto-booking failed: ${
            e instanceof Error ? e.message : e
          }`,
        );
        const message = e instanceof Error ? e.message : 'Auto-booking failed';
        claimed.lastError = message;
        claimed.consecutiveFailures = (claimed.consecutiveFailures ?? 0) + 1;
        const shouldDeactivate = claimed.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
        claimed.active = !shouldDeactivate;
        claimed.nextRunAt = new Date(claimed.nextRunAt.getTime() + DAY_MS);
        await claimed.save();

        const userId = claimed.userId.toString();
        void this.wantsPush(userId)
          .then((sendPush) =>
            this.notificationDispatch.dispatch({
              userId,
              title: shouldDeactivate ? 'Recurring pickup paused' : 'Recurring pickup booking failed',
              body: shouldDeactivate
                ? `We couldn't auto-book your recurring pickup after several attempts (${message}), so it's been paused. Update it and resume anytime.`
                : `We couldn't auto-book your recurring pickup this cycle (${message}). We'll try again tomorrow.`,
              channelId: 'orders',
              sendPush,
              data: { type: 'subscription_failed', subscriptionId: claimed._id.toString() },
            }),
          )
          .catch(() => {});
      }
    }
  }
}
