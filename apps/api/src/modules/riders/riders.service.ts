import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import {
  PARTNER_SHOP_LOCATION,
  RIDER_DELIVERY_PAYOUT,
  RIDER_PICKUP_PAYOUT,
  type RiderEarningType,
} from '@lunara/utils';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Notification, NotificationDocument } from '../reviews/schemas/notification.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Rider, RiderDocument } from './schemas/rider.schema';

@Injectable()
export class RidersService {
  constructor(
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
  ) {}

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

  private todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  private ensureTodayBucket(rider: RiderDocument) {
    const key = this.todayKey();
    if (rider.earningsDayKey !== key) {
      rider.earningsDayKey = key;
      rider.todayEarnings = 0;
    }
  }

  async findOrCreate(userId: string) {
    let rider = await this.riderModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!rider) {
      rider = await this.riderModel.create({ userId: new Types.ObjectId(userId) });
    }
    this.ensureTodayBucket(rider);
    return rider;
  }

  async getMe(userId: string) {
    const rider = await this.findOrCreate(userId);
    const user = await this.userModel.findById(userId).select('email phone');
    const displayName = user?.email?.split('@')[0] ?? 'Rider';
    return {
      success: true,
      data: {
        userId,
        riderId: rider._id.toString(),
        isOnline: rider.isOnline,
        totalEarnings: rider.totalEarnings,
        todayEarnings: rider.todayEarnings,
        shopLocation: PARTNER_SHOP_LOCATION,
        user: user
          ? {
              firstName: displayName,
              lastName: '',
              email: user.email,
              phone: user.phone,
            }
          : null,
      },
    };
  }

  async creditEarning(userId: string, orderId: string, type: RiderEarningType) {
    const rider = await this.findOrCreate(userId);
    const amount = type === 'pickup' ? RIDER_PICKUP_PAYOUT : RIDER_DELIVERY_PAYOUT;

    rider.totalEarnings += amount;
    rider.todayEarnings += amount;
    rider.recentEarnings = [
      {
        type,
        amount,
        orderId: new Types.ObjectId(orderId),
        earnedAt: new Date(),
      },
      ...rider.recentEarnings,
    ].slice(0, 30);
    await rider.save();

    return {
      amount,
      totalEarnings: rider.totalEarnings,
      todayEarnings: rider.todayEarnings,
    };
  }

  async getTasks(userId: string) {
    const riderId = new Types.ObjectId(userId);
    const tasks = await this.orderModel.find({
      $or: [{ pickupRiderId: riderId }, { deliveryRiderId: riderId }],
      status: {
        $in: [
          OrderStatus.RIDER_ASSIGNED_PICKUP,
          OrderStatus.RIDER_ASSIGNED,
          OrderStatus.PICKED_UP,
          OrderStatus.IN_TRANSIT_TO_SHOP,
          OrderStatus.READY_FOR_DELIVERY,
          OrderStatus.RIDER_ASSIGNED_DELIVERY,
          OrderStatus.OUT_FOR_DELIVERY,
        ],
      },
    });
    return { success: true, data: tasks };
  }

  async getEarnings(userId: string) {
    const rider = await this.findOrCreate(userId);
    const riderId = new Types.ObjectId(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayPickups, todayDeliveries] = await Promise.all([
      this.orderModel.countDocuments({
        pickupRiderId: riderId,
        'pickup.receiptCode': { $exists: true },
        updatedAt: { $gte: today },
      }),
      this.orderModel.countDocuments({
        deliveryRiderId: riderId,
        status: { $in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
        updatedAt: { $gte: today },
      }),
    ]);

    return {
      success: true,
      data: {
        totalEarnings: rider.totalEarnings,
        todayEarnings: rider.todayEarnings,
        todayPickups,
        todayDeliveries,
        recentEarnings: rider.recentEarnings.map((e) => ({
          type: e.type,
          amount: e.amount,
          orderId: e.orderId.toString(),
          earnedAt: e.earnedAt,
        })),
      },
    };
  }

  async updateLocation(userId: string, lat: number, lng: number) {
    const rider = await this.findOrCreate(userId);
    rider.currentLocation = { type: 'Point', coordinates: [lng, lat] };
    await rider.save();
    return { success: true, data: { lat, lng } };
  }

  async setOnline(userId: string, isOnline: boolean) {
    const rider = await this.findOrCreate(userId);
    rider.isOnline = isOnline;
    await rider.save();
    return { success: true, data: { isOnline } };
  }

  async findNearestOnline() {
    const rider = await this.riderModel.findOne({ isOnline: true });
    if (!rider) throw new NotFoundException('No online riders available');
    return rider;
  }
}
