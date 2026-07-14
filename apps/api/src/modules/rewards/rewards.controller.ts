import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RewardsService } from './rewards.service';

class RedeemRewardDto {
  @IsString()
  catalogItemId!: string;
}

@Controller('rewards')
@UseGuards(JwtAuthGuard)
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('me')
  getBalance(@Req() req: { user: { sub: string } }) {
    return this.rewardsService.getBalanceAndHistory(req.user.sub);
  }

  @Get('me/transactions')
  async getTransactions(@Req() req: { user: { sub: string } }) {
    const { data } = await this.rewardsService.getBalanceAndHistory(req.user.sub);
    return { success: true, data: data.transactions };
  }

  @Get('catalog')
  getCatalog() {
    return this.rewardsService.getCatalog();
  }

  @Post('redeem')
  redeem(@Req() req: { user: { sub: string } }, @Body() dto: RedeemRewardDto) {
    return this.rewardsService.redeem(req.user.sub, dto.catalogItemId);
  }

  @Get('me/referral-code')
  getReferralCode(@Req() req: { user: { sub: string } }) {
    return this.rewardsService.getOrCreateReferralCode(req.user.sub);
  }
}
