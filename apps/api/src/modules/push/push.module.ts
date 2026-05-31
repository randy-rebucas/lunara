import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from '../reviews/schemas/notification.schema';
import { Rider, RiderSchema } from '../riders/schemas/rider.schema';
import { FirebaseService } from './firebase.service';
import { NotificationDispatchService } from './notification-dispatch.service';
import { PushController } from './push.controller';
import { PushNotificationService } from './push-notification.service';
import { RiderOfferPushService } from './rider-offer-push.service';
import { PushToken, PushTokenSchema } from './schemas/push-token.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PushToken.name, schema: PushTokenSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Rider.name, schema: RiderSchema },
    ]),
  ],
  controllers: [PushController],
  providers: [
    FirebaseService,
    PushNotificationService,
    NotificationDispatchService,
    RiderOfferPushService,
  ],
  exports: [PushNotificationService, NotificationDispatchService, RiderOfferPushService],
})
export class PushModule {}
