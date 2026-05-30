import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateRefundDto } from './dto/create-refund.dto';
import { RefundsService } from './refunds.service';

@Controller('refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  create(@Req() req: { user: { sub: string } }, @Body() dto: CreateRefundDto) {
    return this.refundsService.createRequest(req.user.sub, dto);
  }

  @Get()
  @Roles(UserRole.CUSTOMER)
  listMine(@Req() req: { user: { sub: string } }) {
    return this.refundsService.listCustomerRefunds(req.user.sub);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER)
  getMine(@Req() req: { user: { sub: string } }, @Param('id') id: string) {
    return this.refundsService.getCustomerRefund(req.user.sub, id);
  }
}
