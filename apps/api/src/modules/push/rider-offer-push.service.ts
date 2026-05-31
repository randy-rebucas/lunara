import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';
import { PushNotificationService, type PushPayload } from './push-notification.service';

@Injectable()
export class RiderOfferPushService {
  constructor(
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    private pushNotificationService: PushNotificationService,
  ) {}

  async notifyOnlineRiders(payload: PushPayload): Promise<number> {
    const riders = await this.riderModel.find({ isOnline: true }).select('userId').lean();
    const userIds = riders.map((r) => r.userId.toString());
    return this.pushNotificationService.sendToUsers(userIds, {
      ...payload,
      channelId: payload.channelId ?? 'offers',
    });
  }
}
