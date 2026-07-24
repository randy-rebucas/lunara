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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
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
import { UpdateBranchPricingDto } from '../branches/dto/update-branch-pricing.dto';
import { UpdateBranchAddonPricingDto } from '../branches/dto/update-branch-addon-pricing.dto';
import { UpdateBranchAssignedRiderDto } from '../branches/dto/update-branch-assigned-rider.dto';
import { UpdateBranchCustomServiceDto } from '../branches/dto/update-branch-custom-service.dto';
import { UpdateBranchCustomAddonDto } from '../branches/dto/update-branch-custom-addon.dto';
import { RefundsService } from '../refunds/refunds.service';
import { ReviewRefundDto } from '../refunds/dto/review-refund.dto';
import { SupportService } from '../support/support.service';
import { AdminService } from './admin.service';
import { AssignDispatchDto } from '../branches/dto/assign-dispatch.dto';
import { AdminAssignRiderDto, ResolveConflictDto } from './dto/admin-operations.dto';
import { AdminOperationsService } from './admin-operations.service';
import { AdminDispatchService } from './admin-dispatch.service';
import { RiderSosService } from '../sos/rider-sos.service';
import { ReviewRiderDocumentDto, UpdateRiderEmploymentDto } from '../riders/dto/rider.dto';
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
import { UpdatePartnerProfileDto } from './dto/update-partner-profile.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { CreateRiderDto } from './dto/create-rider.dto';
import { RiderAnnouncementDto } from './dto/rider-announcement.dto';
import { BroadcastDto } from './dto/broadcast.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { UpdateLaundryAddonDto } from './dto/update-laundry-addon.dto';
import { UpdateLaundryServiceDto } from './dto/update-laundry-service.dto';
import { CatalogService } from '../catalog/catalog.service';
import { CloudinaryStorageService } from '../../common/storage/cloudinary-storage.service';
import { PartnerOperationsService } from '../partner/partner-operations.service';
import { CreateSettlementDto } from '../partner/dto/create-settlement.dto';
import { PushNotificationService } from '../push/push-notification.service';
import { ServiceAreasService } from '../service-areas/service-areas.service';
import { CreateServiceAreaDto, UpdateServiceAreaDto } from '../service-areas/dto/service-area.dto';

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
    private readonly cloudinaryStorageService: CloudinaryStorageService,
    private readonly pushService: PushNotificationService,
    private readonly serviceAreasService: ServiceAreasService,
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

  @Post('operations/orders/:orderId/reassign-rider')
  reassignRider(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: AdminAssignRiderDto,
  ) {
    if (!dto.riderId) {
      throw new BadRequestException('riderId is required for reassignment');
    }
    return this.adminOperationsService.reassignRider(
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

  @Get('live-tracking')
  getLiveTracking() {
    return this.adminService.getLiveTracking();
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

  @Patch('riders/:userId/employment')
  updateRiderEmployment(
    @Param('userId') userId: string,
    @Body() dto: UpdateRiderEmploymentDto,
  ) {
    return this.ridersService.updateEmployment(userId, dto);
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

  @Get('shops/:id/detail')
  getShopDetail(@Param('id') id: string) {
    return this.adminService.getShopDetail(id);
  }

  @Patch('shops/:id')
  setShopActive(@Param('id') id: string, @Body() dto: SetShopActiveDto) {
    return this.branchManagementService.setPartnerActive(id, dto.isActive);
  }

  @Patch('shops/:id/profile')
  updatePartnerProfile(@Param('id') id: string, @Body() dto: UpdatePartnerProfileDto) {
    return this.adminService.updatePartnerProfile(id, dto);
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

  @Get('partners/:partnerId/unsettled-orders')
  getUnsettledOrders(@Param('partnerId') partnerId: string) {
    return this.partnerOperationsService.getUnsettledOrders(partnerId);
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

  @Patch('branches/:id/main-shop')
  promoteToMainShop(@Param('id') id: string) {
    return this.branchManagementService.promoteToMainShop(id);
  }

  @Patch('branches/:id/pricing')
  updateBranchPricing(@Param('id') id: string, @Body() dto: UpdateBranchPricingDto) {
    return this.branchesService.updateServicePricing(id, dto.servicePricing);
  }

  @Patch('branches/:id/addon-pricing')
  updateBranchAddonPricing(@Param('id') id: string, @Body() dto: UpdateBranchAddonPricingDto) {
    return this.branchesService.updateAddonPricing(id, dto.addonPricing);
  }

  @Patch('branches/:id/assigned-rider')
  updateBranchAssignedRider(@Param('id') id: string, @Body() dto: UpdateBranchAssignedRiderDto) {
    return this.branchesService.setAssignedRider(id, dto.riderId);
  }

  @Post('branches/:id/logo')
  @UseInterceptors(FileInterceptor('logo', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
      if (!allowed.has(file.mimetype)) {
        cb(new BadRequestException('Only JPEG, PNG, or WebP images are allowed'), false);
        return;
      }
      cb(null, true);
    },
  }))
  async updateBranchLogo(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Logo image is required');
    return this.branchesService.setBranchLogo(id, file);
  }

  @Delete('branches/:id/logo')
  removeBranchLogo(@Param('id') id: string) {
    return this.branchesService.clearBranchLogo(id);
  }

  @Get('branches/:id/custom-services')
  listBranchCustomServices(@Param('id') id: string) {
    return this.branchesService.listCustomServicesForBranch(id);
  }

  @Patch('branches/:id/custom-services/:serviceId')
  updateBranchCustomService(
    @Param('id') id: string,
    @Param('serviceId') serviceId: string,
    @Body() dto: UpdateBranchCustomServiceDto,
  ) {
    return this.branchesService.updateCustomService(id, serviceId, dto);
  }

  @Get('branches/:id/custom-addons')
  listBranchCustomAddons(@Param('id') id: string) {
    return this.branchesService.listCustomAddonsForBranch(id);
  }

  @Patch('branches/:id/custom-addons/:addonId')
  updateBranchCustomAddon(
    @Param('id') id: string,
    @Param('addonId') addonId: string,
    @Body() dto: UpdateBranchCustomAddonDto,
  ) {
    return this.branchesService.updateCustomAddon(id, addonId, dto);
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

  @Get('service-areas')
  getServiceAreas() {
    return this.serviceAreasService.listAll().then((data) => ({ success: true, data }));
  }

  @Post('service-areas')
  createServiceArea(@Body() dto: CreateServiceAreaDto) {
    return this.serviceAreasService.create(dto).then((data) => ({ success: true, data }));
  }

  @Patch('service-areas/:id')
  updateServiceArea(@Param('id') id: string, @Body() dto: UpdateServiceAreaDto) {
    return this.serviceAreasService.update(id, dto).then((data) => ({ success: true, data }));
  }

  @Delete('service-areas/:id')
  deleteServiceArea(@Param('id') id: string) {
    return this.serviceAreasService.delete(id);
  }

  @Post('broadcast')
  async broadcast(
    @Body() dto: BroadcastDto,
    @Req() req: { user: { sub: string } },
  ) {
    const audience = dto.audience ?? 'all';
    const sent =
      audience === 'all'
        ? await this.pushService.broadcastToAll({ title: dto.title, body: dto.body })
        : await this.pushService.broadcastToRole(audience, { title: dto.title, body: dto.body });
    await this.pushService.recordBroadcast({
      title: dto.title,
      body: dto.body,
      audience,
      sentCount: sent,
      createdBy: req.user.sub,
    });
    return { success: true, sent };
  }

  @Get('broadcast/audience-counts')
  async getBroadcastAudienceCounts() {
    const data = await this.pushService.getAudienceDeviceCounts();
    return { success: true, data };
  }

  @Get('broadcast/history')
  async getBroadcastHistory() {
    const items = await this.pushService.listBroadcasts();
    return {
      success: true,
      data: items.map((item) => ({
        id: item._id.toString(),
        title: item.title,
        body: item.body,
        audience: item.audience,
        sentCount: item.sentCount,
        createdByName: item.createdByName,
        createdAt: item.createdAt,
      })),
    };
  }

  @Post('addons/:id/image')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, ok: boolean) => void,
    ) => {
      // SVG intentionally excluded: it can embed <script>/event-handler payloads.
      const allowed = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
      if (!allowed.has(file.mimetype)) {
        cb(new BadRequestException('Only JPEG, PNG, or WebP images are allowed'), false);
        return;
      }
      cb(null, true);
    },
  }))
  async uploadAddonImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const previousImageUrl = (await this.catalogService.getAddonById(id))?.imageUrl;
    const result = await this.cloudinaryStorageService.uploadBuffer(
      file.buffer,
      'lunara/catalog-addons',
      `addon-${id}`,
      'image',
      file.mimetype,
    );
    const data = await this.catalogService.updateAddon(id, { imageUrl: result.secure_url });
    if (previousImageUrl && previousImageUrl !== result.secure_url) {
      await this.cloudinaryStorageService.deleteFile('lunara/catalog-addons', previousImageUrl);
    }
    return { success: true, data };
  }
}
