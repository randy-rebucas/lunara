import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { Rider, RiderSchema } from '../riders/schemas/rider.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import {
  AdminMessagingController,
  MessagingController,
  StaffEmployerMessagingController,
  EmployerMessagingController,
} from './messaging.controller';
import { RiderMessagingController, RiderEmployerMessagingController } from './rider-messaging.controller';
import { CustomerMessagingController } from './customer-messaging.controller';
import { MessagingService } from './messaging.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => RealtimeModule),
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: User.name, schema: UserSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Rider.name, schema: RiderSchema },
    ]),
    SettingsModule,
  ],
  controllers: [
    MessagingController,
    AdminMessagingController,
    RiderMessagingController,
    RiderEmployerMessagingController,
    CustomerMessagingController,
    StaffEmployerMessagingController,
    EmployerMessagingController,
  ],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
