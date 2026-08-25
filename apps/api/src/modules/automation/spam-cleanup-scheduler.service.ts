import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';

/** Case-insensitive marker seen in a wave of spam signups; matched against the email's local+domain part. */
const SPAM_EMAIL_PATTERN = /APPSBUILDERSPH/i;

/** Daily sweep that removes spam accounts created by an automated signup abuse pattern
 *  (emails containing "APPSBUILDERSPH"). Matching accounts are deleted outright. */
@Injectable()
export class SpamCleanupSchedulerService {
  private readonly logger = new Logger(SpamCleanupSchedulerService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async removeSpamUsers() {
    const spamUsers = await this.userModel
      .find({ email: { $regex: SPAM_EMAIL_PATTERN } })
      .select('_id');

    if (spamUsers.length === 0) return;

    const userIds = spamUsers.map((u) => u._id);
    await this.customerModel.deleteMany({ userId: { $in: userIds } });
    const result = await this.userModel.deleteMany({ _id: { $in: userIds } });

    this.logger.log(`Spam user cleanup: deleted ${result.deletedCount} user(s)`);
  }
}
