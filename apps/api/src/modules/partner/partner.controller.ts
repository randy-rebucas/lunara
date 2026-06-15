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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  TASK_PHOTO_UPLOAD_DIR,
  taskPhotoPublicPath,
} from '../../common/uploads/upload-paths';
import { PickupService } from '../riders/pickup.service';
import { AssignStaffDto } from './dto/assign-staff.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AdvanceProcessingDto } from './dto/processing.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { PartnerOperationsService } from './partner-operations.service';
import { ProcessingService } from './processing.service';
import { ShopReceivingService } from './shop-receiving.service';
import { PartnerNotificationsService } from './partner-notifications.service';
import { PartnerSettingsService } from './partner-settings.service';
import { UpdatePartnerSettingsDto } from './dto/update-partner-settings.dto';
import {
  ConfirmShopItemsDto,
  ReceiveLaundryDto,
  VerifyShopWeightDto,
} from './dto/shop-receiving.dto';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

const processingPhotoUploadOptions = {
  storage: diskStorage({
    destination: TASK_PHOTO_UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const req = _req as { user?: { sub: string }; params?: { orderId?: string } };
      const userId = req.user?.sub ?? 'partner';
      const orderId = req.params?.orderId ?? 'order';
      const ext = extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${userId}-${orderId}-${Date.now()}${ext}`);
    },
  }),
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
    private readonly pickupService: PickupService,
  ) {}

  @Get('settings')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  getSettings(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.settingsService.getSettings(req.user.sub, req.user.role);
  }

  @Patch('settings')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  updateSettings(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Body() dto: UpdatePartnerSettingsDto,
  ) {
    return this.settingsService.updateSettings(req.user.sub, req.user.role, dto);
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
  getProgress(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.operationsService.getProgressMonitor(req.user.sub, req.user.role);
  }

  @Get('staff')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  listStaff(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.operationsService.listStaff(req.user.sub, req.user.role);
  }

  @Post('staff')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  createStaff(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Body() dto: CreateStaffDto,
  ) {
    return this.operationsService.createStaff(req.user.sub, req.user.role, dto);
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

  @Get('settlements')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  getSettlements(@Req() req: { user: { sub: string; role: UserRole } }) {
    return this.operationsService.getSettlements(req.user.sub, req.user.role);
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
  getProcessing(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
  ) {
    return this.processingService.getOrderProcessing(orderId, req.user.sub, req.user.role);
  }

  @Post('orders/:orderId/processing/photo-upload')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('photo', processingPhotoUploadOptions))
  uploadProcessingPhoto(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Photo image is required');
    }
    return this.processingService.registerProcessingPhoto(
      orderId,
      req.user.sub,
      req.user.role,
      taskPhotoPublicPath(file.filename),
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

  @Post('orders/:orderId/delivery/dispatch')
  @Roles(UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN)
  dispatchDelivery(@Param('orderId') orderId: string) {
    return this.operationsService.notifyDeliveryDispatch(orderId);
  }
}
