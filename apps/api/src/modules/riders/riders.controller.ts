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
import { memoryStorage } from 'multer';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LocalStorageService } from '../../common/storage/local-storage.service';
import { taskPhotoPublicPath, remittanceProofPublicPath } from '../../common/uploads/upload-paths';
import { DeliveryPhotoDto } from './dto/delivery.dto';
import { CapturePhotoDto, CollectLaundryDto, DropAtShopDto, VerifyCustomerDto, VerifyQrDto } from './dto/pickup.dto';
import { AssignTagDto } from '../laundry-tags/dto/assign-tag.dto';
import { UpdateLocationDto, UpdateRiderProfileDto } from './dto/rider.dto';
import { RequestWithdrawalDto, UpdatePayoutMethodDto } from './dto/rider-wallet.dto';
import { DeliveryService } from './delivery.service';
import { PickupService } from './pickup.service';
import { RidersService } from './riders.service';
import { TriggerSosDto } from '../sos/dto/trigger-sos.dto';
import { RiderSosService } from '../sos/rider-sos.service';
import { HandoffQrService } from '../handoff/handoff-qr.service';
import { RiderWalletService } from './rider-wallet.service';
import { isValidRiderDocumentType } from './rider-compliance';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

const imageMemoryUploadOptions = (maxSizeBytes: number) => ({
  storage: memoryStorage(),
  limits: { fileSize: maxSizeBytes },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, ok: boolean) => void) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(new BadRequestException('Only JPEG, PNG, and WebP images are allowed'), false);
      return;
    }
    cb(null, true);
  },
});

const taskPhotoUploadOptions = imageMemoryUploadOptions(8 * 1024 * 1024);
const remittanceProofUploadOptions = imageMemoryUploadOptions(8 * 1024 * 1024);
const riderDocumentUploadOptions = imageMemoryUploadOptions(5 * 1024 * 1024);

@Controller('riders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RidersController {
  constructor(
    private readonly ridersService: RidersService,
    private readonly pickupService: PickupService,
    private readonly deliveryService: DeliveryService,
    private readonly riderSosService: RiderSosService,
    private readonly handoffQrService: HandoffQrService,
    private readonly riderWalletService: RiderWalletService,
    private readonly localStorageService: LocalStorageService,
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

  @Post('pickup-offers/:orderId/reject')
  @Roles(UserRole.RIDER)
  rejectPickupOffer(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.pickupService.rejectPickup(orderId, req.user.sub);
  }

  @Post('pickup-tasks/:orderId/reject')
  @Roles(UserRole.RIDER)
  rejectPickupTask(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.pickupService.rejectPickup(orderId, req.user.sub);
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

  @Post('pickup-tasks/:orderId/collect-cash')
  @Roles(UserRole.RIDER)
  collectPickupCash(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.pickupService.collectCash(orderId, req.user.sub);
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

  @Post('pickup-tasks/:orderId/assign-tag')
  @Roles(UserRole.RIDER)
  assignLaundryTag(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: AssignTagDto,
  ) {
    return this.pickupService.assignLaundryTag(orderId, req.user.sub, dto);
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

  @Post('pickup-tasks/:orderId/photo-upload')
  @Roles(UserRole.RIDER)
  @UseInterceptors(FileInterceptor('photo', taskPhotoUploadOptions))
  async uploadPickupPhoto(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Photo image is required');
    }
    const publicId = `${req.user.sub}-${orderId}-${Date.now()}`;
    const result = await this.localStorageService.uploadPrivateBuffer(
      file.buffer,
      'lunara/task-photos',
      publicId,
      'image',
      file.mimetype,
    );
    return this.pickupService.capturePhoto(orderId, req.user.sub, taskPhotoPublicPath(result.public_id));
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
    @Body() dto: DropAtShopDto,
  ) {
    return this.pickupService.dropAtShop(orderId, req.user.sub, dto);
  }

  @Get('pickup-tasks/:orderId/order-qr')
  @Roles(UserRole.RIDER)
  getPickupOrderQr(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string; role: UserRole } },
  ) {
    return this.handoffQrService.getOrderHandoffQr(orderId, req.user).then((data) => ({
      success: true,
      data,
    }));
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

  @Patch('me')
  @Roles(UserRole.RIDER)
  updateMe(@Req() req: { user: { sub: string } }, @Body() dto: UpdateRiderProfileDto) {
    return this.ridersService.updateProfile(req.user.sub, dto);
  }

  @Post('me/documents/:type')
  @Roles(UserRole.RIDER)
  @UseInterceptors(FileInterceptor('document', riderDocumentUploadOptions))
  async uploadDocument(
    @Param('type') type: string,
    @Req() req: { user: { sub: string } },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!isValidRiderDocumentType(type)) {
      throw new BadRequestException('Invalid document type');
    }
    if (!file) {
      throw new BadRequestException('Document image is required');
    }
    const publicId = `${req.user.sub}-${type}-${Date.now()}`;
    const result = await this.localStorageService.uploadPrivateBuffer(
      file.buffer,
      'lunara/rider-documents',
      publicId,
      'image',
      file.mimetype,
    );
    return this.ridersService.uploadDocument(req.user.sub, type, result.public_id);
  }

  @Get('notifications')
  @Roles(UserRole.RIDER)
  listNotifications(
    @Req() req: { user: { sub: string } },
    @Query('limit') limit = '20',
  ) {
    return this.ridersService.listNotifications(req.user.sub, Number(limit));
  }

  @Patch('notifications/:id/read')
  @Roles(UserRole.RIDER)
  markNotificationRead(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.ridersService.markNotificationRead(req.user.sub, id);
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

  @Post('delivery-tasks/:orderId/reject')
  @Roles(UserRole.RIDER)
  rejectDeliveryTask(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.deliveryService.rejectDelivery(orderId, req.user.sub);
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

  @Post('delivery-tasks/:orderId/verify-customer-qr')
  @Roles(UserRole.RIDER)
  verifyDeliveryCustomerQr(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: VerifyQrDto,
  ) {
    return this.deliveryService.verifyCustomerByQr(orderId, req.user.sub, dto);
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

  @Post('delivery-tasks/:orderId/photo-upload')
  @Roles(UserRole.RIDER)
  @UseInterceptors(FileInterceptor('photo', taskPhotoUploadOptions))
  async uploadDeliveryPhoto(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Photo image is required');
    }
    const publicId = `${req.user.sub}-${orderId}-${Date.now()}`;
    const result = await this.localStorageService.uploadPrivateBuffer(
      file.buffer,
      'lunara/task-photos',
      publicId,
      'image',
      file.mimetype,
    );
    return this.deliveryService.capturePhoto(orderId, req.user.sub, taskPhotoPublicPath(result.public_id));
  }

  @Post('delivery-tasks/:orderId/collect-cash')
  @Roles(UserRole.RIDER)
  collectDeliveryCash(
    @Param('orderId') orderId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.deliveryService.collectCash(orderId, req.user.sub);
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

  @Get('active-assignment')
  @Roles(UserRole.RIDER)
  getActiveAssignment(@Req() req: { user: { sub: string } }) {
    return this.ridersService.getActiveAssignment(req.user.sub);
  }

  @Get('tasks/history')
  @Roles(UserRole.RIDER)
  getTaskHistory(
    @Req() req: { user: { sub: string } },
    @Query('limit') limit = '30',
  ) {
    return this.ridersService.getTaskHistory(req.user.sub, Number(limit));
  }

  @Get('tasks/cancelled')
  @Roles(UserRole.RIDER)
  getCancelledTasks(
    @Req() req: { user: { sub: string } },
    @Query('limit') limit = '30',
  ) {
    return this.ridersService.getCancelledTasks(req.user.sub, Number(limit));
  }

  @Get('earnings')
  @Roles(UserRole.RIDER)
  getEarnings(@Req() req: { user: { sub: string } }) {
    return this.ridersService.getEarnings(req.user.sub);
  }

  @Get('performance')
  @Roles(UserRole.RIDER)
  getPerformance(@Req() req: { user: { sub: string } }) {
    return this.ridersService.getPerformance(req.user.sub);
  }

  @Get('wallet')
  @Roles(UserRole.RIDER)
  getWallet(@Req() req: { user: { sub: string } }) {
    return this.riderWalletService.getWallet(req.user.sub);
  }

  @Get('wallet/withdrawals')
  @Roles(UserRole.RIDER)
  listWithdrawals(@Req() req: { user: { sub: string } }) {
    return this.riderWalletService.listWithdrawals(req.user.sub);
  }

  @Get('cash-summary')
  @Roles(UserRole.RIDER)
  getCashSummary(@Req() req: { user: { sub: string } }) {
    return this.riderWalletService.getCashSummary(req.user.sub);
  }

  @Post('remit-cash')
  @Roles(UserRole.RIDER)
  @UseInterceptors(FileInterceptor('proof', remittanceProofUploadOptions))
  async submitRemittance(
    @Req() req: { user: { sub: string } },
    @Body('transactionId') transactionId?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let proofImageUrl: string | undefined;
    if (file) {
      const publicId = `${req.user.sub}-remittance-${Date.now()}`;
      const result = await this.localStorageService.uploadPrivateBuffer(
        file.buffer,
        'lunara/remittance-proofs',
        publicId,
        'image',
        file.mimetype,
      );
      proofImageUrl = remittanceProofPublicPath(result.public_id);
    }
    return this.riderWalletService.submitRemittance(req.user.sub, proofImageUrl, transactionId);
  }

  @Post('wallet/withdraw')
  @Roles(UserRole.RIDER)
  requestWithdrawal(
    @Req() req: { user: { sub: string } },
    @Body() dto: RequestWithdrawalDto,
  ) {
    return this.riderWalletService.requestWithdrawal(req.user.sub, dto.amount);
  }

  @Get('payout-method')
  @Roles(UserRole.RIDER)
  getPayoutMethod(@Req() req: { user: { sub: string } }) {
    return this.riderWalletService.getPayoutMethod(req.user.sub);
  }

  @Patch('payout-method')
  @Roles(UserRole.RIDER)
  updatePayoutMethod(
    @Req() req: { user: { sub: string } },
    @Body() dto: UpdatePayoutMethodDto,
  ) {
    return this.riderWalletService.updatePayoutMethod(req.user.sub, dto);
  }

  @Patch('location')
  @Roles(UserRole.RIDER)
  updateLocation(@Req() req: { user: { sub: string } }, @Body() dto: UpdateLocationDto) {
    return this.ridersService.updateLocation(req.user.sub, dto);
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

  @Post('break/start')
  @Roles(UserRole.RIDER)
  startBreak(@Req() req: { user: { sub: string } }) {
    return this.ridersService.startBreak(req.user.sub);
  }

  @Post('break/end')
  @Roles(UserRole.RIDER)
  endBreak(@Req() req: { user: { sub: string } }) {
    return this.ridersService.endBreak(req.user.sub);
  }

  @Post('sos/notify')
  @Roles(UserRole.RIDER)
  sosNotify(@Req() req: { user: { sub: string } }, @Body() dto: TriggerSosDto) {
    return this.riderSosService.notifyDispatch(req.user.sub, dto.orderId, dto.lat, dto.lng);
  }

  @Post('sos/location/start')
  @Roles(UserRole.RIDER)
  sosStartLocation(@Req() req: { user: { sub: string } }, @Body() dto: TriggerSosDto) {
    return this.riderSosService.startLocationSharing(
      req.user.sub,
      dto.orderId,
      dto.lat,
      dto.lng,
    );
  }

  @Post('sos/location/stop')
  @Roles(UserRole.RIDER)
  sosStopLocation(@Req() req: { user: { sub: string } }, @Body() dto: TriggerSosDto) {
    return this.riderSosService.stopLocationSharing(req.user.sub, dto.orderId);
  }
}
