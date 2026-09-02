import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { validateBlockProps } from '@lunara/blocks';
import { UserRole, type BrandTheme } from '@lunara/types';
import { getPermissionsForRole } from '@lunara/utils';
import { getJwtRefreshSecret } from '../../common/config/jwt-config';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  PartnerAppConfig,
  PartnerAppConfigDocument,
} from './schemas/partner-app-config.schema';
import { ClaimAppConfigDto, SaveDraftDto } from './dto/app-config.dto';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'brand'
  );
}

@Injectable()
export class AppConfigsService {
  constructor(
    @InjectModel(PartnerAppConfig.name)
    private appConfigModel: Model<PartnerAppConfigDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  /** Public self-serve signup: creates a BRAND_OWNER account and the first draft config in one
   *  step, so the anonymous builder only asks for auth at the moment someone wants to save. */
  async claim(dto: ClaimAppConfigDto) {
    this.validateScreens(dto.screens);

    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.create({
      email: dto.email,
      passwordHash,
      role: UserRole.BRAND_OWNER,
      isActive: true,
      isEmailVerified: true,
    });

    const partnerId = user._id.toString();
    let slug = slugify(dto.brandName);
    if (await this.appConfigModel.findOne({ slug })) {
      slug = `${slug}-${partnerId.slice(-6)}`;
    }

    const config = await this.appConfigModel.create({
      partnerId,
      slug,
      version: 1,
      status: 'draft',
      theme: dto.theme,
      screens: dto.screens,
      navStyle: dto.navStyle ?? 'tabs',
    });

    return { user, tokens: this.issueTokens(user), config };
  }

  private issueTokens(user: UserDocument) {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      permissions: getPermissionsForRole(user.role),
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: getJwtRefreshSecret(),
      expiresIn: '30d',
    });
    return { accessToken, refreshToken, expiresIn: 7 * 24 * 60 * 60 };
  }

  private validateScreens(screens: SaveDraftDto['screens']) {
    for (const screen of screens) {
      for (const block of screen.blocks) {
        try {
          validateBlockProps(block.type, block.props);
        } catch (err) {
          throw new BadRequestException(
            `Invalid props for block "${block.id}" (${block.type}): ${(err as Error).message}`,
          );
        }
      }
    }
  }

  async getDraft(partnerId: string, slug: string, fallbackTheme: BrandTheme) {
    let draft = await this.appConfigModel.findOne({ partnerId, status: 'draft' });
    if (!draft) {
      draft = await this.appConfigModel.create({
        partnerId,
        slug,
        version: 1,
        status: 'draft',
        theme: fallbackTheme,
        screens: [],
        navStyle: 'tabs',
      });
    }
    return draft;
  }

  async saveDraft(partnerId: string, dto: SaveDraftDto) {
    this.validateScreens(dto.screens);
    const draft = await this.appConfigModel.findOneAndUpdate(
      { partnerId, status: 'draft' },
      { theme: dto.theme, screens: dto.screens, ...(dto.navStyle ? { navStyle: dto.navStyle } : {}) },
      { new: true, upsert: false },
    );
    if (!draft) throw new NotFoundException('Draft not found — call getDraft first');
    return draft;
  }

  async publish(partnerId: string) {
    const draft = await this.appConfigModel.findOne({ partnerId, status: 'draft' });
    if (!draft) throw new NotFoundException('No draft to publish');

    const latestPublished = await this.appConfigModel
      .findOne({ partnerId, status: 'published' })
      .sort({ version: -1 });
    const nextVersion = (latestPublished?.version ?? 0) + 1;

    const published = await this.appConfigModel.create({
      partnerId: draft.partnerId,
      slug: draft.slug,
      version: nextVersion,
      status: 'published',
      theme: draft.theme,
      screens: draft.screens,
      navStyle: draft.navStyle ?? 'tabs',
    });
    return published;
  }

  async getPublished(slug: string) {
    const published = await this.appConfigModel
      .findOne({ slug, status: 'published' })
      .sort({ version: -1 });
    if (!published) throw new NotFoundException('No published app config for this partner');
    return published;
  }

  async listVersions(partnerId: string) {
    return this.appConfigModel
      .find({ partnerId, status: 'published' })
      .sort({ version: -1 });
  }

  /** Republishes an old version's content as a new version — rollback is additive, never
   *  rewrites history, so `listVersions` stays a true audit trail. */
  async rollback(partnerId: string, version: number) {
    const target = await this.appConfigModel.findOne({ partnerId, status: 'published', version });
    if (!target) throw new NotFoundException(`Published version ${version} not found`);

    const latestPublished = await this.appConfigModel
      .findOne({ partnerId, status: 'published' })
      .sort({ version: -1 });
    const nextVersion = (latestPublished?.version ?? 0) + 1;

    const rolledBack = await this.appConfigModel.create({
      partnerId: target.partnerId,
      slug: target.slug,
      version: nextVersion,
      status: 'published',
      theme: target.theme,
      screens: target.screens,
      navStyle: target.navStyle ?? 'tabs',
    });

    await this.appConfigModel.findOneAndUpdate(
      { partnerId, status: 'draft' },
      { theme: target.theme, screens: target.screens, navStyle: target.navStyle ?? 'tabs' },
    );

    return rolledBack;
  }
}
