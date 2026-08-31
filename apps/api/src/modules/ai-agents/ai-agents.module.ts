import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DiscoveryModule } from '@nestjs/core';
import { AiConversation, AiConversationSchema } from './schemas/ai-conversation.schema';
import { AiMessage, AiMessageSchema } from './schemas/ai-message.schema';
import { AiGuestUsage, AiGuestUsageSchema } from './schemas/ai-guest-usage.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { AiAgentsController } from './ai-agents.controller';
import { AiAgentsService } from './ai-agents.service';
import { AiToolRegistry } from './tools/registry';
import { ApiSurfaceService } from './tools/api-surface.service';
import { OrdersModule } from '../orders/orders.module';
import { RidersModule } from '../riders/riders.module';
import { LedgerModule } from '../ledger/ledger.module';
import { WalletsModule } from '../wallets/wallets.module';
import { RefundsModule } from '../refunds/refunds.module';
import { AdminModule } from '../admin/admin.module';
import { SosModule } from '../sos/sos.module';
import { ServiceAreasModule } from '../service-areas/service-areas.module';
import { PartnerApplicationsModule } from '../partner-applications/partner-applications.module';
import { RiderApplicationsModule } from '../rider-applications/rider-applications.module';
import { PartnersModule } from '../partners/partners.module';
import { IncentiveCampaignsModule } from '../incentive-campaigns/incentive-campaigns.module';
import { BannersModule } from '../banners/banners.module';
import { SettingsModule } from '../settings/settings.module';
import { CustomersModule } from '../customers/customers.module';
import { AddressesModule } from '../addresses/addresses.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { RewardsModule } from '../rewards/rewards.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { SupportModule } from '../support/support.module';
import { BookingModule } from '../booking/booking.module';
import { BranchesModule } from '../branches/branches.module';
import { PartnerModule } from '../partner/partner.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiConversation.name, schema: AiConversationSchema },
      { name: AiMessage.name, schema: AiMessageSchema },
      { name: AiGuestUsage.name, schema: AiGuestUsageSchema },
      { name: User.name, schema: UserSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
    OrdersModule,
    RidersModule,
    LedgerModule,
    WalletsModule,
    RefundsModule,
    AdminModule,
    SosModule,
    ServiceAreasModule,
    PartnerApplicationsModule,
    RiderApplicationsModule,
    PartnersModule,
    IncentiveCampaignsModule,
    BannersModule,
    SettingsModule,
    CustomersModule,
    AddressesModule,
    FavoritesModule,
    SubscriptionsModule,
    PromotionsModule,
    RewardsModule,
    ReviewsModule,
    SupportModule,
    BookingModule,
    BranchesModule,
    PartnerModule,
    DiscoveryModule,
  ],
  controllers: [AiAgentsController],
  providers: [AiAgentsService, AiToolRegistry, ApiSurfaceService],
  exports: [AiAgentsService],
})
export class AiAgentsModule {}
