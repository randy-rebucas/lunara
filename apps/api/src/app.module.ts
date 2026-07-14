import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { resolveMonorepoEnvPaths } from './common/config/load-env';
import { getMongoUri, mongoConnectionOptions } from './common/config/database-config';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule } from './common/redis/redis.module';
import { StorageModule } from './common/storage/storage.module';
import { UPLOAD_ROOT } from './common/uploads/upload-paths';
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
import { RiderApplicationsModule } from './modules/rider-applications/rider-applications.module';
import { PartnerApplicationsModule } from './modules/partner-applications/partner-applications.module';
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
import { AutomationModule } from './modules/automation/automation.module';
import { AuditLogModule } from './modules/audit/audit-log.module';
import { LaundryTagsModule } from './modules/laundry-tags/laundry-tags.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveMonorepoEnvPaths(),
      ignoreEnvFile: resolveMonorepoEnvPaths().length === 0,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ServeStaticModule.forRoot({
      rootPath: join(UPLOAD_ROOT, 'public'),
      serveRoot: '/api/v1/uploads/public',
    }),
    EmailModule,
    StorageModule,
    RedisModule,
    MongooseModule.forRoot(getMongoUri(), mongoConnectionOptions),
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
    RiderApplicationsModule,
    PartnerApplicationsModule,
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
    AutomationModule,
    AuditLogModule,
    LaundryTagsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
