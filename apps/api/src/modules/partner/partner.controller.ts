import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { OrderStatus, UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CloudinaryStorageService } from '../../common/storage/cloudinary-storage.service';
import { taskPhotoPublicPath } from '../../common/uploads/upload-paths';
import { Types } from 'mongoose';
import { PickupService } from '../riders/pickup.service';
import { LaundryService, LaundryServiceDocument } from '../catalog/schemas/laundry-service.schema';
import { LaundryAddon, LaundryAddonDocument } from '../catalog/schemas/laundry-addon.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { BranchesService } from '../branches/branches.service';
import { UpdateBranchPricingDto, UpdateBranchPricingModeDto } from '../branches/dto/update-branch-pricing.dto';
import { UpdateBranchAddonPricingDto } from '../branches/dto/update-branch-addon-pricing.dto';
import { CreateBranchCustomServiceDto } from '../branches/dto/create-branch-custom-service.dto';
import { UpdateBranchCustomServiceDto } from '../branches/dto/update-branch-custom-service.dto';
import { CreateBranchCustomAddonDto } from '../branches/dto/create-branch-custom-addon.dto';
import { UpdateBranchCustomAddonDto } from '../branches/dto/update-branch-custom-addon.dto';
import { UpdateBranchHiddenCatalogDto } from '../branches/dto/update-branch-hidden-catalog.dto';
import { CreateBranchMachineDto, UpdateBranchMachineDto } from '../branches/dto/branch-machine.dto';
import { AssignStaffDto } from './dto/assign-staff.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AssignStaffBranchDto } from './dto/assign-staff-branch.dto';
import { AdvanceProcessingDto, MoveProcessingStepDto, SetShelfSlotDto } from './dto/processing.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { PartnerOperationsService } from './partner-operations.service';
import { ProcessingService } from './processing.service';
import { ShopReceivingService } from './shop-receiving.service';
import { PartnerNotificationsService } from './partner-notifications.service';
import { PartnerSettingsService } from './partner-settings.service';
import { PartnerProfileService } from './partner-profile.service';
import { PromotionsService } from '../promotions/promotions.service';
import { resolvePortalBranchId } from './partner-access';
import { UpdatePartnerSettingsDto } from './dto/update-partner-settings.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ResetStaffPasswordDto } from './dto/reset-staff-password.dto';
import { CreateRiderDto } from '../admin/dto/create-rider.dto';
import { UpdateRiderByPartnerDto } from './dto/update-rider.dto';
import {
  ConfirmShopItemsDto,
  ReceiveLaundryDto,
  VerifyShopWeightDto,
} from './dto/shop-receiving.dto';
import { CreatePartnerPromotionDto } from './dto/create-partner-promotion.dto';
import { SetPromotionActiveDto } from './dto/set-promotion-active.dto';
import { ShelfService } from './shelf.service';
import { AddShelfItemDto, CreateShelfDto } from './dto/shelf.dto';
import { SetPromotionOptInDto } from './dto/set-promotion-opt-in.dto';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

const processingPhotoUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, ok: boolean) => void) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(new BadRequestException('Only JPEG, PNG, and WebP images are allowed'), false);
      return;
    }
    cb(null, true);
  },
};

@Controller('partner')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnerController {
  constructor(
    private readonly processingService: ProcessingService,
    private readonly operationsService: PartnerOperationsService,
    private readonly shopReceivingService: ShopReceivingService,
    private readonly notificationsService: PartnerNotificationsService,
    private readonly settingsService: PartnerSettingsService,
    private readonly profileService: PartnerProfileService,
    private readonly pickupService: PickupService,
    @InjectModel(LaundryService.name)
    private readonly laundryServiceModel: Model<LaundryServiceDocument>,
    @InjectModel(LaundryAddon.name)
    private readonly laundryAddonModel: Model<LaundryAddonDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel('Order')
    private readonly orderModel: Model<Record<string, unknown>>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    private readonly cloudinaryStorageService: CloudinaryStorageService,
    private readonly branchesService: BranchesService,
    private readonly promotionsService: PromotionsService,
    private readonly shelfService: ShelfService,
  ) {}

  @Get('promotions')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  getActivePromotions(@Req() req: { user: { sub: string; role: UserRole } }) {
    const partnerUserId = req.user.role === UserRole.PARTNER ? req.user.sub : undefined;
    return this.promotionsService.listActivePromotionsForPartner(partnerUserId);
  }

  @Patch('promotions/:id/opt-in')
  @Roles(UserRole.PARTNER)
  setPlatformPromotionOptIn(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() dto: SetPromotionOptInDto,
  ) {
    return this.promotionsService.setPlatformPromotionOptIn(req.user.sub, id, dto.isOptedIn);
  }

  @Get('promotions/mine')
  @Roles(UserRole.PARTNER)
  listOwnPromotions(@Req() req: { user: { sub: string } }) {
    return this.promotionsService.listPromotionsForPartnerOwner(req.user.sub);
  }

  @Post('promotions')
  @Roles(UserRole.PARTNER)
  createOwnPromotion(
    @Req() req: { user: { sub: string } },
    @Body() dto: CreatePartnerPromotionDto,
  ) {
    return this.promotionsService.createPartnerPromotion(req.user.sub, dto);
  }

  @Patch('promotions/:id/active')
  @Roles(UserRole.PARTNER)
  setOwnPromotionActive(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() dto: SetPromotionActiveDto,
  ) {
    return this.promotionsService.setPartnerPromotionActive(req.user.sub, id, dto.isActive);
  }

  @Get('branches')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  listOwnBranches(@Req() req: { user: { sub: string } }) {
    return this.branchesService.listBranchesForPartner(req.user.sub);
  }

  @Get('branches/:id/pricing')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async getOwnBranchPricing(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      await this.branchesService.getOwnBranchOrThrow(id, req.user.sub);
    }
    return this.branchesService.getShopPricing(id, true);
  }

  @Patch('branches/:id/pricing')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async updateOwnBranchPricing(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
    @Body() dto: UpdateBranchPricingDto,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      await this.branchesService.getOwnBranchOrThrow(id, req.user.sub);
    }
    return this.branchesService.updateServicePricing(id, dto.servicePricing, dto.kgPerLoad);
  }

  @Patch('branches/:id/pricing-mode')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async updateOwnBranchPricingMode(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
    @Body() dto: UpdateBranchPricingModeDto,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      await this.branchesService.getOwnBranchOrThrow(id, req.user.sub);
    }
    return this.branchesService.updatePricingMode(id, dto.pricingMode);
  }

  @Patch('branches/:id/addon-pricing')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async updateOwnBranchAddonPricing(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
    @Body() dto: UpdateBranchAddonPricingDto,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      await this.branchesService.getOwnBranchOrThrow(id, req.user.sub);
    }
    return this.branchesService.updateAddonPricing(id, dto.addonPricing);
  }

  @Patch('branches/:id/hidden-catalog')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async updateOwnHiddenCatalog(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
    @Body() dto: UpdateBranchHiddenCatalogDto,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      await this.branchesService.getOwnBranchOrThrow(id, req.user.sub);
    }
    return this.branchesService.updateHiddenCatalog(id, dto);
  }

  @Post('branches/:id/custom-services')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async createOwnCustomService(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
    @Body() dto: CreateBranchCustomServiceDto,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      await this.branchesService.getOwnBranchOrThrow(id, req.user.sub);
    }
    return this.branchesService.createCustomService(id, req.user.sub, dto);
  }

  @Patch('branches/:id/custom-services/:serviceId')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async updateOwnCustomService(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
    @Param('serviceId') serviceId: string,
    @Body() dto: UpdateBranchCustomServiceDto,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      await this.branchesService.getOwnBranchOrThrow(id, req.user.sub);
    }
    return this.branchesService.updateCustomService(id, serviceId, dto);
  }

  @Delete('branches/:id/custom-services/:serviceId')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async deleteOwnCustomService(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
    @Param('serviceId') serviceId: string,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      await this.branchesService.getOwnBranchOrThrow(id, req.user.sub);
    }
    return this.branchesService.deleteCustomService(id, serviceId);
  }

  @Post('branches/:id/custom-addons')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async createOwnCustomAddon(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
    @Body() dto: CreateBranchCustomAddonDto,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      await this.branchesService.getOwnBranchOrThrow(id, req.user.sub);
    }
    return this.branchesService.createCustomAddon(id, req.user.sub, dto);
  }

  @Patch('branches/:id/custom-addons/:addonId')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async updateOwnCustomAddon(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
    @Param('addonId') addonId: string,
    @Body() dto: UpdateBranchCustomAddonDto,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      await this.branchesService.getOwnBranchOrThrow(id, req.user.sub);
    }
    return this.branchesService.updateCustomAddon(id, addonId, dto);
  }

  @Delete('branches/:id/custom-addons/:addonId')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async deleteOwnCustomAddon(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
    @Param('addonId') addonId: string,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      await this.branchesService.getOwnBranchOrThrow(id, req.user.sub);
    }
    return this.branchesService.deleteCustomAddon(id, addonId);
  }

  @Get('branches/:id/machines')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  async listOwnBranchMachines(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
  ) {
    if (req.user.role === UserRole.STAFF) {
      const staffBranchId = await resolvePortalBranchId(this.userModel, req.user.sub, req.user.role);
      if (!staffBranchId || staffBranchId.toString() !== id) {
        throw new NotFoundException('Branch not found');
      }
    } else if (req.user.role !== UserRole.ADMIN) {
      await this.branchesService.getOwnBranchOrThrow(id, req.user.sub);
    }
    return this.branchesService.listMachines(id);
  }

  @Post('branches/:id/machines')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async createOwnBranchMachine(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
    @Body() dto: CreateBranchMachineDto,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      await this.branchesService.getOwnBranchOrThrow(id, req.user.sub);
    }
    return this.branchesService.addMachine(id, dto);
  }

  @Patch('branches/:id/machines/:machineId')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async updateOwnBranchMachine(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
    @Param('machineId') machineId: string,
    @Body() dto: UpdateBranchMachineDto,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      await this.branchesService.getOwnBranchOrThrow(id, req.user.sub);
    }
    return this.branchesService.updateMachine(id, machineId, dto);
  }

  @Delete('branches/:id/machines/:machineId')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async deleteOwnBranchMachine(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
    @Param('machineId') machineId: string,
  ) {
    if (req.user.role !== UserRole.ADMIN) {
      await this.branchesService.getOwnBranchOrThrow(id, req.user.sub);
    }
    return this.branchesService.removeMachine(id, machineId);
  }

  @Get('settings')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  getSettings(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.settingsService.getSettings(req.user.sub, req.user.role);
  }

  @Patch('settings')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  updateSettings(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Body() dto: UpdatePartnerSettingsDto,
  ) {
    return this.settingsService.updateSettings(req.user.sub, req.user.role, dto);
  }

  @Post('settings/logo')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('logo', processingPhotoUploadOptions))
  async updateLogo(
    @Req() req: { user: { sub: string; role: UserRole } },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Logo image is required');
    return this.settingsService.updateLogo(req.user.sub, req.user.role, file);
  }

  @Delete('settings/logo')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  removeLogo(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.settingsService.removeLogo(req.user.sub, req.user.role);
  }

  @Get('profile')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  getOwnProfile(@Req() req: { user: { sub: string } }) {
    return this.profileService.getOwnProfile(req.user.sub);
  }

  @Patch('profile')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  updateOwnProfile(@Req() req: { user: { sub: string } }, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateOwnProfile(req.user.sub, dto);
  }

  @Post('profile/avatar')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('avatar', processingPhotoUploadOptions))
  async uploadOwnAvatar(
    @Req() req: { user: { sub: string } },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Avatar image is required');
    return this.profileService.updateOwnAvatar(req.user.sub, file);
  }

  @Delete('profile/avatar')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  removeOwnAvatar(@Req() req: { user: { sub: string } }) {
    return this.profileService.removeOwnAvatar(req.user.sub);
  }

  @Patch('staff/:staffId/profile')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  updateStaffProfile(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('staffId') staffId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateStaffProfile(req.user.sub, staffId, dto, req.user.role);
  }

  @Post('staff/:staffId/reset-password')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  resetStaffPassword(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('staffId') staffId: string,
    @Body() dto: ResetStaffPasswordDto,
  ) {
    return this.profileService.resetStaffPassword(req.user.sub, staffId, dto, req.user.role);
  }

  @Post('staff/:staffId/profile/avatar')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('avatar', processingPhotoUploadOptions))
  async uploadStaffAvatar(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('staffId') staffId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Avatar image is required');
    return this.profileService.updateStaffAvatar(req.user.sub, staffId, file, req.user.role);
  }

  @Get('notifications')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  listNotifications(
    @Req() req: { user: { sub: string } },
    @Query('limit') limit = '30',
  ) {
    return this.notificationsService.listNotifications(req.user.sub, Number(limit) || 30);
  }

  @Patch('notifications/read-all')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  markAllNotificationsRead(@Req() req: { user: { sub: string } }) {
    return this.notificationsService.markAllRead(req.user.sub);
  }

  @Patch('notifications/:id/read')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  markNotificationRead(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.notificationsService.markNotificationRead(req.user.sub, id);
  }

  @Get('dashboard')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  getDashboard(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.operationsService.getDashboard(req.user.sub, req.user.role);
  }

  @Get('orders/incoming')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  getIncoming(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.operationsService.getIncomingOrders(req.user.sub, req.user.role);
  }

  @Post('orders/:orderId/accept')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
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
  getProgress(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.operationsService.getProgressMonitor(req.user.sub, req.user.role);
  }

  @Get('staff')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  listStaff(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.operationsService.listStaff(req.user.sub, req.user.role);
  }

  @Get('riders')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  listAssignedRiders(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.operationsService.listAssignedRiders(req.user.sub, req.user.role);
  }

  @Get('riders/owned')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  listOwnedRiders(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.operationsService.listOwnedRiders(req.user.sub, req.user.role);
  }

  @Post('riders/owned')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  createOwnedRider(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Body() dto: CreateRiderDto,
  ) {
    return this.operationsService.createOwnedRider(req.user.sub, req.user.role, dto);
  }

  @Patch('riders/owned/:riderUserId')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  updateOwnedRider(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('riderUserId') riderUserId: string,
    @Body() dto: UpdateRiderByPartnerDto,
  ) {
    return this.operationsService.updateOwnedRider(req.user.sub, req.user.role, riderUserId, dto);
  }

  @Delete('riders/owned/:riderUserId')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  removeOwnedRider(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('riderUserId') riderUserId: string,
  ) {
    return this.operationsService.removeOwnedRider(req.user.sub, req.user.role, riderUserId);
  }

  @Post('staff')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  createStaff(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Body() dto: CreateStaffDto,
  ) {
    return this.operationsService.createStaff(req.user.sub, req.user.role, dto);
  }

  @Patch('staff/:staffId/branch')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  reassignStaffBranch(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('staffId') staffId: string,
    @Body() dto: AssignStaffBranchDto,
  ) {
    return this.operationsService.reassignStaffBranch(req.user.sub, req.user.role, staffId, dto);
  }

  @Delete('staff/:staffId')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  removeStaff(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('staffId') staffId: string,
  ) {
    return this.operationsService.removeStaff(req.user.sub, req.user.role, staffId);
  }

  @Post('orders/:orderId/assign-staff')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  assignStaff(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Body() dto: AssignStaffDto,
  ) {
    return this.operationsService.assignStaff(orderId, dto.staffId, req.user.sub, req.user.role);
  }

  @Get('inventory')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  getInventory(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.operationsService.getInventory(req.user.sub, req.user.role);
  }

  @Post('inventory')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  createInventoryItem(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Body() dto: CreateInventoryDto,
  ) {
    return this.operationsService.createInventoryItem(req.user.sub, req.user.role, dto);
  }

  @Patch('inventory/:id')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  updateInventory(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    return this.operationsService.updateInventory(req.user.sub, req.user.role, id, dto);
  }

  @Delete('inventory/:id')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  deleteInventoryItem(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('id') id: string,
  ) {
    return this.operationsService.deleteInventoryItem(req.user.sub, req.user.role, id);
  }

  @Get('reports')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  getReports(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Query('days') days = '7',
  ) {
    return this.operationsService.getReports(req.user.sub, req.user.role, Number(days) || 7);
  }

  @Get('revenue')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  getRevenue(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.operationsService.getRevenue(req.user.sub, req.user.role);
  }

  @Get('invoices')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  getInvoices(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.operationsService.getInvoices(req.user.sub, req.user.role);
  }

  @Get('invoices/:invoiceId/orders')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  getInvoiceOrders(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.operationsService.getInvoiceOrders(req.user.sub, req.user.role, invoiceId);
  }

  @Get('invoices/:invoiceId/pdf')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async downloadInvoicePdf(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('invoiceId') invoiceId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.operationsService.downloadInvoicePdf(
      req.user.sub,
      req.user.role,
      invoiceId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Get('receivable-balance')
  @Roles(UserRole.PARTNER)
  getReceivableBalance(@Req() req: { user: { sub: string } }) {
    return this.operationsService.getReceivableBalance(req.user.sub);
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

  @Get('orders/history')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  getOrderHistory(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.operationsService.getOrderHistory(req.user.sub, req.user.role, status, customerId);
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
  getProcessing(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
  ) {
    return this.processingService.getOrderProcessing(orderId, req.user.sub, req.user.role);
  }

  @Post('orders/:orderId/processing/photo-upload')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('photo', processingPhotoUploadOptions))
  async uploadProcessingPhoto(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Photo image is required');
    }
    const publicId = `${req.user.sub}-${orderId}-${Date.now()}`;
    const result = await this.cloudinaryStorageService.uploadPrivateBuffer(
      file.buffer,
      'lunara/task-photos',
      publicId,
      'image',
      file.mimetype,
    );
    return this.processingService.registerProcessingPhoto(
      orderId,
      req.user.sub,
      req.user.role,
      taskPhotoPublicPath(result.public_id),
    );
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

  @Post('orders/:orderId/processing/move')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  moveProcessingStep(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Body() dto: MoveProcessingStepDto,
  ) {
    return this.processingService.moveToStep(orderId, req.user.sub, req.user.role, dto);
  }

  @Patch('orders/:orderId/processing/shelf')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  setShelfSlot(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Body() dto: SetShelfSlotDto,
  ) {
    return this.processingService.setShelfSlot(orderId, req.user.sub, req.user.role, dto);
  }

  @Delete('orders/:orderId/processing/shelf')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  clearShelfSlot(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
  ) {
    return this.processingService.clearShelfSlot(orderId, req.user.sub, req.user.role);
  }

  @Get('orders/shelf-lookup')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  findOnShelf(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Query('query') query?: string,
  ) {
    return this.processingService.findOnShelf(query ?? '', req.user.sub, req.user.role);
  }

  @Get('shelves/search')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  searchShelfItems(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Query('query') query?: string,
  ) {
    return this.shelfService.searchItems(req.user.sub, req.user.role, query ?? '');
  }

  @Get('shelves')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  listShelves(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.shelfService.listShelves(req.user.sub, req.user.role);
  }

  @Post('shelves')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  createShelf(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Body() dto: CreateShelfDto,
  ) {
    return this.shelfService.createShelf(req.user.sub, req.user.role, dto);
  }

  @Delete('shelves/:shelfId')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  deleteShelf(
    @Param('shelfId') shelfId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
  ) {
    return this.shelfService.deleteShelf(req.user.sub, req.user.role, shelfId);
  }

  @Post('shelves/:shelfId/items')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  addShelfItem(
    @Param('shelfId') shelfId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @Body() dto: AddShelfItemDto,
  ) {
    return this.shelfService.addItem(req.user.sub, req.user.role, shelfId, dto);
  }

  @Delete('shelves/:shelfId/items/:itemId')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  removeShelfItem(
    @Param('shelfId') shelfId: string,
    @Param('itemId') itemId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
  ) {
    return this.shelfService.removeItem(req.user.sub, req.user.role, shelfId, itemId);
  }

  @Post('orders/:orderId/delivery/dispatch')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  dispatchDelivery(@Param('orderId') orderId: string) {
    return this.operationsService.notifyDeliveryDispatch(orderId);
  }

  @Get('services')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  async getServices() {
    const services = await this.laundryServiceModel
      .find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();
    return { success: true, data: services };
  }

  @Get('addons')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  async getAddons() {
    const addons = await this.laundryAddonModel
      .find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();
    return { success: true, data: addons };
  }

  @Get('customers')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async getCustomers(@Req() req: { user: { sub: string; role: UserRole } }) {
    const { sub, role } = req.user;
    const matchStage: Record<string, unknown> = {
      status: { $in: [OrderStatus.COMPLETED, OrderStatus.DELIVERED, OrderStatus.CUSTOMER_PICKUP] },
    };
    if (role === UserRole.PARTNER) {
      matchStage.partnerId = new Types.ObjectId(sub);
    } else if (role === UserRole.STAFF) {
      const staffUser = await this.userModel.findById(sub).select('branchId').lean();
      if (staffUser?.branchId) matchStage.branchId = staffUser.branchId;
    }
    const rows = await this.orderModel.aggregate([
      { $match: matchStage },
      { $group: {
        _id: '$customerId',
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: '$totalAmount' },
        lastOrderAt: { $max: '$createdAt' },
      }},
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
      { $lookup: { from: 'customers', localField: '_id', foreignField: 'userId', as: 'customer' } },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      { $project: {
        customerId: '$_id',
        name: { $trim: { input: {
          $concat: [{ $ifNull: ['$customer.firstName', ''] }, ' ', { $ifNull: ['$customer.lastName', ''] }],
        } } },
        phone: '$user.phone',
        totalOrders: 1,
        totalSpent: 1,
        lastOrderAt: 1,
      }},
      { $sort: { lastOrderAt: -1 } },
      { $limit: 200 },
    ]);
    return { success: true, data: rows };
  }

  @Get('customers/:customerId')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async getCustomer(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('customerId') customerId: string,
  ) {
    if (!Types.ObjectId.isValid(customerId)) {
      throw new BadRequestException('Invalid customer id');
    }
    const { sub, role } = req.user;
    const matchStage: Record<string, unknown> = {
      customerId: new Types.ObjectId(customerId),
      status: { $in: [OrderStatus.COMPLETED, OrderStatus.DELIVERED, OrderStatus.CUSTOMER_PICKUP] },
    };
    if (role === UserRole.PARTNER) {
      matchStage.partnerId = new Types.ObjectId(sub);
    } else if (role === UserRole.STAFF) {
      const staffUser = await this.userModel.findById(sub).select('branchId').lean();
      if (staffUser?.branchId) matchStage.branchId = staffUser.branchId;
    }
    const [summary] = await this.orderModel.aggregate([
      { $match: matchStage },
      { $group: {
        _id: '$customerId',
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: '$totalAmount' },
        lastOrderAt: { $max: '$createdAt' },
      }},
    ]);
    if (!summary) {
      throw new NotFoundException('Customer not found');
    }
    const [user, customer] = await Promise.all([
      this.userModel.findById(customerId).select('email phone').lean(),
      this.customerModel.findOne({ userId: customerId }).select('firstName lastName createdAt').lean(),
    ]);
    return {
      success: true,
      data: {
        customerId,
        firstName: customer?.firstName ?? '',
        lastName: customer?.lastName ?? '',
        name: `${customer?.firstName ?? ''} ${customer?.lastName ?? ''}`.trim(),
        email: user?.email ?? null,
        phone: user?.phone ?? null,
        totalOrders: summary.totalOrders,
        totalSpent: summary.totalSpent,
        lastOrderAt: summary.lastOrderAt,
        customerSince: customer?.createdAt ?? null,
      },
    };
  }

  @Patch('customers/:customerId')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async updateCustomer(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('customerId') customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    if (!Types.ObjectId.isValid(customerId)) {
      throw new BadRequestException('Invalid customer id');
    }
    const { sub, role } = req.user;
    const matchStage: Record<string, unknown> = {
      customerId: new Types.ObjectId(customerId),
      status: { $in: [OrderStatus.COMPLETED, OrderStatus.DELIVERED, OrderStatus.CUSTOMER_PICKUP] },
    };
    if (role === UserRole.PARTNER) {
      matchStage.partnerId = new Types.ObjectId(sub);
    } else if (role === UserRole.STAFF) {
      const staffUser = await this.userModel.findById(sub).select('branchId').lean();
      if (staffUser?.branchId) matchStage.branchId = staffUser.branchId;
    }
    const hasOrder = await this.orderModel.exists(matchStage);
    if (!hasOrder) {
      throw new NotFoundException('Customer not found');
    }
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      await this.customerModel.updateOne(
        { userId: customerId },
        {
          $set: {
            ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
            ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
          },
        },
      );
    }
    if (dto.phone !== undefined) {
      await this.userModel.updateOne({ _id: customerId }, { $set: { phone: dto.phone } });
    }
    return this.getCustomer(req, customerId);
  }
}
