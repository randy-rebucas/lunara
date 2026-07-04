import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { resolveTagCode } from '@lunara/utils';
import { LaundryTag, LaundryTagDocument, LaundryTagStatus } from './schemas/laundry-tag.schema';
import { CreateTagBatchDto } from './dto/create-batch.dto';
import { RetireTagDto } from './dto/retire-tag.dto';
import { QueryTagsDto } from './dto/query-tags.dto';

@Injectable()
export class LaundryTagsService {
  constructor(
    @InjectModel(LaundryTag.name) private tagModel: Model<LaundryTagDocument>,
  ) {}

  async generateBatch(dto: CreateTagBatchDto, adminUserId: string) {
    const batchId = randomUUID();
    const prefix = dto.codePrefix ? dto.codePrefix.trim().toUpperCase() : 'TAG';

    const lastTag = await this.tagModel
      .findOne({ code: new RegExp(`^${prefix}-`) })
      .sort({ code: -1 })
      .lean();
    let nextSeq = 1;
    if (lastTag) {
      const match = lastTag.code.match(/-(\d+)$/);
      if (match) nextSeq = parseInt(match[1], 10) + 1;
    }

    const docs = Array.from({ length: dto.quantity }, (_, i) => ({
      code: `${prefix}-${String(nextSeq + i).padStart(6, '0')}`,
      status: LaundryTagStatus.AVAILABLE,
      branchId: dto.branchId ? new Types.ObjectId(dto.branchId) : undefined,
      generatedBy: new Types.ObjectId(adminUserId),
      batchId,
      assignmentHistory: [],
    }));

    const tags = await this.tagModel.insertMany(docs);
    return { batchId, tags };
  }

  async findByCode(codeOrPayload: string): Promise<LaundryTagDocument | null> {
    const code = resolveTagCode(codeOrPayload);
    return this.tagModel.findOne({ code });
  }

  async assignToOrder(scannedValue: string, orderId: string, riderUserId: string): Promise<LaundryTagDocument> {
    const tag = await this.findByCode(scannedValue);
    if (!tag) throw new NotFoundException('Tag not found');

    if (tag.status === LaundryTagStatus.RETIRED) {
      throw new BadRequestException('Tag is retired and cannot be assigned');
    }
    if (tag.status === LaundryTagStatus.ASSIGNED) {
      if (tag.currentOrderId?.toString() === orderId) {
        return tag;
      }
      throw new BadRequestException('Tag is already in use on another order');
    }

    tag.status = LaundryTagStatus.ASSIGNED;
    tag.currentOrderId = new Types.ObjectId(orderId);
    tag.currentAssignedAt = new Date();
    tag.assignmentHistory.push({
      orderId: new Types.ObjectId(orderId),
      assignedAt: new Date(),
      assignedBy: new Types.ObjectId(riderUserId),
    });
    await tag.save();
    return tag;
  }

  async releaseFromOrder(orderId: string, reason: 'delivered' | 'manual' | 'admin_override' = 'delivered'): Promise<void> {
    const tag = await this.tagModel.findOne({
      currentOrderId: new Types.ObjectId(orderId),
      status: LaundryTagStatus.ASSIGNED,
    });
    if (!tag) return;

    tag.status = LaundryTagStatus.AVAILABLE;
    tag.currentOrderId = undefined;
    tag.currentAssignedAt = undefined;
    const openEvent = [...tag.assignmentHistory].reverse().find((e) => !e.releasedAt);
    if (openEvent) {
      openEvent.releasedAt = new Date();
      openEvent.releaseReason = reason;
    }
    await tag.save();
  }

  async retire(tagId: string, dto: RetireTagDto, adminUserId: string): Promise<LaundryTagDocument> {
    const tag = await this.getById(tagId);
    tag.status = LaundryTagStatus.RETIRED;
    tag.retiredAt = new Date();
    tag.retiredBy = new Types.ObjectId(adminUserId);
    tag.retiredReason = dto.reason;
    await tag.save();
    return tag;
  }

  async reactivate(tagId: string, _adminUserId: string): Promise<LaundryTagDocument> {
    const tag = await this.getById(tagId);
    if (tag.status !== LaundryTagStatus.RETIRED) {
      throw new BadRequestException('Only retired tags can be reactivated');
    }
    tag.status = LaundryTagStatus.AVAILABLE;
    tag.retiredAt = undefined;
    tag.retiredBy = undefined;
    tag.retiredReason = undefined;
    await tag.save();
    return tag;
  }

  async listTags(query: QueryTagsDto) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.branchId) filter.branchId = new Types.ObjectId(query.branchId);
    if (query.batchId) filter.batchId = query.batchId;

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const [items, total] = await Promise.all([
      this.tagModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.tagModel.countDocuments(filter),
    ]);

    return { items, total };
  }

  async getById(tagId: string): Promise<LaundryTagDocument> {
    const tag = await this.tagModel.findById(tagId);
    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }
}
