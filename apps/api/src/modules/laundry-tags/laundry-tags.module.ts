import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { RealtimeModule } from '../realtime/realtime.module';
import { LaundryTag, LaundryTagSchema } from './schemas/laundry-tag.schema';
import { LaundryTagsController } from './laundry-tags.controller';
import { LaundryTagsService } from './laundry-tags.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LaundryTag.name, schema: LaundryTagSchema },
      { name: User.name, schema: UserSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
    RealtimeModule,
  ],
  controllers: [LaundryTagsController],
  providers: [LaundryTagsService],
  exports: [LaundryTagsService],
})
export class LaundryTagsModule {}
