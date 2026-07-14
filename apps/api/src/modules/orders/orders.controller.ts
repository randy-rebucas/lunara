import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DeliveryService } from '../riders/delivery.service';
import { HandoffQrService } from '../handoff/handoff-qr.service';
import { CustomerSignDeliveryDto, CustomerVerifyDeliveryDto } from './dto/delivery.dto';
import { AssignRiderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly deliveryService: DeliveryService,
    private readonly handoffQrService: HandoffQrService,
  ) {}

  @Get('queue')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  getQueue(@Query('status') status?: string) {
    return this.ordersService.getPartnerQueue(status);
  }

  @Get()
  findAll(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.ordersService.findAll(req.user, Number(page), Number(limit));
  }

  @Get(':id/handoff-qr')
  @Roles(UserRole.CUSTOMER)
  getCustomerHandoffQr(
    @Param('id') id: string,
    @Query('context') context: 'pickup' | 'delivery',
    @Req() req: { user: { sub: string } },
  ) {
    if (context !== 'pickup' && context !== 'delivery') {
      throw new BadRequestException('context must be pickup or delivery');
    }
    return this.handoffQrService.getCustomerHandoffQr(id, req.user.sub, context).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get(':id/delivery')
  @Roles(UserRole.CUSTOMER)
  getDeliveryStatus(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.deliveryService.getCustomerDeliveryStatus(id, req.user.sub);
  }

  @Post(':id/delivery/verify')
  @Roles(UserRole.CUSTOMER)
  verifyDelivery(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: CustomerVerifyDeliveryDto,
  ) {
    return this.deliveryService.customerVerify(id, req.user.sub, dto.code);
  }

  @Post(':id/delivery/sign')
  @Roles(UserRole.CUSTOMER)
  signDelivery(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: CustomerSignDeliveryDto,
  ) {
    return this.deliveryService.customerSign(id, req.user.sub, dto.signatureName);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: { user: { sub: string; role: UserRole } }) {
    return this.ordersService.findOne(id, req.user);
  }

  @Delete(':id')
  @Roles(UserRole.CUSTOMER)
  cancel(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.ordersService.cancelByCustomer(req.user.sub, id);
  }

  @Post(':id/assign-rider')
  @Roles(UserRole.ADMIN)
  assignRider(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: AssignRiderDto,
  ) {
    return this.ordersService.assignRider(id, dto.riderId, dto.type, req.user.sub);
  }

  @Patch(':id/status')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN, UserRole.RIDER)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.ordersService.updateStatus(id, dto, req.user.sub);
  }

  @Post(':id/customer-pickup')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  markCustomerPickup(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.ordersService.markCustomerPickup(id, req.user.sub);
  }

  @Post(':id/customer-pickup/complete')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  completeCustomerPickup(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.ordersService.completeCustomerPickup(id, req.user.sub);
  }
}
