import { Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AutomationSchedulerService } from './automation-scheduler.service';

@Controller('admin/automation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AutomationController {
  constructor(private readonly schedulerService: AutomationSchedulerService) {}

  /** Sends the weekly SMS + email stats summary immediately, bypassing the enabled toggle — for
   *  testing the SMS/email pipeline without waiting for the weekly cron. */
  @Post('weekly-stats/send-now')
  async sendWeeklyStatsNow() {
    await this.schedulerService.sendWeeklyStats(true);
    return { success: true };
  }
}
