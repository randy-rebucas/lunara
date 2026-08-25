import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from '../users/users.service';

/** Daily sweep that removes spam accounts created by an automated signup abuse pattern
 *  (emails containing "APPSBUILDERSPH"). Matching accounts are deleted outright. */
@Injectable()
export class SpamCleanupSchedulerService {
  private readonly logger = new Logger(SpamCleanupSchedulerService.name);

  constructor(private usersService: UsersService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async removeSpamUsers() {
    const { data } = await this.usersService.cleanupSpamUsers();
    if (data.deletedCount > 0) {
      this.logger.log(`Spam user cleanup: deleted ${data.deletedCount} user(s)`);
    }
  }
}
