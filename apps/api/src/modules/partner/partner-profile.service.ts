import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { UserRole } from '@lunara/types';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UserProfile, UserProfileDocument } from '../users/schemas/user-profile.schema';
import { CloudinaryStorageService } from '../../common/storage/cloudinary-storage.service';
import { ResetStaffPasswordDto } from './dto/reset-staff-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

function formatProfile(profile?: Pick<UserProfile, 'displayName' | 'avatarUrl'> | null) {
  return {
    displayName: profile?.displayName,
    avatarUrl: profile?.avatarUrl,
  };
}

@Injectable()
export class PartnerProfileService {
  constructor(
    @InjectModel(UserProfile.name) private readonly userProfileModel: Model<UserProfileDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    private readonly cloudinaryStorageService: CloudinaryStorageService,
  ) {}

  async getOwnProfile(userId: string) {
    const profile = await this.userProfileModel.findOne({ userId: new Types.ObjectId(userId) }).lean();
    return { success: true, data: formatProfile(profile) };
  }

  async updateOwnProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.displayName === undefined) {
      return this.getOwnProfile(userId);
    }
    const profile = await this.upsertProfile(userId, { displayName: dto.displayName });
    return { success: true, data: formatProfile(profile) };
  }

  async updateOwnAvatar(userId: string, file: Express.Multer.File) {
    const previousAvatarUrl = (
      await this.userProfileModel.findOne({ userId: new Types.ObjectId(userId) }).select('avatarUrl').lean()
    )?.avatarUrl;
    const result = await this.cloudinaryStorageService.uploadBuffer(
      file.buffer,
      'lunara/user-avatars',
      `${userId}-${Date.now()}`,
      'image',
      file.mimetype,
    );
    const profile = await this.upsertProfile(userId, { avatarUrl: result.secure_url });
    await this.cloudinaryStorageService.deleteFile('lunara/user-avatars', previousAvatarUrl);
    return { success: true, data: formatProfile(profile) };
  }

  async removeOwnAvatar(userId: string) {
    const previousAvatarUrl = (
      await this.userProfileModel.findOne({ userId: new Types.ObjectId(userId) }).select('avatarUrl').lean()
    )?.avatarUrl;
    const profile = await this.upsertProfile(userId, { avatarUrl: undefined });
    await this.cloudinaryStorageService.deleteFile('lunara/user-avatars', previousAvatarUrl);
    return { success: true, data: formatProfile(profile) };
  }

  async updateStaffProfile(
    partnerUserId: string,
    staffUserId: string,
    dto: UpdateProfileDto,
    role: UserRole,
  ) {
    await this.assertOwnsStaff(partnerUserId, staffUserId, role);

    if (dto.canManageSettings !== undefined) {
      await this.userModel.updateOne(
        { _id: staffUserId },
        { canManageSettings: dto.canManageSettings },
      );
    }

    if (dto.phone !== undefined) {
      const phone = dto.phone.trim();
      await this.userModel.updateOne(
        { _id: staffUserId },
        phone ? { phone } : { $unset: { phone: '' } },
      );
    }

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      const existing = await this.userModel.findOne({ email, _id: { $ne: staffUserId } }).select('_id');
      if (existing) {
        throw new ConflictException('A user with this email already exists');
      }
      await this.userModel.updateOne({ _id: staffUserId }, { email });
    }

    if (dto.displayName === undefined) {
      const profile = await this.userProfileModel
        .findOne({ userId: new Types.ObjectId(staffUserId) })
        .lean();
      return {
        success: true,
        data: { ...formatProfile(profile), canManageSettings: dto.canManageSettings, phone: dto.phone, email: dto.email },
      };
    }
    const profile = await this.upsertProfile(staffUserId, { displayName: dto.displayName });
    return {
      success: true,
      data: { ...formatProfile(profile), canManageSettings: dto.canManageSettings, phone: dto.phone, email: dto.email },
    };
  }

  async resetStaffPassword(
    partnerUserId: string,
    staffUserId: string,
    dto: ResetStaffPasswordDto,
    role: UserRole,
  ) {
    await this.assertOwnsStaff(partnerUserId, staffUserId, role);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.userModel.updateOne({ _id: staffUserId }, { passwordHash });
    return { success: true };
  }

  async updateStaffAvatar(
    partnerUserId: string,
    staffUserId: string,
    file: Express.Multer.File,
    role: UserRole,
  ) {
    await this.assertOwnsStaff(partnerUserId, staffUserId, role);
    const previousAvatarUrl = (
      await this.userProfileModel.findOne({ userId: new Types.ObjectId(staffUserId) }).select('avatarUrl').lean()
    )?.avatarUrl;
    const result = await this.cloudinaryStorageService.uploadBuffer(
      file.buffer,
      'lunara/user-avatars',
      `${staffUserId}-${Date.now()}`,
      'image',
      file.mimetype,
    );
    const profile = await this.upsertProfile(staffUserId, { avatarUrl: result.secure_url });
    await this.cloudinaryStorageService.deleteFile('lunara/user-avatars', previousAvatarUrl);
    return { success: true, data: formatProfile(profile) };
  }

  private async assertOwnsStaff(partnerUserId: string, staffUserId: string, role: UserRole) {
    const staff = await this.userModel.findById(staffUserId).select('branchId role');
    if (!staff || staff.role !== UserRole.STAFF) {
      throw new NotFoundException('Staff member not found');
    }
    if (role === UserRole.ADMIN) return;
    if (!staff.branchId) {
      throw new ForbiddenException('Staff member has no branch assignment');
    }
    const branch = await this.branchModel
      .findOne({ _id: staff.branchId, partnerUserId: new Types.ObjectId(partnerUserId) })
      .select('_id');
    if (!branch) {
      throw new ForbiddenException("Cannot update another shop's staff");
    }
  }

  private async upsertProfile(
    userId: string,
    patch: { displayName?: string; avatarUrl?: string },
  ) {
    const update: Record<string, unknown> = {};
    const unset: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) unset[key] = '';
      else update[key] = value;
    }
    return this.userProfileModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { ...(Object.keys(update).length ? { $set: update } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { upsert: true, new: true },
    );
  }
}
