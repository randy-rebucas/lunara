import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IncentiveCampaignsService } from './incentive-campaigns.service';

@Injectable()
export class IncentiveCampaignsSchedulerService {
  private readonly logger = new Logger(IncentiveCampaignsSchedulerService.name);

  constructor(private readonly incentiveCampaignsService: IncentiveCampaignsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async sweep() {
    try {
      await this.incentiveCampaignsService.sweepAndCreditEligibleRiders();
    } catch (err) {
      this.logger.error(`Incentive campaign sweep failed: ${(err as Error).message}`);
    }
  }
}
