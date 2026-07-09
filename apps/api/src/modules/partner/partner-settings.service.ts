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
import { LocalStorageService } from '../../common/storage/local-storage.service';
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
    private readonly localStorageService: LocalStorageService,
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
      logoUrl: branch.logoUrl,
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
        settings: normalizePortalSettings(branch.toObject().portalSettings),
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
      throw new ForbiddenException("Cannot update another shop's settings");
    }

    // Strip undefined values from dto so unset optional fields don't overwrite existing settings
    const patch = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    ) as Partial<PartnerPortalSettings>;

    branch.portalSettings = normalizePortalSettings({
      ...branch.toObject().portalSettings,
      ...patch,
    });
    branch.markModified('portalSettings');
    await branch.save();

    return {
      success: true,
      data: {
        branch: this.formatBranch(branch),
        settings: normalizePortalSettings(branch.toObject().portalSettings),
        canEdit: true,
      },
    };
  }

  async updateLogo(userId: string, role: UserRole, file: Express.Multer.File) {
    if (role !== UserRole.PARTNER && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only shop partners can update the shop logo');
    }
    const branch = await this.resolveBranch(userId, role);
    if (role === UserRole.PARTNER && branch.partnerUserId.toString() !== userId) {
      throw new ForbiddenException("Cannot update another shop's logo");
    }

    const previousLogoUrl = branch.logoUrl;
    const result = await this.localStorageService.uploadBuffer(
      file.buffer,
      'lunara/branch-logos',
      `${branch._id.toString()}-${Date.now()}`,
      'image',
      file.mimetype,
    );
    branch.logoUrl = result.secure_url;
    await branch.save();
    await this.localStorageService.deleteFile('lunara/branch-logos', previousLogoUrl);

    return {
      success: true,
      data: { branch: this.formatBranch(branch) },
    };
  }

  async removeLogo(userId: string, role: UserRole) {
    if (role !== UserRole.PARTNER && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only shop partners can update the shop logo');
    }
    const branch = await this.resolveBranch(userId, role);
    if (role === UserRole.PARTNER && branch.partnerUserId.toString() !== userId) {
      throw new ForbiddenException("Cannot update another shop's logo");
    }

    const previousLogoUrl = branch.logoUrl;
    branch.logoUrl = undefined;
    await branch.save();
    await this.localStorageService.deleteFile('lunara/branch-logos', previousLogoUrl);

    return {
      success: true,
      data: { branch: this.formatBranch(branch) },
    };
  }
}
