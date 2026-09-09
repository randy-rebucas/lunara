import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from './schemas/user.schema';
import { UserProfile, UserProfileSchema } from './schemas/user-profile.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Rider, RiderSchema } from '../riders/schemas/rider.schema';
import { Partner, PartnerSchema } from '../partners/schemas/partner.schema';
import { Address, AddressSchema } from '../addresses/schemas/address.schema';
import { Wallet, WalletSchema } from '../wallets/schemas/wallet.schema';
import { Notification, NotificationSchema } from '../reviews/schemas/notification.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Rider.name, schema: RiderSchema },
      { name: Partner.name, schema: PartnerSchema },
      { name: Address.name, schema: AddressSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
