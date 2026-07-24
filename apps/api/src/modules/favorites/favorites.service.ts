import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { FavoriteBranch, FavoriteBranchDocument } from './schemas/favorite-branch.schema';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(FavoriteBranch.name) private favoriteModel: Model<FavoriteBranchDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
  ) {}

  async findAll(userId: string) {
    const favorites = await this.favoriteModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 });

    const branchIds = favorites.map((f) => f.branchId);
    const branches = await this.branchModel
      .find({ _id: { $in: branchIds } })
      .select('code name city logoUrl');
    const branchById = new Map(branches.map((b) => [b._id.toString(), b]));

    const data = favorites
      .map((f) => {
        const branch = branchById.get(f.branchId.toString());
        if (!branch) return null;
        return {
          branchId: branch._id.toString(),
          code: branch.code,
          name: branch.name,
          city: branch.city,
          logoUrl: branch.logoUrl,
          favoritedAt: f.createdAt,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);

    return { success: true, data };
  }

  async create(userId: string, branchId: string) {
    const branchExists = await this.branchModel.exists({ _id: branchId });
    if (!branchExists) throw new NotFoundException('Shop not found');

    await this.favoriteModel.updateOne(
      { userId: new Types.ObjectId(userId), branchId: new Types.ObjectId(branchId) },
      { $setOnInsert: { userId: new Types.ObjectId(userId), branchId: new Types.ObjectId(branchId) } },
      { upsert: true },
    );

    return { success: true, data: { favorited: true } };
  }

  async remove(userId: string, branchId: string) {
    await this.favoriteModel.deleteOne({
      userId: new Types.ObjectId(userId),
      branchId: new Types.ObjectId(branchId),
    });
    return { success: true, data: { favorited: false } };
  }
}
