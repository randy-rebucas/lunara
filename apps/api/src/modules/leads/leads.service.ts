import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PartnerLead, PartnerLeadDocument } from './schemas/partner-lead.schema';
import { CreatePartnerLeadDto } from './dto/partner-lead.dto';

@Injectable()
export class LeadsService {
  constructor(
    @InjectModel(PartnerLead.name) private leadModel: Model<PartnerLeadDocument>,
  ) {}

  async create(dto: CreatePartnerLeadDto) {
    return this.leadModel.create(dto);
  }

  async listAll() {
    return this.leadModel.find().sort({ createdAt: -1 });
  }

  async setStatus(id: string, status: PartnerLead['status']) {
    const lead = await this.leadModel.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: false },
    );
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }
}
