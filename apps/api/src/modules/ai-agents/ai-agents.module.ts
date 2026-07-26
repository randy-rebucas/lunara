import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiConversation, AiConversationSchema } from './schemas/ai-conversation.schema';
import { AiMessage, AiMessageSchema } from './schemas/ai-message.schema';
import { AiAgentsController } from './ai-agents.controller';
import { AiAgentsService } from './ai-agents.service';
import { AiToolRegistry } from './tools/registry';
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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiConversation.name, schema: AiConversationSchema },
      { name: AiMessage.name, schema: AiMessageSchema },
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
  ],
  controllers: [AiAgentsController],
  providers: [AiAgentsService, AiToolRegistry],
  exports: [AiAgentsService],
})
export class AiAgentsModule {}
