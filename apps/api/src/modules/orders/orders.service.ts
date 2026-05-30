import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus, UserRole } from '@lunara/types';
import { canTransitionOrderStatus } from '@lunara/utils';
import { RiderAssignmentService } from '../riders/rider-assignment.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { AssignRiderDto, CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
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
  addons: { id: string; label: string; price: number }[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  branchId?: string;
  branchCode?: string;
  branchName?: string;
  partnerId?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private trackingGateway: TrackingGateway,
    private riderAssignmentService: RiderAssignmentService,
  ) {}

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
      addons: payload.addons,
      status: OrderStatus.PENDING,
      subtotal: payload.subtotal,
      deliveryFee: payload.deliveryFee,
      discount: payload.discount,
      total: payload.total,
      statusHistory: [{ status: OrderStatus.PENDING, timestamp: new Date() }],
    });

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
    const [items, total] = await Promise.all([
      this.orderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.orderModel.countDocuments(filter),
    ]);

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

    return { success: true, data: order };
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
}
