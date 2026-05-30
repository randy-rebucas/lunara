import {
  BadRequestException,
  Body,
  Controller,
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
import { InvestigateTicketDto } from '../support/dto/investigate-ticket.dto';
import { UpdateTicketDto } from '../support/dto/update-ticket.dto';
import { BranchManagementService } from '../branches/branch-management.service';
import { BranchesService } from '../branches/branches.service';
import { CreateBranchDto } from '../branches/dto/create-branch.dto';
import { UpdateBranchDto } from '../branches/dto/update-branch.dto';
import { RefundsService } from '../refunds/refunds.service';
import { ReviewRefundDto } from '../refunds/dto/review-refund.dto';
import { SupportService } from '../support/support.service';
import { AdminService } from './admin.service';
import { AssignDispatchDto } from '../branches/dto/assign-dispatch.dto';
import { AdminAssignRiderDto, ResolveConflictDto } from './dto/admin-operations.dto';
import { AdminOperationsService } from './admin-operations.service';
import { AdminDispatchService } from './admin-dispatch.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly supportService: SupportService,
    private readonly refundsService: RefundsService,
    private readonly branchesService: BranchesService,
    private readonly branchManagementService: BranchManagementService,
    private readonly adminOperationsService: AdminOperationsService,
    private readonly adminDispatchService: AdminDispatchService,
  ) {}

  @Get('control-tower')
  getControlTower() {
    return this.adminOperationsService.getControlTower();
  }

  @Get('operations/orders/:orderId')
  getOrderOperations(@Param('orderId') orderId: string) {
    return this.adminOperationsService.getOrderOperations(orderId);
  }

  @Get('operations/orders/:orderId/suggest-pickup-rider')
  suggestPickupRider(@Param('orderId') orderId: string) {
    return this.adminOperationsService.suggestPickupRider(orderId);
  }

  @Post('operations/orders/:orderId/confirm-pickup-rider')
  confirmPickupRider(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: AdminAssignRiderDto,
  ) {
    return this.adminOperationsService.confirmPickupRider(
      orderId,
      req.user.sub,
      dto.riderId,
    );
  }

  @Post('operations/orders/:orderId/assign-rider')
  assignRider(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: AdminAssignRiderDto,
  ) {
    if (!dto.riderId) {
      throw new BadRequestException('riderId is required for direct assignment');
    }
    return this.adminOperationsService.assignRider(
      orderId,
      dto.riderId,
      req.user.sub,
      dto.type ?? 'pickup',
    );
  }

  @Post('operations/orders/:orderId/dispatch-pickup')
  dispatchPickup(@Param('orderId') orderId: string) {
    return this.adminOperationsService.triggerPickupDispatch(orderId);
  }

  @Get('operations/orders/:orderId/suggest-delivery-rider')
  suggestDeliveryRider(@Param('orderId') orderId: string) {
    return this.adminOperationsService.suggestDeliveryRider(orderId);
  }

  @Post('operations/orders/:orderId/confirm-delivery-rider')
  confirmDeliveryRider(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: AdminAssignRiderDto,
  ) {
    return this.adminOperationsService.confirmDeliveryRider(
      orderId,
      req.user.sub,
      dto.riderId,
    );
  }

  @Post('operations/orders/:orderId/flag-conflict')
  flagConflict(@Param('orderId') orderId: string, @Body() body: { note: string }) {
    return this.adminOperationsService.flagConflict(orderId, body.note);
  }

  @Post('operations/orders/:orderId/resolve-conflict')
  resolveConflict(@Param('orderId') orderId: string, @Body() dto: ResolveConflictDto) {
    return this.adminOperationsService.resolveConflict(orderId, dto.resolution);
  }

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('orders')
  getOrders(@Query('status') status?: string, @Query('limit') limit?: string) {
    return this.adminService.getOrders(status, Number(limit) || 50);
  }

  @Get('riders')
  getRiders() {
    return this.adminService.getRiders();
  }

  @Get('shops')
  getShops() {
    return this.adminService.getShops();
  }

  @Get('branches')
  getBranches() {
    return this.branchesService.listBranches();
  }

  @Get('branches/network')
  getBranchNetwork() {
    return this.branchManagementService.getNetworkTree();
  }

  @Get('branches/:id/profile')
  getBranchProfile(@Param('id') id: string) {
    return this.branchManagementService.getBranchProfile(id);
  }

  @Post('branches')
  createBranch(@Body() dto: CreateBranchDto) {
    return this.branchManagementService.createBranch(dto);
  }

  @Patch('branches/:id')
  updateBranch(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchManagementService.updateBranch(id, dto);
  }

  @Get('dispatch/dashboard')
  getDispatchDashboard() {
    return this.adminDispatchService.getDispatchDashboard();
  }

  @Get('dispatch/queue')
  getDispatchQueue() {
    return this.branchesService.getDispatchQueue();
  }

  @Get('dispatch/orders/:orderId/suggestions')
  getDispatchSuggestions(@Param('orderId') orderId: string) {
    return this.branchesService.getDispatchSuggestions(orderId);
  }

  @Post('dispatch/orders/:orderId/assign')
  assignDispatch(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: AssignDispatchDto,
  ) {
    return this.branchesService.adminDispatchOrder(orderId, dto.branchId, req.user.sub);
  }

  @Get('revenue')
  getRevenue() {
    return this.adminService.getRevenue();
  }

  @Get('tickets')
  getTickets(@Query('status') status?: string, @Query('type') type?: string) {
    return this.supportService.getTickets(status, type);
  }

  @Get('tickets/:id')
  getTicket(@Param('id') id: string) {
    return this.supportService.getTicket(id);
  }

  @Get('tickets/:id/investigation')
  getInvestigation(@Param('id') id: string) {
    return this.supportService.getInvestigation(id);
  }

  @Post('tickets/:id/investigate')
  investigate(@Param('id') id: string, @Body() dto: InvestigateTicketDto) {
    return this.supportService.advanceInvestigation(id, dto);
  }

  @Patch('tickets/:id')
  updateTicket(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.supportService.updateTicket(id, dto);
  }

  @Get('refunds')
  listRefunds(@Query('status') status?: string) {
    return this.refundsService.listAdminRefunds(status);
  }

  @Get('refunds/:id')
  getRefund(@Param('id') id: string) {
    return this.refundsService.getAdminRefund(id);
  }

  @Post('refunds/:id/review')
  reviewRefund(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: ReviewRefundDto,
  ) {
    return this.refundsService.reviewRefund(id, req.user.sub, dto);
  }

  @Get('reports')
  getReports(@Query('days') days = '7') {
    return this.adminService.getReports(Number(days) || 7);
  }

  @Get('promotions')
  getPromotions() {
    return this.adminService.getPromotions();
  }

  @Post('promotions')
  createPromotion(@Body() dto: CreatePromotionDto) {
    return this.adminService.createPromotion(dto);
  }

  @Patch('promotions/:id')
  updatePromotion(@Param('id') id: string, @Body() dto: UpdatePromotionDto) {
    return this.adminService.updatePromotion(id, dto);
  }
}
