import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DeliveryPhotoDto } from './dto/delivery.dto';
import { CapturePhotoDto, CollectLaundryDto, VerifyCustomerDto } from './dto/pickup.dto';
import { UpdateLocationDto } from './dto/rider.dto';
import { DeliveryService } from './delivery.service';
import { PickupService } from './pickup.service';
import { RidersService } from './riders.service';

@Controller('riders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RidersController {
  constructor(
    private readonly ridersService: RidersService,
    private readonly pickupService: PickupService,
    private readonly deliveryService: DeliveryService,
  ) {}

  @Get('pickup-offers')
  @Roles(UserRole.RIDER)
  getPickupOffers() {
    return this.pickupService.getPickupOffers();
  }

  @Get('pickup-tasks/:orderId')
  @Roles(UserRole.RIDER)
  getPickupTask(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.pickupService.getPickupTask(orderId, req.user.sub);
  }

  @Post('pickup-offers/:orderId/accept')
  @Roles(UserRole.RIDER)
  acceptPickup(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.pickupService.acceptPickup(orderId, req.user.sub);
  }

  @Post('pickup-tasks/:orderId/arrive')
  @Roles(UserRole.RIDER)
  markArrived(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.pickupService.markArrived(orderId, req.user.sub);
  }

  @Post('pickup-tasks/:orderId/verify')
  @Roles(UserRole.RIDER)
  verifyCustomer(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: VerifyCustomerDto,
  ) {
    return this.pickupService.verifyCustomer(orderId, req.user.sub, dto);
  }

  @Post('pickup-tasks/:orderId/collect')
  @Roles(UserRole.RIDER)
  collectLaundry(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: CollectLaundryDto,
  ) {
    return this.pickupService.collectLaundry(orderId, req.user.sub, dto);
  }

  @Post('pickup-tasks/:orderId/photo')
  @Roles(UserRole.RIDER)
  capturePhoto(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: CapturePhotoDto,
  ) {
    return this.pickupService.capturePhoto(orderId, req.user.sub, dto.photoUrl);
  }

  @Post('pickup-tasks/:orderId/generate-receipt')
  @Roles(UserRole.RIDER)
  generatePickupReceipt(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.pickupService.generatePickupReceipt(orderId, req.user.sub);
  }

  @Post('pickup-tasks/:orderId/drop-at-shop')
  @Roles(UserRole.RIDER)
  dropAtShop(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.pickupService.dropAtShop(orderId, req.user.sub);
  }

  @Post('pickup-tasks/:orderId/complete')
  @Roles(UserRole.RIDER)
  completePickup(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.pickupService.completePickup(orderId, req.user.sub);
  }

  @Get('me')
  @Roles(UserRole.RIDER)
  getMe(@Req() req: { user: { sub: string } }) {
    return this.ridersService.getMe(req.user.sub);
  }

  @Get('notifications')
  @Roles(UserRole.RIDER)
  listNotifications(@Req() req: { user: { sub: string } }) {
    return this.ridersService.listNotifications(req.user.sub);
  }

  @Get('delivery-offers')
  @Roles(UserRole.RIDER)
  getDeliveryOffers() {
    return this.deliveryService.getDeliveryOffers();
  }

  @Get('delivery-tasks/:orderId')
  @Roles(UserRole.RIDER)
  getDeliveryTask(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.deliveryService.getDeliveryTask(orderId, req.user.sub);
  }

  @Post('delivery-offers/:orderId/accept')
  @Roles(UserRole.RIDER)
  acceptDelivery(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.deliveryService.acceptDelivery(orderId, req.user.sub);
  }

  @Post('delivery-tasks/:orderId/pickup-from-shop')
  @Roles(UserRole.RIDER)
  pickupFromShop(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.deliveryService.pickupFromShop(orderId, req.user.sub);
  }

  @Post('delivery-tasks/:orderId/out-for-delivery')
  @Roles(UserRole.RIDER)
  outForDelivery(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.deliveryService.outForDelivery(orderId, req.user.sub);
  }

  @Post('delivery-tasks/:orderId/start')
  @Roles(UserRole.RIDER)
  startDelivery(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.deliveryService.startDelivery(orderId, req.user.sub);
  }

  @Post('delivery-tasks/:orderId/customer-received')
  @Roles(UserRole.RIDER)
  markCustomerReceived(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.deliveryService.markCustomerReceived(orderId, req.user.sub);
  }

  @Post('delivery-tasks/:orderId/arrive')
  @Roles(UserRole.RIDER)
  markDeliveryArrived(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.deliveryService.markArrived(orderId, req.user.sub);
  }

  @Post('delivery-tasks/:orderId/photo')
  @Roles(UserRole.RIDER)
  captureDeliveryPhoto(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: DeliveryPhotoDto,
  ) {
    return this.deliveryService.capturePhoto(orderId, req.user.sub, dto.photoUrl);
  }

  @Post('delivery-tasks/:orderId/complete')
  @Roles(UserRole.RIDER)
  completeDelivery(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.deliveryService.completeDelivery(orderId, req.user.sub);
  }

  @Get('tasks')
  @Roles(UserRole.RIDER)
  getTasks(@Req() req: { user: { sub: string } }) {
    return this.ridersService.getTasks(req.user.sub);
  }

  @Get('earnings')
  @Roles(UserRole.RIDER)
  getEarnings(@Req() req: { user: { sub: string } }) {
    return this.ridersService.getEarnings(req.user.sub);
  }

  @Patch('location')
  @Roles(UserRole.RIDER)
  updateLocation(@Req() req: { user: { sub: string } }, @Body() dto: UpdateLocationDto) {
    return this.ridersService.updateLocation(req.user.sub, dto.lat, dto.lng);
  }

  @Post('online')
  @Roles(UserRole.RIDER)
  goOnline(@Req() req: { user: { sub: string } }) {
    return this.ridersService.setOnline(req.user.sub, true);
  }

  @Post('offline')
  @Roles(UserRole.RIDER)
  goOffline(@Req() req: { user: { sub: string } }) {
    return this.ridersService.setOnline(req.user.sub, false);
  }
}
