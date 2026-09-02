import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@lunara/types';
import type { BrandTheme } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AppConfigsService } from './app-configs.service';
import { ClaimAppConfigDto, SaveDraftDto } from './dto/app-config.dto';

const APP_CONFIG_FETCH_THROTTLE = { default: { limit: 60, ttl: 60_000 } };
const CLAIM_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

const DEFAULT_THEME: BrandTheme = {
  primary: '#2563eb',
  secondary: '#1e40af',
  accent: '#3b82f6',
  background: '#ffffff',
  foreground: '#0f172a',
  muted: '#f1f5f9',
  border: '#e2e8f0',
  destructive: '#ef4444',
};

/** Unauthenticated by design — apps/app-renderer fetches this at runtime by slug, same
 *  pattern as public/leads. */
@Controller('public/app-configs')
export class PublicAppConfigsController {
  constructor(private readonly appConfigsService: AppConfigsService) {}

  @Get(':slug')
  @Throttle(APP_CONFIG_FETCH_THROTTLE)
  async getPublished(@Param('slug') slug: string) {
    const config = await this.appConfigsService.getPublished(slug);
    return { success: true, data: config };
  }

  /** Turns an anonymous builder session into an account — the only point the public builder
   *  asks for auth. Creates a BRAND_OWNER account + the first draft in one step. */
  @Post('claim')
  @Throttle(CLAIM_THROTTLE)
  async claim(@Body() dto: ClaimAppConfigDto) {
    const { user, tokens, config } = await this.appConfigsService.claim(dto);
    return {
      success: true,
      data: {
        user: { id: user._id.toString(), email: user.email, role: user.role },
        tokens,
        config,
      },
    };
  }
}

@Controller('admin/app-configs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminAppConfigsController {
  constructor(private readonly appConfigsService: AppConfigsService) {}

  @Get(':partnerId/draft')
  async getDraft(@Param('partnerId') partnerId: string, @Query('slug') slug: string) {
    const draft = await this.appConfigsService.getDraft(partnerId, slug, DEFAULT_THEME);
    return { success: true, data: draft };
  }

  @Patch(':partnerId/draft')
  async saveDraft(@Param('partnerId') partnerId: string, @Body() dto: SaveDraftDto) {
    const draft = await this.appConfigsService.saveDraft(partnerId, dto);
    return { success: true, data: draft };
  }

  @Post(':partnerId/publish')
  async publish(@Param('partnerId') partnerId: string) {
    const published = await this.appConfigsService.publish(partnerId);
    return { success: true, data: published };
  }

  @Get(':partnerId/versions')
  async listVersions(@Param('partnerId') partnerId: string) {
    const versions = await this.appConfigsService.listVersions(partnerId);
    return { success: true, data: versions };
  }

  @Post(':partnerId/versions/:version/rollback')
  async rollback(
    @Param('partnerId') partnerId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    const rolledBack = await this.appConfigsService.rollback(partnerId, version);
    return { success: true, data: rolledBack };
  }
}

/** Self-service mirror of AdminAppConfigsController, scoped to the authenticated brand owner's
 *  own config (partnerId taken from the JWT, never from the URL — no cross-account access). */
@Controller('partner/app-configs/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BRAND_OWNER)
export class MyAppConfigsController {
  constructor(private readonly appConfigsService: AppConfigsService) {}

  @Get('draft')
  async getDraft(@Req() req: { user: { sub: string } }) {
    const draft = await this.appConfigsService.getDraft(req.user.sub, req.user.sub, DEFAULT_THEME);
    return { success: true, data: draft };
  }

  @Patch('draft')
  async saveDraft(@Req() req: { user: { sub: string } }, @Body() dto: SaveDraftDto) {
    const draft = await this.appConfigsService.saveDraft(req.user.sub, dto);
    return { success: true, data: draft };
  }

  @Post('publish')
  async publish(@Req() req: { user: { sub: string } }) {
    const published = await this.appConfigsService.publish(req.user.sub);
    return { success: true, data: published };
  }

  @Get('versions')
  async listVersions(@Req() req: { user: { sub: string } }) {
    const versions = await this.appConfigsService.listVersions(req.user.sub);
    return { success: true, data: versions };
  }

  @Post('versions/:version/rollback')
  async rollback(
    @Req() req: { user: { sub: string } },
    @Param('version', ParseIntPipe) version: number,
  ) {
    const rolledBack = await this.appConfigsService.rollback(req.user.sub, version);
    return { success: true, data: rolledBack };
  }
}
