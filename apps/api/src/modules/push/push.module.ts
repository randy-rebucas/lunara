import { Global, Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Notification, NotificationSchema } from '../reviews/schemas/notification.schema';
import { Rider, RiderSchema } from '../riders/schemas/rider.schema';
import { RealtimeModule } from '../realtime/realtime.module';
import { CustomerOrderNotificationService } from './customer-order-notification.service';
import { PartnerOrderNotificationService } from './partner-order-notification.service';
import { FirebaseService } from './firebase.service';
import { NotificationDispatchService } from './notification-dispatch.service';
import { PushController } from './push.controller';
import { PushNotificationService } from './push-notification.service';
import { RiderOfferPushService } from './rider-offer-push.service';
import { PushToken, PushTokenSchema } from './schemas/push-token.schema';
import {
  BroadcastNotification,
  BroadcastNotificationSchema,
} from './schemas/broadcast-notification.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PushToken.name, schema: PushTokenSchema },
      { name: BroadcastNotification.name, schema: BroadcastNotificationSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Rider.name, schema: RiderSchema },
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [PushController],
  providers: [
    FirebaseService,
    PushNotificationService,
    NotificationDispatchService,
    RiderOfferPushService,
    CustomerOrderNotificationService,
    PartnerOrderNotificationService,
  ],
  exports: [
    PushNotificationService,
    NotificationDispatchService,
    RiderOfferPushService,
    CustomerOrderNotificationService,
    PartnerOrderNotificationService,
  ],
})
export class PushModule {}
