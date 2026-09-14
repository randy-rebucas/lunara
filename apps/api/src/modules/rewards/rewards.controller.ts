import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RewardsService } from './rewards.service';

class RedeemRewardDto {
  @IsString()
  partnerId!: string;

  @IsString()
  catalogItemId!: string;
}

@Controller('rewards')
@UseGuards(JwtAuthGuard)
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  /** Every shop this customer has point activity with, plus their platform-wide referral
   * balance — there's no single global balance any more now that points are earned per-shop. */
  @Get('me')
  getBalances(@Req() req: { user: { sub: string } }) {
    return this.rewardsService.listMyBalances(req.user.sub);
  }

  @Get('me/transactions')
  getTransactions(@Req() req: { user: { sub: string } }, @Query('partnerId') partnerId?: string) {
    return this.rewardsService.getTransactions(req.user.sub, partnerId);
  }

  @Get('catalog')
  getCatalog(@Query('partnerId') partnerId?: string) {
    if (!partnerId) throw new BadRequestException('partnerId is required');
    return this.rewardsService.getCatalogForPartner(partnerId);
  }

  @Post('redeem')
  redeem(@Req() req: { user: { sub: string } }, @Body() dto: RedeemRewardDto) {
    return this.rewardsService.redeem(req.user.sub, dto.partnerId, dto.catalogItemId);
  }

  @Get('me/referral-code')
  getReferralCode(@Req() req: { user: { sub: string } }) {
    return this.rewardsService.getOrCreateReferralCode(req.user.sub);
  }

  @Get('me/referral-stats')
  getReferralStats(@Req() req: { user: { sub: string } }) {
    return this.rewardsService.getReferralStats(req.user.sub);
  }
}
