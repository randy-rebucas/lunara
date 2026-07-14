import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '@lunara/types';
import {
  buildPartnerCoverageNotice,
  canTransitionOrderStatus,
  isPaymongoMethod,
  type PartnerCoverageInfo,
} from '@lunara/utils';
import { BranchesService } from '../branches/branches.service';
import { RiderAssignmentService } from '../riders/rider-assignment.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { WalletsService } from '../wallets/wallets.service';
import { LedgerService } from '../ledger/ledger.service';
import { AssignRiderDto, CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import {
  buildOrderPaymentSummary,
  loadLatestOrderPaymentsByOrderId,
} from '../payments/payment-summary';
import { PromotionsService } from '../promotions/promotions.service';
import { LaundryTagsService } from '../laundry-tags/laundry-tags.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { assertOrderPortalAccess, resolvePortalBranchId } from '../partner/partner-access';
import { Order, OrderDocument } from './schemas/order.schema';

export interface BookingOrderPayload {
  bookingType: CreateOrderDto['bookingType'];
  items: CreateOrderDto['items'];
  pickupAddressId: string;
  deliveryAddressId: string;
  scheduledPickupAt: string;
  scheduledDeliveryAt?: string;
  couponCode?: string;
  estimatedWeightKg: number;
  bagSizeId?: string;
  bagSizeLabel?: string;
  addons: { id: string; label: string; price: number }[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  branchId?: string;
  branchCode?: string;
  branchName?: string;
  partnerId?: string;
  baseSubtotal?: number;
  pricingModel?: 'shop_markup' | 'commission';
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private trackingGateway: TrackingGateway,
    private riderAssignmentService: RiderAssignmentService,
    private walletsService: WalletsService,
    private branchesService: BranchesService,
    private promotionsService: PromotionsService,
    private ledgerService: LedgerService,
    private laundryTagsService: LaundryTagsService,
  ) {}

  private isBranchAssigned(order: OrderDocument) {
    return Boolean(order.branchId || order.branchName);
  }

  private async resolvePartnerCoverage(order: OrderDocument): Promise<PartnerCoverageInfo> {
    if (this.isBranchAssigned(order)) {
      return buildPartnerCoverageNotice({
        inServiceArea: true,
        hasPartnerNearby: true,
        branchAssigned: true,
      });
    }

    const coverage = await this.branchesService.evaluatePartnerCoverageForAddressId(
      order.pickupAddressId,
    );

    return (
      coverage ?? {
        hasPartnerNearby: false,
        inServiceArea: false,
        message:
          'We could not verify partner laundry coverage for this order address. Contact support if you have questions.',
      }
    );
  }

  private shouldShowPartnerCoverage(order: OrderDocument) {
    return (
      order.status === OrderStatus.PENDING_DISPATCH && !this.isBranchAssigned(order)
    );
  }

  private async loadLatestOrderPaymentsByOrderId(orderIds: Types.ObjectId[]) {
    return loadLatestOrderPaymentsByOrderId(this.paymentModel, orderIds);
  }

  private enrichOrderWithPayment(
    order: OrderDocument,
    payment: PaymentDocument | undefined,
  ) {
    return { ...order.toObject(), ...buildOrderPaymentSummary(payment) };
  }

  private async enrichCustomerOrders(orders: OrderDocument[]) {
    const coverageByAddress = new Map<string, PartnerCoverageInfo>();
    const paymentsByOrderId = await this.loadLatestOrderPaymentsByOrderId(
      orders.map((o) => o._id),
    );
    const branchIds = orders.flatMap((o) => (o.branchId ? [o.branchId] : []));
    const logoUrlsByBranchId = await this.branchesService.getLogoUrlsByIds(branchIds);

    return Promise.all(
      orders.map(async (order) => {
        const payment = paymentsByOrderId.get(order._id.toString());
        const base = {
          ...this.enrichOrderWithPayment(order, payment),
          branchLogoUrl: order.branchId
            ? logoUrlsByBranchId.get(order.branchId.toString())
            : undefined,
        };

        if (!this.shouldShowPartnerCoverage(order)) {
          return base;
        }

        const addressKey = order.pickupAddressId;
        let coverage = coverageByAddress.get(addressKey);
        if (!coverage) {
          coverage = await this.resolvePartnerCoverage(order);
          coverageByAddress.set(addressKey, coverage);
        }
        return { ...base, partnerCoverage: coverage };
      }),
    );
  }

  async create(customerId: string, dto: CreateOrderDto) {
    const subtotal = dto.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const deliveryFee = 50;
    const discount = 0;
    const total = subtotal + deliveryFee - discount;

    const order = await this.orderModel.create({
      customerId: new Types.ObjectId(customerId),
      bookingType: dto.bookingType,
      items: dto.items,
      pickupAddressId: dto.pickupAddressId,
      deliveryAddressId: dto.deliveryAddressId,
      scheduledPickupAt: new Date(dto.scheduledPickupAt),
      scheduledDeliveryAt: dto.scheduledDeliveryAt ? new Date(dto.scheduledDeliveryAt) : undefined,
      status: OrderStatus.PENDING,
      subtotal,
      deliveryFee,
      discount,
      total,
      statusHistory: [{ status: OrderStatus.PENDING, timestamp: new Date() }],
    });

    return { success: true, data: order };
  }

  async createFromBooking(customerId: string, payload: BookingOrderPayload) {
    const order = await this.orderModel.create({
      customerId: new Types.ObjectId(customerId),
      partnerId: payload.partnerId ? new Types.ObjectId(payload.partnerId) : undefined,
      branchId: payload.branchId ? new Types.ObjectId(payload.branchId) : undefined,
      branchCode: payload.branchCode,
      branchName: payload.branchName,
      bookingType: payload.bookingType,
      items: payload.items,
      pickupAddressId: payload.pickupAddressId,
      deliveryAddressId: payload.deliveryAddressId,
      scheduledPickupAt: new Date(payload.scheduledPickupAt),
      scheduledDeliveryAt: payload.scheduledDeliveryAt
        ? new Date(payload.scheduledDeliveryAt)
        : undefined,
      estimatedWeightKg: payload.estimatedWeightKg,
      bagSizeId: payload.bagSizeId,
      bagSizeLabel: payload.bagSizeLabel,
      addons: payload.addons,
      status: OrderStatus.PENDING,
      subtotal: payload.subtotal,
      deliveryFee: payload.deliveryFee,
      discount: payload.discount,
      couponCode: payload.couponCode,
      total: payload.total,
      baseSubtotal: payload.baseSubtotal,
      pricingModel: payload.pricingModel,
      statusHistory: [{ status: OrderStatus.PENDING, timestamp: new Date() }],
    });

    if (payload.couponCode) {
      await this.promotionsService.recordRedemption(
        customerId,
        payload.couponCode,
        order._id.toString(),
      );
    }

    return { success: true, data: order };
  }

  async getPartnerQueue(status?: string) {
    const filter: Record<string, unknown> = {
      status: {
        $nin: [OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.COMPLETED],
      },
    };
    if (status) filter.status = status;

    const items = await this.orderModel.find(filter).sort({ createdAt: -1 }).limit(100);
    const grouped = items.reduce(
      (acc, order) => {
        const s = order.status;
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return { success: true, data: { items, counts: grouped } };
  }

  async findAll(user: { sub: string; role: UserRole }, page: number, limit: number) {
    const userId = new Types.ObjectId(user.sub);
    const filter =
      user.role === UserRole.CUSTOMER
        ? { customerId: userId }
        : user.role === UserRole.RIDER
          ? { $or: [{ pickupRiderId: userId }, { deliveryRiderId: userId }] }
          : {};

    const skip = (page - 1) * limit;
    const [rawItems, total] = await Promise.all([
      this.orderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.orderModel.countDocuments(filter),
    ]);

    const items =
      user.role === UserRole.CUSTOMER
        ? await this.enrichCustomerOrders(rawItems)
        : rawItems;

    return {
      success: true,
      data: { items, total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, user: { sub: string; role: UserRole }) {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    if (user.role === UserRole.CUSTOMER && order.customerId.toString() !== user.sub) {
      throw new ForbiddenException();
    }
    if (user.role === UserRole.RIDER) {
      const isPickupRider = order.pickupRiderId?.toString() === user.sub;
      const isDeliveryRider = order.deliveryRiderId?.toString() === user.sub;
      if (!isPickupRider && !isDeliveryRider) throw new ForbiddenException();
    }
    if (user.role === UserRole.PARTNER || user.role === UserRole.STAFF) {
      const staffBranchId = await resolvePortalBranchId(this.userModel, user.sub, user.role);
      assertOrderPortalAccess(order, user.sub, user.role, staffBranchId);
    }

    const data =
      user.role === UserRole.CUSTOMER
        ? (await this.enrichCustomerOrders([order]))[0]
        : order;

    return { success: true, data };
  }

  async assignRider(
    orderId: string,
    riderId?: string,
    type: AssignRiderDto['type'] = 'pickup',
    assignedByUserId?: string,
  ) {
    if (type === 'pickup') {
      if (!riderId) {
        throw new BadRequestException('riderId is required for pickup assignment');
      }
      return this.riderAssignmentService.assignPickupRider(
        orderId,
        riderId,
        assignedByUserId,
        'admin_direct',
      );
    }

    if (!riderId) {
      throw new BadRequestException('riderId is required for delivery assignment');
    }
    return this.riderAssignmentService.assignDeliveryRider(
      orderId,
      riderId,
      assignedByUserId,
      'admin_direct',
    );
  }

  async cancelByCustomer(customerId: string, orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId.toString() !== customerId) {
      throw new ForbiddenException();
    }

    if (order.status === OrderStatus.PENDING) {
      const paid = await this.paymentModel.findOne({
        orderId: order._id,
        status: PaymentStatus.PAID,
      });
      if (paid) {
        throw new BadRequestException('This order has already been paid');
      }

      await this.paymentModel.deleteMany({ orderId: order._id });
      await order.deleteOne();

      return { success: true, data: { deleted: true } };
    }

    if (order.status === OrderStatus.PENDING_DISPATCH) {
      if (order.branchId) {
        throw new BadRequestException(
          'This order has already been assigned to a shop and cannot be cancelled',
        );
      }

      const paidPayment = await this.paymentModel
        .findOne({ orderId: order._id, status: PaymentStatus.PAID })
        .sort({ createdAt: -1 });

      let refunded = false;
      if (
        paidPayment &&
        paidPayment.status !== PaymentStatus.REFUNDED &&
        (paidPayment.method === PaymentMethod.WALLET || isPaymongoMethod(paidPayment.method))
      ) {
        await this.walletsService.credit(
          customerId,
          paidPayment.amount,
          `refund-order-${orderId}`,
          `Refund for cancelled order ${orderId}`,
        );
        paidPayment.status = PaymentStatus.REFUNDED;
        await paidPayment.save();

        await this.ledgerService.post(
          `cancel-refund:${paidPayment._id.toString()}`,
          'refund',
          paidPayment._id.toString(),
          [
            {
              accountType: 'order_revenue_clearing',
              direction: 'debit',
              amount: paidPayment.amount,
              description: `Refund reverses recognized revenue for cancelled order ${orderId.slice(-6)}`,
            },
            {
              accountType: 'customer_wallet_liability',
              accountSubject: customerId,
              direction: 'credit',
              amount: paidPayment.amount,
              description: `Refund credited to wallet for cancelled order ${orderId.slice(-6)}`,
            },
          ],
        );

        refunded = true;
      }

      order.status = OrderStatus.CANCELLED;
      order.statusHistory.push({
        status: OrderStatus.CANCELLED,
        timestamp: new Date(),
        note: 'Cancelled by customer before shop dispatch',
        updatedBy: customerId,
      });
      await order.save();

      this.trackingGateway.emitOrderStatus(order._id.toString(), OrderStatus.CANCELLED);
      this.trackingGateway.emitDispatchQueueUpdated({
        reason: 'customer_cancelled',
        orderId: order._id.toString(),
      });

      return { success: true, data: { cancelled: true, refunded } };
    }

    throw new BadRequestException('This order can no longer be cancelled');
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, updatedBy: string) {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    const nextStatus = dto.status as OrderStatus;
    if (!canTransitionOrderStatus(order.status, nextStatus)) {
      throw new ForbiddenException(`Cannot transition from ${order.status} to ${nextStatus}`);
    }

    order.status = nextStatus;
    order.statusHistory.push({
      status: nextStatus,
      timestamp: new Date(),
      note: dto.note,
      updatedBy,
    });
    await order.save();

    this.trackingGateway.emitOrderStatus(order._id.toString(), nextStatus);

    const updated = await this.orderModel.findById(id);
    return { success: true, data: updated };
  }

  async markCustomerPickup(id: string, updatedBy: string) {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== OrderStatus.READY_FOR_DELIVERY) {
      throw new BadRequestException(
        `Order must be in READY_FOR_DELIVERY status to mark as customer pickup (current: ${order.status})`,
      );
    }

    order.fulfillmentType = 'customer_pickup';
    order.status = OrderStatus.CUSTOMER_PICKUP;
    order.statusHistory.push({
      status: OrderStatus.CUSTOMER_PICKUP,
      timestamp: new Date(),
      note: 'Customer will collect laundry at the shop',
      updatedBy,
    });
    await order.save();

    this.trackingGateway.emitOrderStatus(order._id.toString(), OrderStatus.CUSTOMER_PICKUP);

    return { success: true, data: await this.orderModel.findById(id) };
  }

  async completeCustomerPickup(id: string, updatedBy: string) {
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== OrderStatus.CUSTOMER_PICKUP) {
      throw new BadRequestException(
        `Order must be in CUSTOMER_PICKUP status to confirm collection (current: ${order.status})`,
      );
    }

    order.customerPickupAt = new Date();
    order.status = OrderStatus.COMPLETED;
    order.statusHistory.push({
      status: OrderStatus.COMPLETED,
      timestamp: new Date(),
      note: 'Customer collected laundry at the shop',
      updatedBy,
    });
    await order.save();
    await this.laundryTagsService.releaseFromOrder(id, 'delivered');

    this.trackingGateway.emitOrderStatus(order._id.toString(), OrderStatus.COMPLETED);

    return { success: true, data: await this.orderModel.findById(id) };
  }
}
