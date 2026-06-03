import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus } from '@lunara/types';
import { computePickupSla } from '@lunara/utils';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';
import { OrdersService } from '../orders/orders.service';
import { PickupService } from '../riders/pickup.service';
import { RiderAssignmentService } from '../riders/rider-assignment.service';
import { BranchesService } from '../branches/branches.service';
import { SupportService } from '../support/support.service';

@Injectable()
export class AdminOperationsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    private ordersService: OrdersService,
    private pickupService: PickupService,
    private riderAssignmentService: RiderAssignmentService,
    private branchesService: BranchesService,
    private supportService: SupportService,
  ) {}

  async getControlTower() {
    const [
      pendingDispatch,
      awaitingPartnerAccept,
      awaitingPickupRider,
      awaitingDeliveryRider,
      slaBreaches,
      conflicts,
      openTickets,
    ] = await Promise.all([
      this.branchesService.countPendingDispatch(),
      this.orderModel.countDocuments({
        dispatchStatus: 'dispatched',
        partnerAcceptedAt: { $exists: false },
        status: { $nin: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
      }),
      this.orderModel.countDocuments({
        dispatchStatus: 'dispatched',
        partnerAcceptedAt: { $exists: true },
        pickupRiderId: { $exists: false },
        status: { $in: [OrderStatus.SHOP_ASSIGNED, OrderStatus.CONFIRMED] },
      }),
      this.orderModel.countDocuments({
        status: OrderStatus.READY_FOR_DELIVERY,
        deliveryRiderId: { $exists: false },
      }),
      this.countSlaBreaches(),
      this.orderModel.countDocuments({ operationsConflict: true }),
      this.supportService.countOpenTickets(),
    ]);

    const watchlist = await this.orderModel
      .find({
        $or: [
          { status: OrderStatus.PENDING_DISPATCH },
          { dispatchStatus: 'dispatched', partnerAcceptedAt: { $exists: false } },
          { operationsConflict: true },
          {
            status: OrderStatus.READY_FOR_DELIVERY,
            deliveryRiderId: { $exists: false },
          },
        ],
        status: { $nin: [OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.COMPLETED] },
      })
      .sort({ scheduledPickupAt: 1 })
      .limit(25);

    return {
      success: true,
      data: {
        counts: {
          pendingDispatch,
          awaitingPartnerAccept,
          awaitingPickupRider,
          awaitingDeliveryRider,
          slaBreaches,
          conflicts,
          openTickets,
        },
        watchlist: await Promise.all(watchlist.map((o) => this.serializeOpsOrder(o))),
      },
    };
  }

  async getOrderOperations(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const customer = await this.userModel.findById(order.customerId).select('email phone');
    let pickupSuggestions: Awaited<
      ReturnType<RiderAssignmentService['suggestPickupRider']>
    >['data'] | null = null;
    if (
      order.branchId &&
      order.partnerAcceptedAt &&
      (order.status === OrderStatus.SHOP_ASSIGNED || order.status === OrderStatus.CONFIRMED) &&
      !order.pickupRiderId
    ) {
      try {
        const s = await this.riderAssignmentService.suggestPickupRider(orderId);
        pickupSuggestions = s.data;
      } catch {
        pickupSuggestions = null;
      }
    }

    let deliverySuggestions: Awaited<
      ReturnType<RiderAssignmentService['suggestDeliveryRider']>
    >['data'] | null = null;
    if (
      order.partnerAcceptedAt &&
      order.status === OrderStatus.READY_FOR_DELIVERY &&
      !order.deliveryRiderId
    ) {
      try {
        const s = await this.riderAssignmentService.suggestDeliveryRider(orderId);
        deliverySuggestions = s.data;
      } catch {
        deliverySuggestions = null;
      }
    }

    const riders = await this.riderModel.find({ isOnline: true }).limit(30);
    const riderUsers = await this.userModel
      .find({ _id: { $in: riders.map((r) => r.userId) } })
      .select('email');

    return {
      success: true,
      data: {
        order: await this.serializeOpsOrder(order),
        customer: customer
          ? { email: customer.email, phone: customer.phone }
          : null,
        pickupRiderSuggestions: pickupSuggestions,
        suggestedPickupRiderId: order.suggestedPickupRiderId?.toString() ?? null,
        deliveryRiderSuggestions: deliverySuggestions,
        suggestedDeliveryRiderId: order.suggestedDeliveryRiderId?.toString() ?? null,
        awaitingDeliveryDispatchAt: order.awaitingDeliveryDispatchAt,
        availableRiders: riders.map((r) => {
          const u = riderUsers.find((x) => x._id.toString() === r.userId.toString());
          return {
            userId: r.userId.toString(),
            email: u?.email,
            isOnline: r.isOnline,
          };
        }),
      },
    };
  }

  async suggestPickupRider(orderId: string) {
    return this.riderAssignmentService.suggestPickupRider(orderId);
  }

  async confirmPickupRider(orderId: string, adminUserId: string, riderId?: string) {
    return this.riderAssignmentService.confirmSuggestedPickupRider(
      orderId,
      adminUserId,
      riderId,
    );
  }

  async suggestDeliveryRider(orderId: string) {
    return this.riderAssignmentService.suggestDeliveryRider(orderId);
  }

  async confirmDeliveryRider(orderId: string, adminUserId: string, riderId?: string) {
    return this.riderAssignmentService.confirmSuggestedDeliveryRider(
      orderId,
      adminUserId,
      riderId,
    );
  }

  async assignRider(
    orderId: string,
    riderId: string,
    adminUserId: string,
    type: 'pickup' | 'delivery' = 'pickup',
  ) {
    return this.ordersService.assignRider(orderId, riderId, type, adminUserId);
  }

  async triggerPickupDispatch(orderId: string) {
    return this.pickupService.dispatchPickupSearch(orderId);
  }

  async flagConflict(orderId: string, note: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    order.operationsConflict = true;
    order.operationsConflictNote = note;
    order.statusHistory.push({
      status: order.status,
      timestamp: new Date(),
      note: `Conflict flagged: ${note}`,
    });
    await order.save();
    return { success: true, data: await this.serializeOpsOrder(order) };
  }

  async resolveConflict(orderId: string, resolution: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    order.operationsConflict = false;
    order.statusHistory.push({
      status: order.status,
      timestamp: new Date(),
      note: `Conflict resolved: ${resolution}`,
    });
    await order.save();
    return { success: true, data: await this.serializeOpsOrder(order) };
  }

  private async countSlaBreaches() {
    const orders = await this.orderModel
      .find({
        dispatchStatus: 'dispatched',
        status: {
          $in: [
            OrderStatus.SHOP_ASSIGNED,
            OrderStatus.CONFIRMED,
            OrderStatus.RIDER_ASSIGNED_PICKUP,
            OrderStatus.RIDER_ASSIGNED,
          ],
        },
      })
      .select('status scheduledPickupAt slaPickupDueAt dispatchStatus partnerAcceptedAt pickupRiderId pickup')
      .limit(200);

    return orders.filter((o) => {
      const sla = computePickupSla({
        status: o.status,
        scheduledPickupAt: o.slaPickupDueAt ?? o.scheduledPickupAt,
        dispatchStatus: o.dispatchStatus,
        partnerAcceptedAt: o.partnerAcceptedAt,
        pickupRiderId: o.pickupRiderId?.toString(),
        pickupCollectedAt: o.pickup?.collectedAt,
      });
      return sla.status === 'breached';
    }).length;
  }

  private async serializeOpsOrder(order: OrderDocument) {
    const sla = computePickupSla({
      status: order.status,
      scheduledPickupAt: order.slaPickupDueAt ?? order.scheduledPickupAt,
      dispatchStatus: order.dispatchStatus,
      partnerAcceptedAt: order.partnerAcceptedAt,
      pickupRiderId: order.pickupRiderId?.toString(),
      pickupCollectedAt: order.pickup?.collectedAt,
    });

    return {
      _id: order._id.toString(),
      status: order.status,
      bookingType: order.bookingType,
      total: order.total,
      dispatchStatus: order.dispatchStatus,
      branchName: order.branchName,
      branchCode: order.branchCode,
      partnerAcceptedAt: order.partnerAcceptedAt,
      pickupRequestedAt: order.pickupRequestedAt,
      deliveryRequestedAt: order.deliveryRequestedAt,
      pickupRiderId: order.pickupRiderId?.toString(),
      deliveryRiderId: order.deliveryRiderId?.toString(),
      scheduledPickupAt: order.scheduledPickupAt,
      operationsConflict: order.operationsConflict,
      operationsConflictNote: order.operationsConflictNote,
      sla,
    };
  }
}
