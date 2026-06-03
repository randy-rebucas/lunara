import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '@lunara/types';
import {
  Branch,
  BranchDocument,
  DEFAULT_PARTNER_PORTAL_SETTINGS,
  PartnerPortalSettings,
} from '../branches/schemas/branch.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { resolvePortalBranchId } from './partner-access';
import { UpdatePartnerSettingsDto } from './dto/update-partner-settings.dto';

function normalizePortalSettings(raw?: Partial<PartnerPortalSettings> | null): PartnerPortalSettings {
  return { ...DEFAULT_PARTNER_PORTAL_SETTINGS, ...(raw ?? {}) };
}

@Injectable()
export class PartnerSettingsService {
  constructor(
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private async resolveBranch(userId: string, role: UserRole): Promise<BranchDocument> {
    if (role === UserRole.PARTNER || role === UserRole.ADMIN) {
      const branch =
        role === UserRole.ADMIN
          ? await this.branchModel.findOne({ branchType: 'partner_shop' }).sort({ name: 1 })
          : await this.branchModel.findOne({ partnerUserId: new Types.ObjectId(userId) });
      if (!branch) throw new NotFoundException('Partner shop branch not found');
      return branch;
    }

    const branchId = await resolvePortalBranchId(this.userModel, userId, role);
    if (!branchId) throw new NotFoundException('No branch assigned to this account');
    const branch = await this.branchModel.findById(branchId);
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  private formatBranch(branch: BranchDocument) {
    return {
      id: branch._id.toString(),
      code: branch.code,
      name: branch.name,
      line1: branch.line1,
      city: branch.city,
      province: branch.province,
      isActive: branch.isActive,
      maxActiveOrders: branch.maxActiveOrders,
      maxWeightCapacityKg: branch.maxWeightCapacityKg,
      dailyQuotaOrders: branch.dailyQuotaOrders,
      dailyQuotaWeightKg: branch.dailyQuotaWeightKg,
      serviceRadiusKm: branch.serviceRadiusKm,
    };
  }

  async getSettings(userId: string, role: UserRole) {
    const branch = await this.resolveBranch(userId, role);
    const canEdit = role === UserRole.PARTNER || role === UserRole.ADMIN;
    return {
      success: true,
      data: {
        branch: this.formatBranch(branch),
        settings: normalizePortalSettings(branch.portalSettings),
        canEdit,
      },
    };
  }

  async updateSettings(userId: string, role: UserRole, dto: UpdatePartnerSettingsDto) {
    if (role !== UserRole.PARTNER && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only shop partners can update settings');
    }

    const branch = await this.resolveBranch(userId, role);
    if (role === UserRole.PARTNER && branch.partnerUserId.toString() !== userId) {
      throw new ForbiddenException('Cannot update another shop’s settings');
    }

    branch.portalSettings = normalizePortalSettings({
      ...branch.portalSettings,
      ...dto,
    });
    await branch.save();

    return {
      success: true,
      data: {
        branch: this.formatBranch(branch),
        settings: branch.portalSettings,
        canEdit: true,
      },
    };
  }
}
