import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PartnerLead, PartnerLeadSchema } from './schemas/partner-lead.schema';
import { PublicLeadsController, AdminLeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: PartnerLead.name, schema: PartnerLeadSchema }])],
  controllers: [PublicLeadsController, AdminLeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
