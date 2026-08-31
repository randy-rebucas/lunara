import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Plan, PlanDocument } from './schemas/plan.schema';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlanService {
  constructor(@InjectModel(Plan.name) private planModel: Model<PlanDocument>) {}

  async list(includeInactive = false) {
    const filter = includeInactive ? {} : { isActive: true };
    return this.planModel.find(filter).sort({ sortOrder: 1, monthlyPrice: 1 }).lean();
  }

  async findById(planId: string | Types.ObjectId) {
    return this.planModel.findById(planId).lean();
  }

  async findByKey(key: string) {
    return this.planModel.findOne({ key }).lean();
  }

  async create(dto: CreatePlanDto) {
    const existing = await this.planModel.findOne({ key: dto.key });
    if (existing) throw new BadRequestException(`A plan with key "${dto.key}" already exists`);
    return this.planModel.create(dto);
  }

  async update(planId: string, dto: UpdatePlanDto) {
    const plan = await this.planModel.findByIdAndUpdate(planId, dto, { new: true });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }
}
