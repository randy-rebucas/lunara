import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingService } from '../booking/booking.service';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from './dto/subscription.dto';
import { Subscription, SubscriptionDocument } from './schemas/subscription.schema';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    private readonly bookingService: BookingService,
  ) {}

  async findAll(userId: string) {
    const items = await this.subscriptionModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 });
    return { success: true, data: items };
  }

  async create(userId: string, dto: CreateSubscriptionDto) {
    // Reuses the exact same pricing/availability validation as a one-off booking, so a
    // subscription can never be saved with a branch/address/addon combo that wouldn't book.
    await this.bookingService.prepareOrderPayload(userId, dto);

    // Subscriptions re-book a single recurring service — the primary (first) selected service.
    const primary = dto.services[0];
    const subscription = await this.subscriptionModel.create({
      userId: new Types.ObjectId(userId),
      bookingType: primary.bookingType,
      branchId: dto.branchId,
      bagSizeId: primary.bagSizeId,
      enteredWeightKg: primary.enteredWeightKg,
      enteredLoadCount: primary.enteredLoadCount,
      enteredPieceCount: primary.enteredPieceCount,
      addonIds: dto.addonIds ?? [],
      couponCode: dto.couponCode,
      pickupAddressId: dto.pickupAddressId,
      deliveryAddressId: dto.deliveryAddressId,
      frequencyDays: dto.frequencyDays,
      nextRunAt: new Date(dto.scheduledPickupAt),
      active: true,
    });

    return { success: true, data: subscription };
  }

  async update(id: string, userId: string, dto: UpdateSubscriptionDto) {
    const subscription = await this.subscriptionModel.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    });
    if (!subscription) throw new NotFoundException('Subscription not found');

    if (dto.active !== undefined) subscription.active = dto.active;
    await subscription.save();
    return { success: true, data: subscription };
  }

  async remove(id: string, userId: string) {
    const result = await this.subscriptionModel.deleteOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    });
    if (!result.deletedCount) throw new NotFoundException('Subscription not found');
    return { success: true, data: { deleted: true } };
  }
}
