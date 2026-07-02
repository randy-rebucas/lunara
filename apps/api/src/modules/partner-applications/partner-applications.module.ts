import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PartnerApplication, PartnerApplicationSchema } from './schemas/partner-application.schema';
import { PartnerApplicationsController } from './partner-applications.controller';
import { PartnerApplicationsService } from './partner-applications.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PartnerApplication.name, schema: PartnerApplicationSchema },
    ]),
  ],
  controllers: [PartnerApplicationsController],
  providers: [PartnerApplicationsService],
  exports: [PartnerApplicationsService],
})
export class PartnerApplicationsModule {}
