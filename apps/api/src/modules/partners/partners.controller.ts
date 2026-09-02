import { BadRequestException, Controller, Get, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { PartnerBrandConfig } from '@lunara/types';
import { LocalStorageService } from '../../common/storage/local-storage.service';
import { partnerBrandAssetUploadOptions } from './partner-brand-upload.options';
import { PartnersService } from './partners.service';

const LOGO_PREVIEW_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

const DEFAULT_BRAND_CONFIG: PartnerBrandConfig = {
  customDomainVerified: false,
  appDisplayName: 'Lunara',
  colors: {
    primary: '#4F46E5',
    secondary: '#06B6D4',
    accent: '#22C55E',
    background: '#F8FAFC',
    foreground: '#0F172A',
    muted: '#64748B',
    border: '#E2E8F0',
    destructive: '#EF4444',
  },
  fonts: { sans: 'Inter, system-ui, sans-serif' },
  status: 'live',
};

@Controller('public/branding')
export class PartnersController {
  constructor(
    private readonly partnersService: PartnersService,
    private readonly storageService: LocalStorageService,
  ) {}

  /** Unauthenticated by design — prospective partners upload a logo to preview a branded app
   *  before they have an account. Rate-limited to bound abuse of local disk storage. */
  @Post('logo-preview')
  @Throttle(LOGO_PREVIEW_THROTTLE)
  @UseInterceptors(FileInterceptor('logo', partnerBrandAssetUploadOptions))
  async uploadLogoPreview(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Logo image is required');
    const result = await this.storageService.uploadBuffer(
      file.buffer,
      'partner-leads',
      `logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      'image',
      file.mimetype,
    );
    return { success: true, data: { logoUrl: result.secure_url } };
  }

  @Get()
  async resolveBranding(@Query('domain') domain?: string) {
    const partner = domain?.trim() ? await this.partnersService.findByDomain(domain.trim()) : null;

    if (!partner) {
      return {
        success: true,
        data: { isDefault: true, partnerId: null, brandConfig: DEFAULT_BRAND_CONFIG },
      };
    }

    return {
      success: true,
      data: {
        isDefault: false,
        partnerId: partner.ownerUserId.toString(),
        brandConfig: partner.brandConfig,
      },
    };
  }
}
