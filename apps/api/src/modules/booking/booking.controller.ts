import { Body, Controller, Get, Post, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrderDocument } from '../orders/schemas/order.schema';
import { OrdersService } from '../orders/orders.service';
import { BookingService } from './booking.service';
import { BookingQuoteDto, CreateBookingOrderDto } from './dto/booking.dto';

@Controller('booking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get('config')
  @Roles(UserRole.CUSTOMER)
  async getConfig() {
    return this.bookingService.getConfig();
  }

  @Get('availability')
  @Roles(UserRole.CUSTOMER)
  getAvailability(
    @Req() req: { user: { sub: string } },
    @Query('addressId') addressId: string,
  ) {
    if (!addressId?.trim()) {
      throw new BadRequestException('Select a pickup address first');
    }
    return this.bookingService.getAvailability(req.user.sub, addressId.trim());
  }

  @Post('quote')
  @Roles(UserRole.CUSTOMER)
  quote(
    @Req() req: { user: { sub: string } },
    @Query('addressId') addressId: string,
    @Body() dto: BookingQuoteDto,
  ) {
    return this.bookingService.quote(req.user.sub, addressId, dto);
  }

  @Post('orders')
  @Roles(UserRole.CUSTOMER)
  async createOrder(
    @Req() req: { user: { sub: string } },
    @Body() dto: CreateBookingOrderDto,
  ) {
    const payload = await this.bookingService.prepareOrderPayload(req.user.sub, dto);
    const result = await this.ordersService.createFromBooking(req.user.sub, payload);
    const order = result.data as OrderDocument;
    return {
      success: true,
      data: {
        _id: order._id.toString(),
        total: order.total,
        status: order.status,
        message:
          'Booking created. Complete payment — Lunara will assign your laundry partner.',
      },
    };
  }
}
