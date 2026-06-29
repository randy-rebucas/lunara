import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { resolveMonorepoEnvPaths } from './common/config/load-env';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule } from './common/redis/redis.module';
import { CloudinaryModule } from './common/cloudinary/cloudinary.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { BookingModule } from './modules/booking/booking.module';
import { PartnerModule } from './modules/partner/partner.module';
import { PartnersModule } from './modules/partners/partners.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { HealthModule } from './modules/health/health.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { RidersModule } from './modules/riders/riders.module';
import { UsersModule } from './modules/users/users.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { AdminModule } from './modules/admin/admin.module';
import { SupportModule } from './modules/support/support.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { BranchesModule } from './modules/branches/branches.module';
import { DealsModule } from './modules/deals/deals.module';
import { PushModule } from './modules/push/push.module';
import { SosModule } from './modules/sos/sos.module';
import { MediaModule } from './modules/media/media.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { SettingsModule } from './modules/settings/settings.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { EmailModule } from './common/email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveMonorepoEnvPaths(),
      ignoreEnvFile: resolveMonorepoEnvPaths().length === 0,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    EmailModule,
    CloudinaryModule,
    RedisModule,
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lunara'),
    PushModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    AddressesModule,
    BookingModule,
    PartnerModule,
    PartnersModule,
    OrdersModule,
    RidersModule,
    WalletsModule,
    PaymentsModule,
    ReviewsModule,
    AdminModule,
    SupportModule,
    RefundsModule,
    BranchesModule,
    DealsModule,
    SosModule,
    RealtimeModule,
    MediaModule,
    LedgerModule,
    SettingsModule,
    MessagingModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
