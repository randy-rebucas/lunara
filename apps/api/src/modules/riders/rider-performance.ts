import { OrderStatus } from '@lunara/types';
import { Model, Types } from 'mongoose';
import { OrderDocument } from '../orders/schemas/order.schema';
import { ReviewDocument } from '../reviews/schemas/review.schema';

export type RiderPerformancePayload = {
  completionRate: number;
  acceptanceRate: number;
  onTimeDeliveryRate: number;
  customerRating: number | null;
  completedTasks: number;
  cancelledTasks: number;
  acceptedAssignments: number;
  totalAssignments: number;
  onTimeDeliveries: number;
  ratedDeliveries: number;
};

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 100;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export async function buildRiderPerformancePayload(
  orderModel: Model<OrderDocument>,
  reviewModel: Model<ReviewDocument>,
  userId: string,
): Promise<RiderPerformancePayload> {
  const riderId = new Types.ObjectId(userId);
  const riderFilter = { $or: [{ pickupRiderId: riderId }, { deliveryRiderId: riderId }] };

  const [
    completedPickups,
    completedDeliveries,
    cancelledTasks,
    acceptedPickups,
    acceptedDeliveries,
    totalPickupAssignments,
    totalDeliveryAssignments,
    onTimeDeliveries,
    ratedOrders,
    deliveriesWithSchedule,
  ] = await Promise.all([
    orderModel.countDocuments({
      pickupRiderId: riderId,
      'pickup.receiptCode': { $exists: true },
    }),
    orderModel.countDocuments({
      deliveryRiderId: riderId,
      status: { $in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
    }),
    orderModel.countDocuments({ ...riderFilter, status: OrderStatus.CANCELLED }),
    orderModel.countDocuments({ pickupRiderId: riderId, 'pickup.acceptedAt': { $exists: true } }),
    orderModel.countDocuments({
      deliveryRiderId: riderId,
      'delivery.acceptedAt': { $exists: true },
    }),
    orderModel.countDocuments({ pickupRiderId: riderId }),
    orderModel.countDocuments({ deliveryRiderId: riderId }),
    orderModel.countDocuments({
      deliveryRiderId: riderId,
      status: { $in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
      scheduledDeliveryAt: { $exists: true },
      'delivery.deliveredAt': { $exists: true },
      $expr: { $lte: ['$delivery.deliveredAt', '$scheduledDeliveryAt'] },
    }),
    orderModel
      .find({
        deliveryRiderId: riderId,
        status: { $in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
      })
      .select('_id')
      .lean(),
    orderModel.countDocuments({
      deliveryRiderId: riderId,
      status: { $in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
      scheduledDeliveryAt: { $exists: true },
      'delivery.deliveredAt': { $exists: true },
    }),
  ]);

  const completedTasks = completedPickups + completedDeliveries;
  const acceptedAssignments = acceptedPickups + acceptedDeliveries;
  const totalAssignments = totalPickupAssignments + totalDeliveryAssignments;

  // `ratedOrders` is every completed delivery assigned to this rider — it's the candidate set a
  // review could exist for, not the count that actually received one. `ratedDeliveries` below must
  // come from the aggregate's own count of matched review documents, not ratedOrders.length.
  let customerRating: number | null = null;
  let ratedDeliveries = 0;
  if (ratedOrders.length > 0) {
    const orderIds = ratedOrders.map((o) => o._id);
    const agg = await reviewModel.aggregate<{ avg: number; count: number }>([
      { $match: { orderId: { $in: orderIds } } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    if (agg[0]?.avg != null) {
      customerRating = Math.round(agg[0].avg * 10) / 10;
      ratedDeliveries = agg[0].count;
    }
  }

  return {
    completionRate: pct(completedTasks, completedTasks + cancelledTasks),
    acceptanceRate: pct(acceptedAssignments, totalAssignments),
    onTimeDeliveryRate: pct(onTimeDeliveries, deliveriesWithSchedule),
    customerRating,
    completedTasks,
    cancelledTasks,
    acceptedAssignments,
    totalAssignments,
    onTimeDeliveries,
    ratedDeliveries,
  };
}
