import { Controller, Get, Query } from '@nestjs/common';
import type { PartnerBrandConfig } from '@lunara/types';
import { PartnersService } from './partners.service';

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
  constructor(private readonly partnersService: PartnersService) {}

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
