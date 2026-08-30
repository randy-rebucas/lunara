import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '@lunara/types';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { resolvePortalBranchId } from './partner-access';
import { Shelf, ShelfDocument } from './schemas/shelf.schema';
import { AddShelfItemDto, CreateShelfDto } from './dto/shelf.dto';

@Injectable()
export class ShelfService {
  constructor(
    @InjectModel(Shelf.name) private shelfModel: Model<ShelfDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /** Branches this user may see shelves for. STAFF: their one branch. PARTNER: every branch they own. ADMIN: all shop branches. */
  private async resolveAccessibleBranchIds(userId: string, role: UserRole): Promise<Types.ObjectId[]> {
    if (role === UserRole.STAFF) {
      const branchId = await resolvePortalBranchId(this.userModel, userId, role);
      return branchId ? [branchId] : [];
    }
    if (role === UserRole.PARTNER) {
      const branches = await this.branchModel.find({ partnerUserId: new Types.ObjectId(userId) });
      return branches.map((b) => b._id);
    }
    const branches = await this.branchModel.find({ branchType: 'partner_shop' });
    return branches.map((b) => b._id);
  }

  /** Which single branch a new shelf should be created under. */
  private async resolveTargetBranchId(
    userId: string,
    role: UserRole,
    branchIdInput?: string,
  ): Promise<Types.ObjectId> {
    if (role === UserRole.STAFF) {
      const branchId = await resolvePortalBranchId(this.userModel, userId, role);
      if (!branchId) throw new ForbiddenException('Staff account has no branch assignment');
      return branchId;
    }

    const accessible = await this.resolveAccessibleBranchIds(userId, role);
    if (accessible.length === 0) throw new BadRequestException('No shop branch found for this account');

    if (branchIdInput) {
      const match = accessible.find((b) => b.toString() === branchIdInput);
      if (!match) throw new ForbiddenException('Branch is not managed by this account');
      return match;
    }
    return accessible[0];
  }

  private async assertShelfAccess(shelfId: string, userId: string, role: UserRole): Promise<ShelfDocument> {
    const shelf = await this.shelfModel.findById(shelfId);
    if (!shelf) throw new NotFoundException('Shelf not found');
    const accessible = await this.resolveAccessibleBranchIds(userId, role);
    if (!accessible.some((b) => b.toString() === shelf.branchId.toString())) {
      throw new ForbiddenException('Shelf is not managed by this account');
    }
    return shelf;
  }

  private formatShelf(shelf: ShelfDocument) {
    return {
      _id: shelf._id.toString(),
      branchId: shelf.branchId.toString(),
      name: shelf.name,
      items: shelf.items.map((item) => ({
        _id: (item as unknown as { _id: Types.ObjectId })._id.toString(),
        name: item.name,
        quantity: item.quantity,
        note: item.note,
        createdAt: (item as unknown as { createdAt: Date }).createdAt,
      })),
      createdAt: shelf.createdAt,
      updatedAt: shelf.updatedAt,
    };
  }

  async createShelf(userId: string, role: UserRole, dto: CreateShelfDto) {
    const branchId = await this.resolveTargetBranchId(userId, role, dto.branchId);
    const existing = await this.shelfModel
      .findOne({ branchId, name: dto.name })
      .collation({ locale: 'en', strength: 2 });
    if (existing) throw new BadRequestException('A shelf with this name already exists');

    const shelf = await this.shelfModel.create({ branchId, name: dto.name, items: [] });
    return { success: true, data: this.formatShelf(shelf) };
  }

  async listShelves(userId: string, role: UserRole) {
    const branchIds = await this.resolveAccessibleBranchIds(userId, role);
    if (branchIds.length === 0) return { success: true, data: [] };
    const shelves = await this.shelfModel.find({ branchId: { $in: branchIds } }).sort({ name: 1 });
    return { success: true, data: shelves.map((s) => this.formatShelf(s)) };
  }

  async deleteShelf(userId: string, role: UserRole, shelfId: string) {
    const shelf = await this.assertShelfAccess(shelfId, userId, role);
    await shelf.deleteOne();
    return { success: true, data: { _id: shelfId } };
  }

  async addItem(userId: string, role: UserRole, shelfId: string, dto: AddShelfItemDto) {
    const shelf = await this.assertShelfAccess(shelfId, userId, role);
    shelf.items.push({
      name: dto.name,
      quantity: dto.quantity ?? 1,
      note: dto.note,
      addedBy: new Types.ObjectId(userId),
    } as never);
    await shelf.save();
    return { success: true, data: this.formatShelf(shelf) };
  }

  async removeItem(userId: string, role: UserRole, shelfId: string, itemId: string) {
    const shelf = await this.assertShelfAccess(shelfId, userId, role);
    const before = shelf.items.length;
    shelf.items = shelf.items.filter(
      (item) => (item as unknown as { _id: Types.ObjectId })._id.toString() !== itemId,
    ) as never;
    if (shelf.items.length === before) throw new NotFoundException('Item not found on this shelf');
    await shelf.save();
    return { success: true, data: this.formatShelf(shelf) };
  }

  async searchItems(userId: string, role: UserRole, query: string) {
    const trimmed = query.trim();
    if (!trimmed) return { success: true, data: [] };
    const branchIds = await this.resolveAccessibleBranchIds(userId, role);
    if (branchIds.length === 0) return { success: true, data: [] };

    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'i');

    const shelves = await this.shelfModel.find({
      branchId: { $in: branchIds },
      'items.name': pattern,
    });

    const results: {
      shelfId: string;
      shelfName: string;
      itemId: string;
      name: string;
      quantity: number;
      note?: string;
    }[] = [];

    for (const shelf of shelves) {
      for (const item of shelf.items) {
        if (pattern.test(item.name)) {
          results.push({
            shelfId: shelf._id.toString(),
            shelfName: shelf.name,
            itemId: (item as unknown as { _id: Types.ObjectId })._id.toString(),
            name: item.name,
            quantity: item.quantity,
            note: item.note,
          });
        }
      }
    }

    return { success: true, data: results };
  }
}
