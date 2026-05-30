import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsNumber, Min } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WalletsService } from './wallets.service';

class TopUpDto {
  @IsNumber()
  @Min(1)
  amount!: number;
}

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('me')
  getWallet(@Req() req: { user: { sub: string } }) {
    return this.walletsService.getWallet(req.user.sub);
  }

  @Get('me/transactions')
  getTransactions(@Req() req: { user: { sub: string } }) {
    return this.walletsService.getTransactions(req.user.sub);
  }

  @Post('topup')
  topUp(@Req() req: { user: { sub: string } }, @Body() dto: TopUpDto) {
    return this.walletsService.topUp(req.user.sub, dto.amount);
  }
}
