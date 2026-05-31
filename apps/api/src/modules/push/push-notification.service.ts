import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PushPlatform } from '@lunara/types';
import { FirebaseService } from './firebase.service';
import { isInvalidFcmTokenError, stringifyPushData } from './push-utils';
import { PushToken, PushTokenDocument } from './schemas/push-token.schema';

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
    private firebase: FirebaseService,
  ) {}

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
