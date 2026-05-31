import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateLostItemDto } from './dto/create-lost-item.dto';
import { CreateAreaRequestDto } from './dto/create-area-request.dto';
import { SupportService } from './support.service';

@Controller('support')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('lost-items')
  @Roles(UserRole.CUSTOMER)
  reportLostItem(
    @Req() req: { user: { sub: string } },
    @Body() dto: CreateLostItemDto,
  ) {
    return this.supportService.createLostItemComplaint(req.user.sub, dto);
  }

  @Post('area-requests')
  @Roles(UserRole.CUSTOMER)
  requestAreaCoverage(
    @Req() req: { user: { sub: string } },
    @Body() dto: CreateAreaRequestDto,
  ) {
    return this.supportService.createAreaCoverageRequest(req.user.sub, dto);
  }

  @Get('tickets')
  @Roles(UserRole.CUSTOMER)
  listMyTickets(@Req() req: { user: { sub: string } }) {
    return this.supportService.listCustomerTickets(req.user.sub);
  }

  @Get('tickets/:id')
  @Roles(UserRole.CUSTOMER)
  getMyTicket(@Req() req: { user: { sub: string } }, @Param('id') id: string) {
    return this.supportService.getCustomerTicket(req.user.sub, id);
  }
}
