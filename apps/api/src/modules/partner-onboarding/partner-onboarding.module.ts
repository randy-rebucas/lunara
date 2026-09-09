import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { BranchesModule } from '../branches/branches.module';
import { PartnersModule } from '../partners/partners.module';
import { BillingModule } from '../billing/billing.module';
import { EmailModule } from '../../common/email/email.module';
import { AuthModule } from '../auth/auth.module';
import { PartnerOnboardingController } from './partner-onboarding.controller';
import { PartnerOnboardingService } from './partner-onboarding.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
    BranchesModule,
    PartnersModule,
    BillingModule,
    EmailModule,
    AuthModule,
  ],
  controllers: [PartnerOnboardingController],
  providers: [PartnerOnboardingService],
})
export class PartnerOnboardingModule {}
