import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { UserRole, type PortalRole } from '@lunara/types';
import { resolveTagCode } from '@lunara/utils';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { resolvePortalBranchId } from '../partner/partner-access';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { User, UserDocument } from '../users/schemas/user.schema';
import { LaundryTag, LaundryTagDocument, LaundryTagStatus } from './schemas/laundry-tag.schema';
import { CreateTagBatchDto } from './dto/create-batch.dto';
import { RetireTagDto } from './dto/retire-tag.dto';
import { QueryTagsDto } from './dto/query-tags.dto';

const MAX_BATCH_CODE_RETRIES = 5;

@Injectable()
export class LaundryTagsService {
  constructor(
    @InjectModel(LaundryTag.name) private tagModel: Model<LaundryTagDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    private trackingGateway: TrackingGateway,
  ) {}

  async generateBatch(dto: CreateTagBatchDto, adminUserId: string) {
    const batchId = randomUUID();
    const prefix = dto.codePrefix ? dto.codePrefix.trim().toUpperCase() : 'TAG';

    for (let attempt = 0; attempt < MAX_BATCH_CODE_RETRIES; attempt++) {
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

      try {
        const tags = await this.tagModel.insertMany(docs, { ordered: true });
        this.trackingGateway.emitLaundryTagsUpdated({ reason: 'generated', batchId, count: tags.length });
        return { batchId, tags };
      } catch (e) {
        // Duplicate key (E11000): another batch claimed this code range concurrently — retry with a fresh sequence.
        const isDuplicateKey = (e as { code?: number })?.code === 11000;
        if (!isDuplicateKey || attempt === MAX_BATCH_CODE_RETRIES - 1) throw e;
      }
    }
    throw new BadRequestException('Could not generate a unique tag code range, please retry');
  }

  async findByCode(codeOrPayload: string): Promise<LaundryTagDocument | null> {
    const code = resolveTagCode(codeOrPayload);
    return this.tagModel.findOne({ code });
  }

  async assignToOrder(scannedValue: string, orderId: string, riderUserId: string): Promise<LaundryTagDocument> {
    const code = resolveTagCode(scannedValue);
    const orderObjectId = new Types.ObjectId(orderId);
    const now = new Date();

    // Atomic compare-and-swap: only succeeds if the tag is still AVAILABLE (or already
    // assigned to this same order, for an idempotent re-scan) at the moment of the update,
    // closing the TOCTOU window where two riders could otherwise both pass a read-then-save check.
    const assigned = await this.tagModel.findOneAndUpdate(
      {
        code,
        $or: [{ status: LaundryTagStatus.AVAILABLE }, { currentOrderId: orderObjectId }],
      },
      {
        $set: { status: LaundryTagStatus.ASSIGNED, currentOrderId: orderObjectId, currentAssignedAt: now },
        $push: {
          assignmentHistory: { orderId: orderObjectId, assignedAt: now, assignedBy: new Types.ObjectId(riderUserId) },
        },
      },
      { new: true },
    );
    if (assigned) {
      this.trackingGateway.emitLaundryTagsUpdated({
        reason: 'assigned',
        tagId: assigned._id.toString(),
        tagCode: assigned.code,
        orderId,
      });
      return assigned;
    }

    // The atomic update matched nothing — figure out why, to return an accurate error.
    const tag = await this.tagModel.findOne({ code });
    if (!tag) throw new NotFoundException('Tag not found');
    if (tag.status === LaundryTagStatus.RETIRED) {
      throw new BadRequestException('Tag is retired and cannot be assigned');
    }
    throw new BadRequestException('Tag is already in use on another order');
  }

  async releaseFromOrder(orderId: string, reason: 'delivered' | 'manual' | 'admin_override' = 'delivered'): Promise<void> {
    const orderObjectId = new Types.ObjectId(orderId);
    const tagBeforeRelease = await this.tagModel.findOne(
      { currentOrderId: orderObjectId, status: LaundryTagStatus.ASSIGNED },
      { _id: 1, code: 1 },
    );
    if (!tagBeforeRelease) return;

    await this.tagModel.updateOne(
      { currentOrderId: orderObjectId, status: LaundryTagStatus.ASSIGNED },
      [
        {
          $set: {
            status: LaundryTagStatus.AVAILABLE,
            currentOrderId: '$$REMOVE',
            currentAssignedAt: '$$REMOVE',
            assignmentHistory: {
              $map: {
                input: '$assignmentHistory',
                as: 'event',
                in: {
                  $cond: [
                    { $and: [{ $eq: ['$$event.orderId', orderObjectId] }, { $not: ['$$event.releasedAt'] }] },
                    { $mergeObjects: ['$$event', { releasedAt: new Date(), releaseReason: reason }] },
                    '$$event',
                  ],
                },
              },
            },
          },
        },
      ],
    );

    this.trackingGateway.emitLaundryTagsUpdated({
      reason: 'released',
      tagId: tagBeforeRelease._id.toString(),
      tagCode: tagBeforeRelease.code,
      orderId,
    });
  }

  async retire(tagId: string, dto: RetireTagDto, adminUserId: string): Promise<LaundryTagDocument> {
    const tag = await this.getById(tagId);
    const wasAssignedToOrderId = tag.currentOrderId;
    tag.status = LaundryTagStatus.RETIRED;
    tag.retiredAt = new Date();
    tag.retiredBy = new Types.ObjectId(adminUserId);
    tag.retiredReason = dto.reason;
    tag.currentOrderId = undefined;
    tag.currentAssignedAt = undefined;
    if (wasAssignedToOrderId) {
      // Close the open assignment record instead of leaving it dangling: the order still
      // references this tagId, but its history now correctly shows the assignment ended.
      const openEvent = [...tag.assignmentHistory].reverse().find((e) => !e.releasedAt);
      if (openEvent) {
        openEvent.releasedAt = new Date();
        openEvent.releaseReason = 'admin_override';
      }
    }
    await tag.save();
    this.trackingGateway.emitLaundryTagsUpdated({ reason: 'retired', tagId: tag._id.toString(), tagCode: tag.code });
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
    this.trackingGateway.emitLaundryTagsUpdated({ reason: 'reactivated', tagId: tag._id.toString(), tagCode: tag.code });
    return tag;
  }

  async listTags(query: QueryTagsDto, actor: { sub: string; role: PortalRole }) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.batchId) filter.batchId = query.batchId;

    if (actor.role === UserRole.STAFF) {
      // Staff are locked to their own branch regardless of what branchId (if any) was requested.
      const staffBranchId = await resolvePortalBranchId(this.userModel, actor.sub, actor.role);
      if (!staffBranchId) return { items: [], total: 0 };
      filter.branchId = staffBranchId;
    } else if (actor.role === UserRole.PARTNER) {
      // Partners see tags across whichever branches they own; a requested branchId narrows
      // that set further but can never widen it to another partner's branch.
      const ownedBranchIds = (
        await this.branchModel.find({ partnerUserId: new Types.ObjectId(actor.sub) }).select('_id').lean()
      ).map((b) => b._id);
      if (query.branchId) {
        const requested = new Types.ObjectId(query.branchId);
        if (!ownedBranchIds.some((id) => id.equals(requested))) return { items: [], total: 0 };
        filter.branchId = requested;
      } else {
        filter.branchId = { $in: ownedBranchIds };
      }
    } else if (query.branchId) {
      // ADMIN — free to filter by any branch.
      filter.branchId = new Types.ObjectId(query.branchId);
    }

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

  /** Resolves a scanned tag code/QR payload to its current order + owning customer, scoped by role. */
  async lookup(codeOrPayload: string, actor: { sub: string; role: UserRole }) {
    const code = resolveTagCode(codeOrPayload);
    const tag = await this.tagModel.findOne({ code });
    if (!tag) throw new NotFoundException('Tag not found');

    if (!tag.currentOrderId) {
      if (actor.role === UserRole.CUSTOMER || actor.role === UserRole.RIDER) {
        throw new ForbiddenException('This tag is not currently attached to any order');
      }
      return { tag: { code: tag.code, status: tag.status }, order: null, customer: null };
    }

    const order = await this.orderModel.findById(tag.currentOrderId);
    if (!order) {
      return { tag: { code: tag.code, status: tag.status }, order: null, customer: null };
    }

    await this.assertLookupAccess(order, actor);

    const [customerProfile, customerUser] = await Promise.all([
      this.customerModel.findOne({ userId: order.customerId }).select('firstName lastName'),
      this.userModel.findById(order.customerId).select('phone'),
    ]);

    return {
      tag: { code: tag.code, status: tag.status },
      order: {
        id: order._id.toString(),
        shortCode: order._id.toString().slice(-6).toUpperCase(),
        status: order.status,
        branchId: order.branchId?.toString(),
      },
      customer: customerProfile
        ? { firstName: customerProfile.firstName, lastName: customerProfile.lastName, phone: customerUser?.phone }
        : null,
    };
  }

  private async assertLookupAccess(order: OrderDocument, actor: { sub: string; role: UserRole }) {
    if (actor.role === UserRole.ADMIN) return;

    if (actor.role === UserRole.PARTNER) {
      const ownedBranchIds = (
        await this.branchModel.find({ partnerUserId: new Types.ObjectId(actor.sub) }).select('_id').lean()
      ).map((b) => b._id.toString());
      if (order.branchId && ownedBranchIds.includes(order.branchId.toString())) return;
      throw new ForbiddenException('Order is not at one of your branches');
    }

    if (actor.role === UserRole.STAFF) {
      const staffBranchId = await resolvePortalBranchId(this.userModel, actor.sub, actor.role);
      if (staffBranchId && order.branchId?.toString() === staffBranchId.toString()) return;
      throw new ForbiddenException('Order is not at your branch');
    }

    if (actor.role === UserRole.RIDER) {
      const isPickupRider = order.pickupRiderId?.toString() === actor.sub;
      const isDeliveryRider = order.deliveryRiderId?.toString() === actor.sub;
      if (isPickupRider || isDeliveryRider) return;
      throw new ForbiddenException('You are not assigned to this order');
    }

    if (actor.role === UserRole.CUSTOMER) {
      if (order.customerId.toString() === actor.sub) return;
      throw new ForbiddenException('This tag is not linked to one of your orders');
    }

    throw new ForbiddenException('Not allowed to look up this tag');
  }
}
