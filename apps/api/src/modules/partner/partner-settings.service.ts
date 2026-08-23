import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '@lunara/types';
import { DEFAULT_OPERATING_HOURS } from '@lunara/utils';
import {
  Branch,
  BranchDocument,
  DEFAULT_PARTNER_PORTAL_SETTINGS,
  PartnerPortalSettings,
} from '../branches/schemas/branch.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CloudinaryStorageService } from '../../common/storage/cloudinary-storage.service';
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
    private readonly cloudinaryStorageService: CloudinaryStorageService,
  ) {}

  private async resolveBranch(userId: string, role: UserRole): Promise<BranchDocument> {
    if (role === UserRole.PARTNER || role === UserRole.ADMIN) {
      const branch =
        role === UserRole.ADMIN
          ? await this.branchModel.findOne({ branchType: 'partner_shop' }).sort({ name: 1 })
          : await this.branchModel
              .findOne({ partnerUserId: new Types.ObjectId(userId) })
              .sort({ isMainShop: -1, name: 1 });
      if (!branch) throw new NotFoundException('Partner shop branch not found');
      return branch;
    }

    const branchId = await resolvePortalBranchId(this.userModel, userId, role);
    if (!branchId) throw new NotFoundException('No branch assigned to this account');
    const branch = await this.branchModel.findById(branchId);
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  /** Holidays set directly on this branch, or inherited from the partner's main shop when this
   * branch hasn't defined its own — mirrors BranchesService.resolveBranchHolidays for the customer
   * side. Also reports whether the returned list is this branch's own or inherited, so the partner
   * portal can label it correctly. */
  private async resolveHolidaysForSettings(branch: BranchDocument) {
    if (branch.holidays?.length) return { holidays: branch.holidays, inherited: false };
    if (branch.isMainShop) return { holidays: [], inherited: false };
    const mainShop = await this.branchModel
      .findOne({ partnerUserId: branch.partnerUserId, isMainShop: true, isActive: true })
      .lean();
    return { holidays: mainShop?.holidays ?? [], inherited: true };
  }

  private async formatBranch(branch: BranchDocument) {
    const { holidays, inherited } = await this.resolveHolidaysForSettings(branch);
    return {
      id: branch._id.toString(),
      code: branch.code,
      name: branch.name,
      line1: branch.line1,
      city: branch.city,
      province: branch.province,
      isActive: branch.isActive,
      isMainShop: branch.isMainShop,
      logoUrl: branch.logoUrl,
      maxActiveOrders: branch.maxActiveOrders,
      maxWeightCapacityKg: branch.maxWeightCapacityKg,
      dailyQuotaOrders: branch.dailyQuotaOrders,
      dailyQuotaWeightKg: branch.dailyQuotaWeightKg,
      serviceRadiusKm: branch.serviceRadiusKm,
      operatingHours:
        branch.operatingHours?.length === 7 ? branch.operatingHours : DEFAULT_OPERATING_HOURS,
      holidays,
      holidaysInherited: inherited,
    };
  }

  async getSettings(userId: string, role: UserRole) {
    const branch = await this.resolveBranch(userId, role);
    const canEdit = await this.resolveCanEdit(userId, role);
    const settings = normalizePortalSettings(branch.toObject().portalSettings);
    return {
      success: true,
      data: {
        branch: await this.formatBranch(branch),
        // Payout details (bank/e-wallet account info) are only relevant to whoever can actually
        // change them — staff have no need to see the shop owner's financial account numbers.
        settings: canEdit ? settings : this.stripPayoutDetails(settings),
        canEdit,
      },
    };
  }

  /** PARTNER/ADMIN always have full settings access; STAFF only if explicitly granted via
   * User.canManageSettings (defaults to false — view-only). */
  private async resolveCanEdit(userId: string, role: UserRole): Promise<boolean> {
    if (role === UserRole.PARTNER || role === UserRole.ADMIN) return true;
    const staff = await this.userModel.findById(userId).select('canManageSettings').lean();
    return Boolean(staff?.canManageSettings);
  }

  private stripPayoutDetails(settings: PartnerPortalSettings): PartnerPortalSettings {
    const {
      payoutMethod: _payoutMethod,
      gcashNumber: _gcashNumber,
      mayaNumber: _mayaNumber,
      bankName: _bankName,
      bankAccountName: _bankAccountName,
      bankAccountNumber: _bankAccountNumber,
      ...rest
    } = settings;
    return rest as PartnerPortalSettings;
  }

  async updateSettings(userId: string, role: UserRole, dto: UpdatePartnerSettingsDto) {
    if (!(await this.resolveCanEdit(userId, role))) {
      throw new ForbiddenException(
        role === UserRole.STAFF
          ? 'You do not have permission to edit shop settings'
          : 'Only shop partners can update settings',
      );
    }

    const branch = await this.resolveBranch(userId, role);
    if (role === UserRole.PARTNER && branch.partnerUserId.toString() !== userId) {
      throw new ForbiddenException("Cannot update another shop's settings");
    }

    const { operatingHours, holidays, ...portalPatchRaw } = dto;

    // Strip undefined values from dto so unset optional fields don't overwrite existing settings
    const patch = Object.fromEntries(
      Object.entries(portalPatchRaw).filter(([, v]) => v !== undefined),
    ) as Partial<PartnerPortalSettings>;

    branch.portalSettings = normalizePortalSettings({
      ...branch.toObject().portalSettings,
      ...patch,
    });
    branch.markModified('portalSettings');

    if (operatingHours) {
      branch.operatingHours = operatingHours;
      branch.markModified('operatingHours');
    }

    if (holidays) {
      branch.holidays = holidays;
      branch.markModified('holidays');
    }

    await branch.save();

    return {
      success: true,
      data: {
        branch: await this.formatBranch(branch),
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
    const result = await this.cloudinaryStorageService.uploadBuffer(
      file.buffer,
      'lunara/branch-logos',
      `${branch._id.toString()}-${Date.now()}`,
      'image',
      file.mimetype,
    );
    branch.logoUrl = result.secure_url;
    await branch.save();
    await this.cloudinaryStorageService.deleteFile('lunara/branch-logos', previousLogoUrl);

    return {
      success: true,
      data: { branch: await this.formatBranch(branch) },
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
    await this.cloudinaryStorageService.deleteFile('lunara/branch-logos', previousLogoUrl);

    return {
      success: true,
      data: { branch: await this.formatBranch(branch) },
    };
  }
}
