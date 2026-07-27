import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BookingService } from '../booking/booking.service';
import type { CreateBookingOrderDto } from '../booking/dto/booking.dto';
import { OrdersService } from '../orders/orders.service';
import { OrderDocument } from '../orders/schemas/order.schema';
import { Subscription, SubscriptionDocument } from './schemas/subscription.schema';

const DAY_MS = 24 * 60 * 60 * 1000;

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
    private readonly bookingService: BookingService,
    private readonly ordersService: OrdersService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweepDueSubscriptions() {
    const due = await this.subscriptionModel
      .find({ active: true, nextRunAt: { $lte: new Date() } })
      .limit(100);

    for (const subscription of due) {
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
        const result = await this.ordersService.createFromBooking(
          subscription.userId.toString(),
          { ...payload, subscriptionId: subscription._id.toString() },
        );
        const order = result.data as OrderDocument;

        subscription.lastRunAt = new Date();
        subscription.lastOrderId = order._id;
        subscription.lastError = undefined;
        subscription.nextRunAt = new Date(
          subscription.nextRunAt.getTime() + subscription.frequencyDays * DAY_MS,
        );
        await subscription.save();
      } catch (e) {
        // Slot/branch temporarily unavailable — back off a day and retry rather than spinning
        // every hour or silently dropping the subscription.
        this.logger.warn(
          `Subscription ${subscription._id.toString()} auto-booking failed: ${
            e instanceof Error ? e.message : e
          }`,
        );
        subscription.lastError = e instanceof Error ? e.message : 'Auto-booking failed';
        subscription.nextRunAt = new Date(subscription.nextRunAt.getTime() + DAY_MS);
        await subscription.save();
      }
    }
  }
}
