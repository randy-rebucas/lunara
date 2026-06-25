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
import { RiderSosService } from '../sos/rider-sos.service';
import { ReviewRiderDocumentDto } from '../riders/dto/rider.dto';
import { CreditRiderEarningDto } from '../riders/dto/rider-earnings.dto';
import { RidersService } from '../riders/riders.service';
import { RiderNotificationService } from '../riders/rider-notification.service';
import { RiderWalletService } from '../riders/rider-wallet.service';
import { ReviewWithdrawalDto, SetWalletHoldDto } from '../riders/dto/rider-wallet.dto';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { OnboardPartnerDto } from './dto/onboard-partner.dto';
import { InitNetworkDto } from './dto/init-network.dto';
import { CreateSetupBranchDto } from './dto/create-setup-branch.dto';
import { SetShopActiveDto } from './dto/set-shop-active.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { CreateRiderDto } from './dto/create-rider.dto';
import { RiderAnnouncementDto } from './dto/rider-announcement.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { UpdateLaundryAddonDto } from './dto/update-laundry-addon.dto';
import { UpdateLaundryServiceDto } from './dto/update-laundry-service.dto';
import { CatalogService } from '../catalog/catalog.service';
import { PartnerOperationsService } from '../partner/partner-operations.service';
import { CreateSettlementDto } from '../partner/dto/create-settlement.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly catalogService: CatalogService,
    private readonly supportService: SupportService,
    private readonly refundsService: RefundsService,
    private readonly branchesService: BranchesService,
    private readonly branchManagementService: BranchManagementService,
    private readonly adminOperationsService: AdminOperationsService,
    private readonly adminDispatchService: AdminDispatchService,
    private readonly riderSosService: RiderSosService,
    private readonly ridersService: RidersService,
    private readonly riderNotificationService: RiderNotificationService,
    private readonly riderWalletService: RiderWalletService,
    private readonly partnerOperationsService: PartnerOperationsService,
  ) {}

  @Get('sos/active')
  listActiveSosIncidents() {
    return this.riderSosService.listActiveIncidents();
  }

  @Patch('sos/:id/resolve')
  resolveSosIncident(@Param('id') id: string) {
    return this.riderSosService.resolveIncident(id);
  }

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

  @Post('riders')
  createRider(@Body() dto: CreateRiderDto) {
    return this.adminService.createRider(dto);
  }

  @Get('riders/documents/pending')
  getPendingRiderDocuments() {
    return this.ridersService.listPendingDocumentReviews();
  }

  @Get('riders/withdrawals')
  listRiderWithdrawals(@Query('status') status?: string) {
    return this.riderWalletService.listWithdrawalsForAdmin(status);
  }

  @Post('riders/withdrawals/:id/approve')
  approveRiderWithdrawal(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: ReviewWithdrawalDto,
  ) {
    return this.riderWalletService.approveWithdrawal(id, req.user.sub, dto.adminNote);
  }

  @Post('riders/withdrawals/:id/reject')
  rejectRiderWithdrawal(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: ReviewWithdrawalDto,
  ) {
    return this.riderWalletService.rejectWithdrawal(id, req.user.sub, dto.adminNote);
  }

  @Get('riders/:userId/cash-remittances')
  listRiderCashRemittances(
    @Param('userId') userId: string,
    @Query('status') status?: string,
  ) {
    return this.riderWalletService.listRemittancesForAdmin(userId, status);
  }

  @Post('riders/:userId/cash-remittances/verify')
  verifyRiderCashRemittances(
    @Param('userId') userId: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: { remittanceIds?: string[] },
  ) {
    return this.riderWalletService.verifyRemittanceBatch(userId, req.user.sub, dto.remittanceIds);
  }

  @Post('riders/:userId/wallet/hold')
  setRiderWalletHold(@Param('userId') userId: string, @Body() dto: SetWalletHoldDto) {
    return this.riderWalletService.setWalletHold(userId, dto.pendingHold);
  }

  @Post('riders/:userId/earnings/credit')
  creditRiderEarning(@Param('userId') userId: string, @Body() dto: CreditRiderEarningDto) {
    return this.ridersService
      .creditManualEarning(userId, dto.type, dto.amount, dto.note)
      .then((data) => ({ success: true, data }));
  }

  @Get('riders/:userId/profile')
  getRiderProfile(@Param('userId') userId: string) {
    return this.ridersService.getRiderProfileForAdmin(userId);
  }

  @Patch('riders/:userId/documents/:type')
  reviewRiderDocument(
    @Param('userId') userId: string,
    @Param('type') type: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: ReviewRiderDocumentDto,
  ) {
    return this.ridersService.reviewDocument(
      userId,
      type,
      req.user.sub,
      dto.status,
      dto.rejectionReason,
    );
  }

  @Post('riders/announcement')
  broadcastRiderAnnouncement(@Body() dto: RiderAnnouncementDto) {
    return this.riderNotificationService
      .broadcastPlatformAnnouncement(dto.body, dto.title, dto.userIds)
      .then((count) => ({
        success: true,
        data: { sent: count },
      }));
  }

  @Get('shops')
  getShops() {
    return this.adminService.getShops();
  }

  @Patch('shops/:id')
  setShopActive(@Param('id') id: string, @Body() dto: SetShopActiveDto) {
    return this.branchManagementService.setPartnerActive(id, dto.isActive);
  }

  @Post('partners')
  createPartner(@Body() dto: CreatePartnerDto) {
    return this.adminService.createPartner(dto);
  }

  @Post('partners/onboard')
  onboardPartner(@Body() dto: OnboardPartnerDto) {
    return this.adminService.onboardPartner(dto);
  }

  @Get('partners/:partnerId/settlements')
  getPartnerSettlements(@Param('partnerId') partnerId: string) {
    return this.partnerOperationsService.getPartnerSettlementsForAdmin(partnerId);
  }

  @Post('partners/:partnerId/settlements')
  createPartnerSettlement(
    @Param('partnerId') partnerId: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: CreateSettlementDto,
  ) {
    return this.partnerOperationsService.createSettlement(req.user.sub, partnerId, dto);
  }

  @Get('setup/status')
  getSetupStatus() {
    return this.adminService.getSetupStatus();
  }

  @Post('setup/init')
  initializeNetwork(
    @Req() req: { user: { sub: string } },
    @Body() dto: InitNetworkDto,
  ) {
    return this.adminService.initializeNetwork(req.user.sub, dto);
  }

  @Post('setup/branch')
  createSetupBranch(
    @Req() req: { user: { sub: string } },
    @Body() dto: CreateSetupBranchDto,
  ) {
    return this.adminService.createSetupBranch(req.user.sub, dto);
  }

  @Get('branches/parents')
  getParentBranches() {
    return this.branchesService.listParentBranches();
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

  @Get('services')
  getServices() {
    return this.catalogService.listAllServices().then((data) => ({ success: true, data }));
  }

  @Patch('services/:id')
  updateService(@Param('id') id: string, @Body() dto: UpdateLaundryServiceDto) {
    return this.catalogService.updateService(id, dto);
  }

  @Get('addons')
  getAddons() {
    return this.catalogService.listAllAddons().then((data) => ({ success: true, data }));
  }

  @Patch('addons/:id')
  updateAddon(@Param('id') id: string, @Body() dto: UpdateLaundryAddonDto) {
    return this.catalogService.updateAddon(id, dto);
  }
}
