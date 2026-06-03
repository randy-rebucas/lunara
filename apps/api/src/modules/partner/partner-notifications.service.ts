import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from '../reviews/schemas/notification.schema';
import { inferPartnerNotificationCategory } from '../push/partner-notification.constants';

@Injectable()
export class PartnerNotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async listNotifications(userId: string, limit = 30) {
    const items = await this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100));

    return {
      success: true,
      data: items.map((n) => ({
        _id: n._id.toString(),
        title: n.title,
        body: n.body,
        read: n.read,
        category:
          (n.data?.category as string | undefined) ??
          inferPartnerNotificationCategory(n.data?.type as string | undefined),
        data: n.data,
        createdAt: n.createdAt,
      })),
    };
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const notification = await this.notificationModel.findById(notificationId);
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId.toString() !== userId) {
      throw new NotFoundException('Notification not found');
    }
    notification.read = true;
    await notification.save();
    return {
      success: true,
      data: {
        _id: notification._id.toString(),
        read: notification.read,
      },
    };
  }

  async markAllRead(userId: string) {
    const result = await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), read: false },
      { $set: { read: true } },
    );
    return {
      success: true,
      data: { updated: result.modifiedCount },
    };
  }
}
