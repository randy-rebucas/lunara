import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PushPlatform, UserRole } from '@lunara/types';
import { User, UserDocument } from '../users/schemas/user.schema';
import { FirebaseService } from './firebase.service';
import { isInvalidFcmTokenError, stringifyPushData } from './push-utils';
import { PushToken, PushTokenDocument } from './schemas/push-token.schema';
import {
  BroadcastNotification,
  BroadcastNotificationDocument,
} from './schemas/broadcast-notification.schema';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Android notification channel id */
  channelId?: string;
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    @InjectModel(PushToken.name) private pushTokenModel: Model<PushTokenDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(BroadcastNotification.name)
    private broadcastModel: Model<BroadcastNotificationDocument>,
    private firebase: FirebaseService,
  ) {}

  /** Records a sent broadcast to history, shown on the admin Notifications page. */
  async recordBroadcast(params: {
    title: string;
    body: string;
    audience: string;
    sentCount: number;
    createdBy: string;
  }) {
    const admin = await this.userModel.findById(params.createdBy).select('email').lean();
    await this.broadcastModel.create({
      title: params.title,
      body: params.body,
      audience: params.audience,
      sentCount: params.sentCount,
      createdBy: new Types.ObjectId(params.createdBy),
      createdByName: admin?.email,
    });
  }

  async listBroadcasts(limit = 50) {
    return this.broadcastModel.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  }

  async registerToken(
    userId: string,
    token: string,
    platform: PushPlatform,
    deviceId?: string,
  ) {
    await this.pushTokenModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), token },
      {
        userId: new Types.ObjectId(userId),
        token,
        platform,
        deviceId,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return { success: true };
  }

  async unregisterToken(userId: string, token: string) {
    await this.pushTokenModel.deleteOne({
      userId: new Types.ObjectId(userId),
      token,
    });
    return { success: true };
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<number> {
    const tokens = await this.pushTokenModel.find({
      userId: new Types.ObjectId(userId),
    });
    return this.sendToTokens(tokens, payload);
  }

  async sendToUsers(userIds: string[], payload: PushPayload): Promise<number> {
    if (userIds.length === 0) return 0;
    const objectIds = userIds.map((id) => new Types.ObjectId(id));
    const tokens = await this.pushTokenModel.find({ userId: { $in: objectIds } });
    return this.sendToTokens(tokens, payload);
  }

  async broadcastToAll(payload: PushPayload): Promise<number> {
    const tokens = await this.pushTokenModel.find({});
    return this.sendToTokens(tokens, payload);
  }

  /** Broadcast to every registered device belonging to users of one role (customer/rider/partner/staff). */
  async broadcastToRole(role: UserRole, payload: PushPayload): Promise<number> {
    const users = await this.userModel.find({ role }).select('_id').lean();
    if (users.length === 0) return 0;
    return this.sendToUsers(
      users.map((u) => u._id.toString()),
      payload,
    );
  }

  /** Registered-device counts grouped by the owning user's role, for the broadcast composer's audience picker. */
  async getAudienceDeviceCounts(): Promise<Record<string, number>> {
    const rows = await this.pushTokenModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$userId' } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      { $group: { _id: '$user.role', count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, r.count]));
  }

  private async sendToTokens(
    tokenDocs: PushTokenDocument[],
    payload: PushPayload,
  ): Promise<number> {
    if (tokenDocs.length === 0) return 0;

    const messaging = this.firebase.messaging();
    if (!messaging) {
      this.logger.debug(`Push skipped (Firebase disabled): ${payload.title}`);
      return 0;
    }

    const data = stringifyPushData(payload.data);
    let sent = 0;

    for (const doc of tokenDocs) {
      try {
        await messaging.send({
          token: doc.token,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data,
          android: {
            priority: 'high',
            notification: {
              channelId: payload.channelId ?? 'default',
              priority: 'high' as const,
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
              },
            },
          },
        });
        sent += 1;
      } catch (err: unknown) {
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code?: string }).code)
            : '';
        if (isInvalidFcmTokenError(code)) {
          await this.pushTokenModel.deleteOne({ _id: doc._id });
          this.logger.debug(`Pruned invalid push token for user ${doc.userId}`);
        } else {
          this.logger.warn(`FCM send failed: ${code || err}`);
        }
      }
    }

    return sent;
  }
}
