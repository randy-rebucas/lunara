import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { PartnerBrandConfig } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { PartnersService } from './partners.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

export const DEFAULT_BRAND_CONFIG: PartnerBrandConfig = {
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

@Controller('partner/branding')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class PartnerBrandingController {
  constructor(private readonly partnersService: PartnersService) {}

  /**
   * Authenticated equivalent of GET /public/branding for a logged-in partner-web session.
   * tenantId is undefined for ADMIN — no brand doc to resolve, so default branding is returned.
   */
  @Get('me')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  async getMyBranding(@CurrentTenantId() tenantId?: string) {
    const partner = tenantId ? await this.partnersService.findByOwnerUserId(tenantId) : null;

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
