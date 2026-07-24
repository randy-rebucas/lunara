import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { RidersModule } from '../riders/riders.module';
import {
  AdminIncentiveCampaignsController,
  RiderIncentiveCampaignsController,
} from './incentive-campaigns.controller';
import { IncentiveCampaignsSchedulerService } from './incentive-campaigns-scheduler.service';
import { IncentiveCampaignsService } from './incentive-campaigns.service';
import { CampaignCredit, CampaignCreditSchema } from './schemas/campaign-credit.schema';
import { IncentiveCampaign, IncentiveCampaignSchema } from './schemas/incentive-campaign.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IncentiveCampaign.name, schema: IncentiveCampaignSchema },
      { name: CampaignCredit.name, schema: CampaignCreditSchema },
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
    ]),
    RidersModule,
  ],
  controllers: [AdminIncentiveCampaignsController, RiderIncentiveCampaignsController],
  providers: [IncentiveCampaignsService, IncentiveCampaignsSchedulerService],
})
export class IncentiveCampaignsModule {}
