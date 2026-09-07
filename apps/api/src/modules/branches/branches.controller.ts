import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PartnersService } from '../partners/partners.service';
import { BranchesService } from './branches.service';

/** No auth — consumed by the public marketing site (service-areas section, /locations page).
 * Pass `domain` for a white-label partner's custom domain to scope to that partner's own
 * branch(es); omitted/unresolved domain falls back to the platform-wide directory (default
 * lunara.com marketing site). */
@Controller('public/branches')
export class PublicBranchesController {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly partnersService: PartnersService,
  ) {}

  @Get()
  async list(@Query('domain') domain?: string) {
    const partner = domain?.trim() ? await this.partnersService.findByDomain(domain.trim()) : null;
    return this.branchesService.listPublicBranches(partner?.ownerUserId.toString());
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.branchesService.getPublicBranchById(id);
  }
}

@Controller('branches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get('nearest')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  findNearest(
    @Req() req: { user: { sub: string } },
    @Query('addressId') addressId: string,
  ) {
    return this.branchesService.findNearestByAddressId(req.user.sub, addressId);
  }

  @Get('nearby-shops')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  findNearbyShops(
    @Req() req: { user: { sub: string } },
    @Query('addressId') addressId: string,
  ) {
    return this.branchesService.findNearbyShopsForAddressId(req.user.sub, addressId);
  }

  @Get(':id/pricing')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.PARTNER)
  getShopPricing(@Param('id') id: string) {
    return this.branchesService.getShopPricing(id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  list() {
    return this.branchesService.listBranches();
  }
}
