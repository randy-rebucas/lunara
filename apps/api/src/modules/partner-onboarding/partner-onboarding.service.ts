import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { UserRole } from '@lunara/types';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { BranchManagementService } from '../branches/branch-management.service';
import { PartnersService } from '../partners/partners.service';
import { LocalStorageService } from '../../common/storage/local-storage.service';
import { EmailService } from '../../common/email/email.service';
import { RecaptchaService } from '../../common/recaptcha/recaptcha.service';
import { OtpService } from '../auth/otp.service';
import { generateTempPassword } from '../../common/utils/generate-password';
import { PartnerSignupDto } from './dto/partner-signup.dto';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

function randomSuffix(): string {
  return randomBytes(3).toString('hex');
}

@Injectable()
export class PartnerOnboardingService {
  private readonly logger = new Logger(PartnerOnboardingService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    private readonly branchManagementService: BranchManagementService,
    private readonly partnersService: PartnersService,
    private readonly storageService: LocalStorageService,
    private readonly emailService: EmailService,
    private readonly recaptchaService: RecaptchaService,
    private readonly otpService: OtpService,
  ) {}

  async signup(dto: PartnerSignupDto, logo?: Express.Multer.File) {
    await this.recaptchaService.assertHuman(dto.recaptchaToken, 'partner_signup');

    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone.trim();

    const existing = await this.userModel.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      throw new ConflictException('A user with this email or phone already exists');
    }

    const password = generateTempPassword();
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.userModel.create({
      email,
      phone,
      passwordHash,
      role: UserRole.PARTNER,
      isActive: true,
      isEmailVerified: false,
    });

    const branch = await this.createShopBranch(user._id.toString(), dto);

    if (dto.wantsBranding && logo) {
      await this.provisionBranding(user._id.toString(), dto.businessName, logo);
    }

    await this.emailService.sendPartnerInvite(email, password);
    await this.sendVerificationEmail(user);

    this.logger.log(`New self-serve partner signup: ${email} (branch ${branch.data.branchId})`);
    return { email };
  }

  /** Every branch lives under the shared network root — see BranchManagementService.createBranch;
   * the wizard's user never supplies or sees this, matching how admin-triggered onboarding works. */
  private async createShopBranch(partnerUserId: string, dto: PartnerSignupDto) {
    await this.branchManagementService.ensureNetworkStructure();
    const hq = await this.branchModel.findOne({ branchType: 'hq' }).select('_id');
    if (!hq) {
      throw new Error('Network root (hq branch) could not be established');
    }

    const baseSlug = slugify(dto.businessName) || 'shop';
    let code = `${baseSlug}-${randomSuffix()}`.toUpperCase();
    for (let attempt = 0; attempt < 5; attempt++) {
      const collision = await this.branchModel.exists({ code });
      if (!collision) break;
      code = `${baseSlug}-${randomSuffix()}`.toUpperCase();
    }

    return this.branchManagementService.createBranch({
      code,
      name: dto.businessName,
      branchType: 'partner_shop',
      parentBranchId: hq._id.toString(),
      partnerUserId,
      line1: dto.address.line1,
      city: dto.address.city,
      province: dto.address.province,
      postalCode: dto.address.postalCode,
      coordinates: dto.address.coordinates ?? [0, 0],
    });
  }

  private async provisionBranding(ownerUserId: string, businessName: string, logo: Express.Multer.File) {
    const baseSlug = slugify(businessName) || 'partner';
    let slug = `${baseSlug}-${randomSuffix()}`;

    let partner;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const created = await this.partnersService.create(ownerUserId, businessName, slug);
        partner = created.data;
        break;
      } catch {
        slug = `${baseSlug}-${randomSuffix()}`;
      }
    }
    if (!partner) {
      this.logger.warn(`Could not provision a Partner brand doc for ${ownerUserId} after retries`);
      return;
    }

    const uploaded = await this.storageService.uploadBuffer(
      logo.buffer,
      'lunara/partner-brands',
      `${partner._id.toString()}-logo-${Date.now()}`,
      'image',
      logo.mimetype,
    );
    await this.partnersService.setAssetUrl(partner._id.toString(), 'logoUrl', uploaded.secure_url);
  }

  /** Mirrors AuthService's private sendVerificationEmail — same token mechanism, so this account
   * is subject to the same isEmailVerified login gate with no changes needed there. */
  private async sendVerificationEmail(user: UserDocument) {
    if (!user.email) return;
    const token = randomBytes(32).toString('hex');
    await this.otpService.storeEmailVerificationToken(token, user._id.toString());
    const baseUrl = process.env.PARTNER_WEB_URL ?? 'http://localhost:3003';
    const link = `${baseUrl}/verify-email?token=${token}`;
    await this.emailService.sendEmailVerification(user.email, link);
  }
}
