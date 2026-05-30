import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PickupService } from '../riders/pickup.service';
import { AssignStaffDto } from './dto/assign-staff.dto';
import { AdvanceProcessingDto } from './dto/processing.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { PartnerOperationsService } from './partner-operations.service';
import { ProcessingService } from './processing.service';
import { ShopReceivingService } from './shop-receiving.service';
import {
  ConfirmShopItemsDto,
  ReceiveLaundryDto,
  VerifyShopWeightDto,
} from './dto/shop-receiving.dto';

@Controller('partner')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnerController {
  constructor(
    private readonly processingService: ProcessingService,
    private readonly operationsService: PartnerOperationsService,
    private readonly shopReceivingService: ShopReceivingService,
    private readonly pickupService: PickupService,
  ) {}

  @Get('dashboard')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  getDashboard() {
    return this.operationsService.getDashboard();
  }

  @Get('orders/incoming')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  getIncoming(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.operationsService.getIncomingOrders(req.user.sub, req.user.role);
  }

  @Post('orders/:orderId/accept')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  acceptOrder(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
  ) {
    return this.operationsService.acceptPartnerOrder(orderId, req.user.sub, req.user.role);
  }

  @Post('orders/:orderId/request-pickup')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async requestPickup(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
  ) {
    const res = await this.operationsService.requestPickup(orderId, req.user.sub, req.user.role);
    await this.pickupService.dispatchPickupSearch(orderId);
    return res;
  }

  @Post('orders/:orderId/request-delivery')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  async requestDelivery(@Param('orderId') orderId: string, @Req() req: { user: { sub: string; role: UserRole } }) {
    await this.operationsService.requestDelivery(orderId, req.user.sub, req.user.role);
    return this.operationsService.notifyDeliveryDispatch(orderId);
  }

  @Get('orders/progress')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  getProgress() {
    return this.operationsService.getProgressMonitor();
  }

  @Get('staff')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  listStaff() {
    return this.operationsService.listStaff();
  }

  @Post('orders/:orderId/assign-staff')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  assignStaff(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: AssignStaffDto,
  ) {
    return this.operationsService.assignStaff(orderId, dto.staffId, req.user.sub);
  }

  @Get('inventory')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  getInventory() {
    return this.operationsService.getInventory();
  }

  @Patch('inventory/:id')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  updateInventory(@Param('id') id: string, @Body() dto: UpdateInventoryDto) {
    return this.operationsService.updateInventory(id, dto);
  }

  @Get('reports')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  getReports(@Query('days') days = '7') {
    return this.operationsService.getReports(Number(days) || 7);
  }

  @Get('revenue')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  getRevenue() {
    return this.operationsService.getRevenue();
  }

  @Get('orders/:orderId/receiving')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  getReceiving(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
  ) {
    return this.shopReceivingService.getReceiving(orderId, req.user.sub, req.user.role);
  }

  @Post('orders/:orderId/receiving/receive')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  receiveLaundry(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Body() dto: ReceiveLaundryDto,
  ) {
    return this.shopReceivingService.receiveLaundry(orderId, req.user.sub, req.user.role, dto);
  }

  @Post('orders/:orderId/receiving/verify-weight')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  verifyShopWeight(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Body() dto: VerifyShopWeightDto,
  ) {
    return this.shopReceivingService.verifyWeight(orderId, req.user.sub, req.user.role, dto);
  }

  @Post('orders/:orderId/receiving/confirm-items')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  confirmShopItems(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Body() dto: ConfirmShopItemsDto,
  ) {
    return this.shopReceivingService.confirmItems(orderId, req.user.sub, req.user.role, dto);
  }

  @Get('processing/config')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  getConfig() {
    return this.processingService.getConfig();
  }

  @Get('orders/queue')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  getQueue(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Query('mine') mine?: string,
  ) {
    return this.processingService.getQueue(
      req.user.sub,
      mine === '1' || mine === 'true',
      req.user.sub,
      req.user.role,
    );
  }

  @Post('orders/:orderId/processing/accept')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  acceptJob(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
  ) {
    return this.processingService.acceptJob(orderId, req.user.sub, req.user.role);
  }

  @Get('orders/:orderId/processing')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  getProcessing(@Param('orderId') orderId: string) {
    return this.processingService.getOrderProcessing(orderId);
  }

  @Post('orders/:orderId/processing/advance')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  advance(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Body() dto: AdvanceProcessingDto,
  ) {
    return this.processingService.advance(orderId, req.user.sub, req.user.role, dto);
  }

  @Post('orders/:orderId/delivery/dispatch')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  dispatchDelivery(@Param('orderId') orderId: string) {
    return this.operationsService.notifyDeliveryDispatch(orderId);
  }
}
