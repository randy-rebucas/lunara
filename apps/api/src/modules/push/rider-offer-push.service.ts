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
    // Excludes suspended/terminated partner-owned riders from the broadcast — mirrors the same
    // eligibility rule enforced at assignment time (RiderAssignmentService) and on the open-offer
    // accept path (PickupService.acceptPickup) so a suspended rider isn't even pinged for an offer
    // they're no longer allowed to claim.
    const riders = await this.riderModel
      .find({
        isOnline: true,
        $or: [{ employmentStatus: 'active' }, { employmentStatus: { $exists: false } }],
      })
      .select('userId')
      .lean();
    const userIds = riders.map((r) => r.userId.toString());
    return this.pushNotificationService.sendToUsers(userIds, {
      ...payload,
      channelId: payload.channelId ?? 'offers',
    });
  }
}
