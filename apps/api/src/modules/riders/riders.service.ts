import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import {
  PARTNER_SHOP_LOCATION,
  getEarningsPeriodStarts,
  normalizeRiderLocationPayload,
  riderEarningAmount,
  riderLocationWirePayload,
  RIDER_EARNING_TYPE_LABELS,
  type RiderEarningType,
} from '@lunara/utils';
import { riderDocumentPublicPath } from '../../common/uploads/upload-paths';
import { CloudinaryStorageService } from '../../common/storage/cloudinary-storage.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Address, AddressDocument } from '../addresses/schemas/address.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { Notification, NotificationDocument } from '../reviews/schemas/notification.schema';
import { Review, ReviewDocument } from '../reviews/schemas/review.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UpdateLocationDto, UpdateRiderEmploymentDto, UpdateRiderProfileDto } from './dto/rider.dto';
import {
  isRiderCompliant,
  isValidRiderDocumentType,
  serializeRiderDocuments,
  type RiderDocumentType,
} from './rider-compliance';
import { inferRiderNotificationCategory } from './rider-notification.constants';
import { RiderNotificationService } from './rider-notification.service';
import { RiderWalletService } from './rider-wallet.service';
import { LedgerService } from '../ledger/ledger.service';
import { SettingsService } from '../settings/settings.service';
import { Rider, RiderDocument } from './schemas/rider.schema';
import {
  buildActiveAssignmentPayload,
  isPickupLeg,
  pickPrimaryActiveOrder,
} from './rider-active-assignment';
import { buildRiderPerformancePayload } from './rider-performance';
import { buildRiderTaskDetails } from './rider-task-summary';

@Injectable()
export class RidersService {
  private readonly logger = new Logger(RidersService.name);

  constructor(
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Address.name) private addressModel: Model<AddressDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    private riderNotificationService: RiderNotificationService,
    private riderWalletService: RiderWalletService,
    private ledgerService: LedgerService,
    private settingsService: SettingsService,
    private cloudinaryStorageService: CloudinaryStorageService,
  ) {}

  async listNotifications(userId: string, limit = 20) {
    const items = await this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit);
    return {
      success: true,
      data: items.map((n) => ({
        _id: n._id.toString(),
        title: n.title,
        body: n.body,
        read: n.read,
        category:
          (n.data?.category as string | undefined) ??
          inferRiderNotificationCategory(n.data?.type as string | undefined),
        data: n.data,
        createdAt: n.createdAt,
      })),
    };
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const notification = await this.notificationModel.findById(notificationId);
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId.toString() !== userId) {
      throw new NotFoundException('Notification not found');
    }
    notification.read = true;
    await notification.save();
    return {
      success: true,
      data: {
        _id: notification._id.toString(),
        read: notification.read,
      },
    };
  }

  private todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  private ensureTodayBucket(rider: RiderDocument) {
    const key = this.todayKey();
    if (rider.earningsDayKey !== key) {
      rider.earningsDayKey = key;
      rider.todayEarnings = 0;
    }
  }

  /**
   * Atomically applies an earning to totalEarnings/todayEarnings/recentEarnings via a pipeline
   * update, instead of `rider.totalEarnings += amount; rider.save()`. The fetch-mutate-save form
   * lost updates under concurrency (two orders completing around the same time for one rider) —
   * on this optimistically-versioned document that surfaced as an outright VersionError, silently
   * dropping the earning for the losing request rather than merely drifting the balance.
   */
  private async applyEarningAtomically(
    userId: string,
    amount: number,
    entry: { type: RiderEarningType; amount: number; orderId?: Types.ObjectId; note?: string; earnedAt: Date },
  ) {
    const key = this.todayKey();
    const rider = await this.riderModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      [
        {
          $set: {
            totalEarnings: { $add: [{ $ifNull: ['$totalEarnings', 0] }, amount] },
            todayEarnings: {
              $cond: [
                { $eq: ['$earningsDayKey', key] },
                { $add: [{ $ifNull: ['$todayEarnings', 0] }, amount] },
                amount,
              ],
            },
            earningsDayKey: key,
            recentEarnings: {
              $slice: [{ $concatArrays: [[entry], { $ifNull: ['$recentEarnings', []] }] }, 50],
            },
          },
        },
      ],
      { new: true },
    );
    if (!rider) throw new NotFoundException('Rider not found');
    return rider;
  }

  async findOrCreate(userId: string) {
    let rider = await this.riderModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!rider) {
      rider = await this.riderModel.create({ userId: new Types.ObjectId(userId) });
    }
    this.ensureTodayBucket(rider);
    return rider;
  }

  private serializeMePayload(
    userId: string,
    rider: RiderDocument,
    user: Pick<UserDocument, 'email' | 'phone'> | null,
  ) {
    const compliance = isRiderCompliant(rider, user);
    const displayFirstName =
      rider.firstName?.trim() || user?.email?.split('@')[0] || 'Rider';
    const displayLastName = rider.lastName?.trim() || '';

    return {
      userId,
      riderId: rider._id.toString(),
      isOnline: rider.isOnline,
      shiftStatus: rider.shiftStatus ?? (rider.isOnline ? 'online' : 'offline'),
      firstName: rider.firstName,
      lastName: rider.lastName,
      homeAddress: rider.homeAddress ?? null,
      vehicleType: rider.vehicleType,
      plateNumber: rider.plateNumber,
      orCrNumber: rider.orCrNumber,
      employmentType: rider.employmentType,
      fixedWageAmount: rider.fixedWageAmount,
      wageFrequency: rider.wageFrequency,
      documents: serializeRiderDocuments(rider.documents),
      compliance: {
        isCompliant: compliance.isCompliant,
        profileGaps: compliance.profileGaps,
        documentGaps: compliance.documentGaps,
        approvedDocumentCount: compliance.approvedDocumentCount,
        verificationStatus: compliance.verificationStatus,
      },
      totalEarnings: rider.totalEarnings,
      todayEarnings: rider.todayEarnings,
      shopLocation: PARTNER_SHOP_LOCATION,
      user: user
        ? {
            firstName: displayFirstName,
            lastName: displayLastName,
            email: user.email,
            phone: user.phone,
          }
        : null,
    };
  }

  async getMe(userId: string) {
    void this.riderNotificationService.syncOverduePickupReminders(userId).catch(() => {});
    const rider = await this.findOrCreate(userId);
    const user = await this.userModel.findById(userId).select('email phone');
    return {
      success: true,
      data: this.serializeMePayload(userId, rider, user),
    };
  }

  async creditEarning(userId: string, orderId: string, type: Extract<RiderEarningType, 'pickup' | 'delivery'>) {
    const rider = await this.findOrCreate(userId);

    if (rider.employmentType === 'employee') {
      // Employees are paid a fixed wage, not per-task fees — nothing to credit here.
      return {
        amount: 0,
        totalEarnings: rider.totalEarnings,
        todayEarnings: rider.todayEarnings,
      };
    }

    const fees = await this.settingsService.getRiderFeeAmounts();
    const amount = riderEarningAmount(type, type === 'pickup' ? fees.pickup : fees.delivery);

    const updated = await this.applyEarningAtomically(userId, amount, {
      type,
      amount,
      orderId: new Types.ObjectId(orderId),
      earnedAt: new Date(),
    });

    // Awaited (not fire-and-forget): totalEarnings/todayEarnings above are already saved, so a
    // silently-dropped wallet credit here would leave the Earnings screen and Wallet screen
    // permanently disagreeing about how much the rider has actually earned.
    try {
      await this.riderWalletService.creditFromTask(userId, orderId, type, amount);
    } catch (err) {
      this.logger.error(
        `Wallet credit failed for rider ${userId}, order ${orderId} (${type}, ${amount}): ${(err as Error).message}`,
      );
    }

    void this.riderNotificationService
      .notifyEarningsCredited(userId, orderId, type, amount)
      .catch(() => {});

    await this.ledgerService.post(
      `rider-earning:${orderId}:${type}`,
      'rider_earning',
      `${orderId}:${type}`,
      [
        {
          accountType: 'rider_payout_expense',
          direction: 'debit',
          amount,
          description: `${RIDER_EARNING_TYPE_LABELS[type]} fee earned by rider ${userId} (order ${orderId.slice(-6)}) — rate ₱${amount} at time of task, live-configurable and may differ from the current PlatformSettings value`,
        },
        {
          accountType: 'rider_payable',
          accountSubject: userId,
          direction: 'credit',
          amount,
          description: `Payable to rider ${userId} for ${RIDER_EARNING_TYPE_LABELS[type]} — rate ₱${amount}`,
        },
      ],
    );

    return {
      amount,
      totalEarnings: updated.totalEarnings,
      todayEarnings: updated.todayEarnings,
    };
  }

  async creditManualEarning(
    userId: string,
    type: Extract<RiderEarningType, 'bonus' | 'adjustment' | 'wage'>,
    amount: number,
    note?: string,
  ) {
    const rider = await this.findOrCreate(userId);

    if (type === 'wage' && rider.employmentType !== 'employee') {
      throw new BadRequestException('Wage payments are only valid for employee riders');
    }

    const referenceId = new Types.ObjectId().toString();
    const label = RIDER_EARNING_TYPE_LABELS[type];
    const description = note?.trim() ? `${label}: ${note.trim()}` : label;
    const expenseAccount = type === 'wage' ? 'rider_wage_expense' : 'rider_payout_expense';

    const updated = await this.applyEarningAtomically(userId, amount, {
      type,
      amount,
      ...(note?.trim() ? { note: note.trim() } : {}),
      earnedAt: new Date(),
    });

    // Awaited (not fire-and-forget) — see creditEarning() above for why.
    try {
      await this.riderWalletService.creditEarning(userId, { referenceId, type, amount, description });
    } catch (err) {
      this.logger.error(
        `Wallet credit failed for rider ${userId}, manual earning ${referenceId} (${type}, ${amount}): ${(err as Error).message}`,
      );
    }

    void this.riderNotificationService
      .notifyEarningsCredited(userId, referenceId, type, amount, note)
      .catch(() => {});

    await this.ledgerService.post(
      `rider-earning:${referenceId}`,
      'rider_earning',
      referenceId,
      [
        {
          accountType: expenseAccount,
          direction: 'debit',
          amount,
          description: `${description} for rider ${userId}`,
        },
        {
          accountType: 'rider_payable',
          accountSubject: userId,
          direction: 'credit',
          amount,
          description: `Payable to rider ${userId}: ${description}`,
        },
      ],
    );

    return {
      amount,
      totalEarnings: updated.totalEarnings,
      todayEarnings: updated.todayEarnings,
    };
  }

  async getTasks(userId: string) {
    void this.riderNotificationService.syncOverduePickupReminders(userId).catch(() => {});
    const riderId = new Types.ObjectId(userId);
    const tasks = await this.orderModel.find({
      $or: [{ pickupRiderId: riderId }, { deliveryRiderId: riderId }],
      status: {
        $in: [
          OrderStatus.RIDER_ASSIGNED_PICKUP,
          OrderStatus.RIDER_ASSIGNED,
          OrderStatus.PICKED_UP,
          OrderStatus.IN_TRANSIT_TO_SHOP,
          OrderStatus.READY_FOR_DELIVERY,
          OrderStatus.RIDER_ASSIGNED_DELIVERY,
          OrderStatus.OUT_FOR_DELIVERY,
        ],
      },
    });
    return { success: true, data: tasks.map((task) => this.serializeActiveTask(task, userId)) };
  }

  async getActiveAssignment(userId: string) {
    const rider = await this.findOrCreate(userId);
    const riderId = new Types.ObjectId(userId);
    const orders = await this.orderModel.find({
      $or: [{ pickupRiderId: riderId }, { deliveryRiderId: riderId }],
      status: {
        $in: [
          OrderStatus.RIDER_ASSIGNED_PICKUP,
          OrderStatus.RIDER_ASSIGNED,
          OrderStatus.PICKED_UP,
          OrderStatus.IN_TRANSIT_TO_SHOP,
          OrderStatus.READY_FOR_DELIVERY,
          OrderStatus.RIDER_ASSIGNED_DELIVERY,
          OrderStatus.OUT_FOR_DELIVERY,
        ],
      },
    });

    const order = pickPrimaryActiveOrder(orders, userId);
    if (!order) {
      return { success: true, data: null };
    }

    const taskDetails = await buildRiderTaskDetails(
      order,
      {
        customerModel: this.customerModel,
        branchModel: this.branchModel,
        userModel: this.userModel,
        addressModel: this.addressModel,
      },
      {
        includeDialablePhone: false,
        customerAddressId:
          isPickupLeg(order, userId) ? order.pickupAddressId : order.deliveryAddressId,
      },
    );

    const [pickupAddressDoc, deliveryAddressDoc] = await Promise.all([
      this.addressModel.findById(order.pickupAddressId),
      this.addressModel.findById(order.deliveryAddressId),
    ]);

    const toNav = (addr: typeof pickupAddressDoc) =>
      addr
        ? {
            line1: addr.line1,
            city: addr.city,
            province: addr.province,
            latitude: addr.latitude,
            longitude: addr.longitude,
          }
        : null;

    const payload = buildActiveAssignmentPayload(
      order,
      userId,
      rider,
      taskDetails.customerName,
      toNav(pickupAddressDoc),
      toNav(deliveryAddressDoc),
      {
        line1: taskDetails.shopLocation.line1,
        city: taskDetails.shopLocation.city,
        province: taskDetails.shopLocation.province,
        latitude: taskDetails.shopLocation.latitude,
        longitude: taskDetails.shopLocation.longitude,
      },
    );

    return { success: true, data: payload };
  }

  private serializeActiveTask(task: OrderDocument, userId: string) {
    const isDeliveryRider = task.deliveryRiderId?.toString() === userId;
    const isPickupRider = task.pickupRiderId?.toString() === userId;
    const pickupLeg =
      isPickupRider &&
      (!isDeliveryRider ||
        [
          OrderStatus.RIDER_ASSIGNED_PICKUP,
          OrderStatus.RIDER_ASSIGNED,
          OrderStatus.PICKED_UP,
          OrderStatus.IN_TRANSIT_TO_SHOP,
        ].includes(task.status));

    return {
      _id: task._id.toString(),
      status: task.status,
      bookingType: task.bookingType,
      branchName: task.branchName,
      leg: pickupLeg ? ('pickup' as const) : ('delivery' as const),
      pickup: task.pickup
        ? {
            acceptedAt: task.pickup.acceptedAt,
            arrivedAt: task.pickup.arrivedAt,
            collectedAt: task.pickup.collectedAt,
            droppedAtShop: task.pickup.droppedAtShop,
          }
        : undefined,
      delivery: task.delivery
        ? {
            acceptedAt: task.delivery.acceptedAt,
            pickedUpFromShopAt: task.delivery.pickedUpFromShopAt,
            startedAt: task.delivery.startedAt,
          }
        : undefined,
    };
  }

  async getTaskHistory(userId: string, limit = 30) {
    const riderId = new Types.ObjectId(userId);
    const tasks = await this.orderModel
      .find({
        $or: [
          {
            pickupRiderId: riderId,
            'pickup.droppedAtShop': { $exists: true },
          },
          {
            deliveryRiderId: riderId,
            status: { $in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
          },
        ],
      })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('_id status bookingType branchName updatedAt pickup.droppedAtShop delivery.deliveredAt deliveryRiderId');

    return {
      success: true,
      data: tasks.map((task) => ({
        _id: task._id.toString(),
        status: task.status,
        bookingType: task.bookingType,
        branchName: task.branchName,
        completedAt:
          task.delivery?.deliveredAt ?? task.pickup?.droppedAtShop ?? task.updatedAt,
        leg:
          [OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(task.status) &&
          task.deliveryRiderId?.toString() === userId
            ? 'delivery'
            : 'pickup',
      })),
    };
  }

  async getCancelledTasks(userId: string, limit = 30) {
    const riderId = new Types.ObjectId(userId);
    const tasks = await this.orderModel
      .find({
        $or: [{ pickupRiderId: riderId }, { deliveryRiderId: riderId }],
        status: OrderStatus.CANCELLED,
      })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('_id status bookingType branchName updatedAt pickupRiderId deliveryRiderId');

    return {
      success: true,
      data: tasks.map((task) => ({
        _id: task._id.toString(),
        status: task.status,
        bookingType: task.bookingType,
        branchName: task.branchName,
        cancelledAt: task.updatedAt,
        leg:
          task.deliveryRiderId?.toString() === userId ? ('delivery' as const) : ('pickup' as const),
      })),
    };
  }

  async updateProfile(userId: string, dto: UpdateRiderProfileDto) {
    const rider = await this.findOrCreate(userId);
    const user = await this.userModel.findById(userId);

    if (dto.firstName !== undefined) rider.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) rider.lastName = dto.lastName.trim();
    if (dto.vehicleType !== undefined) rider.vehicleType = dto.vehicleType;
    if (dto.plateNumber !== undefined) rider.plateNumber = dto.plateNumber.trim();
    if (dto.orCrNumber !== undefined) rider.orCrNumber = dto.orCrNumber.trim();

    if (dto.homeAddress) {
      rider.homeAddress = {
        ...(rider.homeAddress ?? {}),
        ...(dto.homeAddress.line1 !== undefined ? { line1: dto.homeAddress.line1.trim() } : {}),
        ...(dto.homeAddress.line2 !== undefined ? { line2: dto.homeAddress.line2.trim() } : {}),
        ...(dto.homeAddress.city !== undefined ? { city: dto.homeAddress.city.trim() } : {}),
        ...(dto.homeAddress.province !== undefined
          ? { province: dto.homeAddress.province.trim() }
          : {}),
        ...(dto.homeAddress.postalCode !== undefined
          ? { postalCode: dto.homeAddress.postalCode.trim() }
          : {}),
      };
    }

    if (dto.phone !== undefined && user) {
      const phone = dto.phone.trim();
      if (phone !== user.phone) {
        const existing = await this.userModel.findOne({
          phone,
          _id: { $ne: user._id },
        });
        if (existing) {
          throw new ConflictException('Mobile number is already in use');
        }
        user.phone = phone;
        await user.save();
      }
    }

    await rider.save();
    return this.getMe(userId);
  }

  async updateEmployment(userId: string, dto: UpdateRiderEmploymentDto) {
    const rider = await this.findOrCreate(userId);

    if (dto.employmentType !== undefined) rider.employmentType = dto.employmentType;
    if (dto.fixedWageAmount !== undefined) rider.fixedWageAmount = dto.fixedWageAmount;
    if (dto.wageFrequency !== undefined) rider.wageFrequency = dto.wageFrequency;

    await rider.save();
    return this.getMe(userId);
  }

  async uploadDocument(userId: string, type: string, filename: string) {
    if (!isValidRiderDocumentType(type)) {
      throw new BadRequestException('Invalid document type');
    }

    const rider = await this.findOrCreate(userId);
    const fileUrl = riderDocumentPublicPath(filename);

    const previousDocument = (rider.documents ?? []).find((d) => d.type === type);
    const nextDocuments = (rider.documents ?? []).filter((d) => d.type !== type);
    nextDocuments.push({
      type: type as RiderDocumentType,
      fileUrl,
      status: 'pending',
      uploadedAt: new Date(),
      reviewedAt: undefined,
      reviewedBy: undefined,
      rejectionReason: undefined,
    });
    rider.documents = nextDocuments;
    await rider.save();
    if (previousDocument) {
      // Best-effort cleanup of the superseded file: the new document is already saved and
      // authoritative, so a failure to delete the old blob must not fail this request.
      await this.cloudinaryStorageService
        .deleteFile('lunara/rider-documents', previousDocument.fileUrl, 'private')
        .catch(() => {});
    }

    return this.getMe(userId);
  }

  async reviewDocument(
    riderUserId: string,
    type: string,
    adminUserId: string,
    status: 'approved' | 'rejected',
    rejectionReason?: string,
  ) {
    if (!isValidRiderDocumentType(type)) {
      throw new BadRequestException('Invalid document type');
    }
    if (status === 'rejected' && !rejectionReason?.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    const rider = await this.riderModel.findOne({ userId: new Types.ObjectId(riderUserId) });
    if (!rider) throw new NotFoundException('Rider not found');

    const doc = rider.documents?.find((d) => d.type === type);
    if (!doc?.fileUrl) {
      throw new BadRequestException('Document has not been uploaded');
    }

    doc.status = status;
    doc.reviewedAt = new Date();
    doc.reviewedBy = adminUserId;
    doc.rejectionReason = status === 'rejected' ? rejectionReason?.trim() : undefined;
    await rider.save();

    const user = await this.userModel.findById(riderUserId).select('email phone');
    return {
      success: true,
      data: this.serializeMePayload(riderUserId, rider, user),
    };
  }

  async getRiderProfileForAdmin(riderUserId: string) {
    const rider = await this.riderModel.findOne({ userId: new Types.ObjectId(riderUserId) });
    if (!rider) throw new NotFoundException('Rider not found');
    const user = await this.userModel.findById(riderUserId).select('email phone isActive');
    return {
      success: true,
      data: {
        ...this.serializeMePayload(riderUserId, rider, user),
        isActive: user?.isActive ?? true,
      },
    };
  }

  async listPendingDocumentReviews() {
    const riders = await this.riderModel
      .find({ 'documents.status': 'pending' })
      .sort({ updatedAt: -1 });
    const users = await this.userModel
      .find({ _id: { $in: riders.map((r) => r.userId) } })
      .select('email phone');

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    return {
      success: true,
      data: riders.flatMap((rider) => {
        const userId = rider.userId.toString();
        const user = userMap.get(userId);
        return (rider.documents ?? [])
          .filter((d) => d.status === 'pending' && d.fileUrl)
          .map((d) => ({
            userId,
            riderId: rider._id.toString(),
            email: user?.email,
            phone: user?.phone,
            firstName: rider.firstName,
            lastName: rider.lastName,
            document: d,
          }));
      }),
    };
  }

  async getEarnings(userId: string) {
    const rider = await this.findOrCreate(userId);
    this.ensureTodayBucket(rider);
    const riderId = new Types.ObjectId(userId);
    const { todayStart, weekStart, monthStart } = getEarningsPeriodStarts();

    const [todayPickups, todayDeliveries, weekEarnings, monthEarnings, recentEarnings] =
      await Promise.all([
        this.orderModel.countDocuments({
          pickupRiderId: riderId,
          'pickup.receiptCode': { $exists: true },
          updatedAt: { $gte: todayStart },
        }),
        this.orderModel.countDocuments({
          deliveryRiderId: riderId,
          status: { $in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
          updatedAt: { $gte: todayStart },
        }),
        this.riderWalletService.sumCreditsSince(userId, weekStart),
        this.riderWalletService.sumCreditsSince(userId, monthStart),
        this.riderWalletService.getRecentEarningEntries(userId, 30),
      ]);

    return {
      success: true,
      data: {
        todayEarnings: rider.todayEarnings,
        weekEarnings,
        monthEarnings,
        lifetimeEarnings: rider.totalEarnings,
        totalEarnings: rider.totalEarnings,
        todayPickups,
        todayDeliveries,
        recentEarnings,
      },
    };
  }

  async updateLocation(userId: string, dto: UpdateLocationDto) {
    const normalized = normalizeRiderLocationPayload(dto);
    const rider = await this.findOrCreate(userId);
    rider.currentLocation = {
      type: 'Point',
      coordinates: [normalized.longitude, normalized.latitude],
    };
    rider.lastLocationSpeed = normalized.speed;
    rider.lastLocationHeading = normalized.heading;
    rider.lastLocationRecordedAt = new Date(normalized.timestamp);
    await rider.save();
    return { success: true, data: riderLocationWirePayload(normalized) };
  }

  async setOnline(userId: string, isOnline: boolean) {
    const rider = await this.findOrCreate(userId);

    if (isOnline) {
      const user = await this.userModel.findById(userId).select('phone');
      const compliance = isRiderCompliant(rider, user);
      if (!compliance.isCompliant) {
        throw new ForbiddenException({
          message: 'Complete your profile and get all documents approved before going online',
          profileGaps: compliance.profileGaps,
          documentGaps: compliance.documentGaps,
        });
      }
    }

    rider.isOnline = isOnline;
    rider.shiftStatus = isOnline ? 'online' : 'offline';
    await rider.save();
    return {
      success: true,
      data: { isOnline, shiftStatus: rider.shiftStatus },
    };
  }

  async startBreak(userId: string) {
    const rider = await this.findOrCreate(userId);
    if (!rider.isOnline && rider.shiftStatus !== 'online') {
      throw new BadRequestException('Go online before taking a break');
    }
    rider.shiftStatus = 'break';
    rider.isOnline = false;
    await rider.save();
    return {
      success: true,
      data: { isOnline: false, shiftStatus: 'break' as const },
    };
  }

  async endBreak(userId: string) {
    const rider = await this.findOrCreate(userId);
    if (rider.shiftStatus !== 'break') {
      throw new BadRequestException('You are not on break');
    }
    rider.shiftStatus = 'online';
    rider.isOnline = true;
    await rider.save();
    return {
      success: true,
      data: { isOnline: true, shiftStatus: 'online' as const },
    };
  }

  async getPerformance(userId: string) {
    const data = await buildRiderPerformancePayload(this.orderModel, this.reviewModel, userId);
    return { success: true, data };
  }

  async findNearestOnline() {
    const rider = await this.riderModel.findOne({ isOnline: true });
    if (!rider) throw new NotFoundException('No online riders available');
    return rider;
  }
}
