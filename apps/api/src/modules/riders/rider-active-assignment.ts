import { OrderStatus } from '@lunara/types';
import {
  DELIVERY_WORKFLOW_STEPS,
  distanceKm,
  getDeliveryWorkflowStepIndex,
  getPickupWorkflowStepIndex,
  PICKUP_WORKFLOW_STEPS,
  resolveCoordinates,
} from '@lunara/utils';
import { OrderDocument } from '../orders/schemas/order.schema';
import { RiderDocument } from './schemas/rider.schema';
import { formatRiderOrderNumber } from './rider-task-summary';

const ACTIVE_STATUSES = [
  OrderStatus.RIDER_ASSIGNED_PICKUP,
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT_TO_SHOP,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.RIDER_ASSIGNED_DELIVERY,
  OrderStatus.OUT_FOR_DELIVERY,
] as const;

type NavTarget = {
  line1: string;
  city: string;
  province?: string;
  latitude?: number;
  longitude?: number;
};

export type ActiveAssignmentPayload = {
  orderId: string;
  orderNumber: string;
  customerName?: string;
  bookingType: string;
  serviceType: string;
  status: string;
  leg: 'pickup' | 'delivery';
  distanceKm: number | null;
  distanceLabel: string;
  etaMinutes: number | null;
  etaLabel: string;
  workflowStep: number;
  workflowTotal: number;
  workflowLabel: string;
  navigateTarget: NavTarget;
};

export function isPickupLeg(order: OrderDocument, userId: string) {
  const isDeliveryRider = order.deliveryRiderId?.toString() === userId;
  const isPickupRider = order.pickupRiderId?.toString() === userId;
  return (
    isPickupRider &&
    (!isDeliveryRider ||
      [
        OrderStatus.RIDER_ASSIGNED_PICKUP,
        OrderStatus.RIDER_ASSIGNED,
        OrderStatus.PICKED_UP,
        OrderStatus.IN_TRANSIT_TO_SHOP,
      ].includes(order.status))
  );
}

function taskPriority(order: OrderDocument, userId: string): number {
  const leg = isPickupLeg(order, userId) ? 'pickup' : 'delivery';
  const p = order.pickup;
  const d = order.delivery;

  if (order.status === OrderStatus.OUT_FOR_DELIVERY) return 500;
  if (order.status === OrderStatus.PICKED_UP || order.status === OrderStatus.IN_TRANSIT_TO_SHOP) {
    return 450;
  }
  if (leg === 'pickup' && p?.arrivedAt) return 400;
  if (leg === 'pickup' && p?.acceptedAt) return 300;
  if (leg === 'delivery' && d?.pickedUpFromShopAt) return 350;
  if (leg === 'delivery' && d?.acceptedAt) return 250;
  return 200;
}

export function pickPrimaryActiveOrder(orders: OrderDocument[], userId: string) {
  return [...orders]
    .filter((order) => ACTIVE_STATUSES.includes(order.status as (typeof ACTIVE_STATUSES)[number]))
    .sort((a, b) => {
      const priorityDiff = taskPriority(b, userId) - taskPriority(a, userId);
      if (priorityDiff !== 0) return priorityDiff;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    })[0];
}

function resolveNavigateTarget(
  order: OrderDocument,
  leg: 'pickup' | 'delivery',
  pickupAddress: NavTarget | null,
  deliveryAddress: NavTarget | null,
  shopLocation: NavTarget,
): NavTarget {
  if (leg === 'pickup') {
    if (
      order.status === OrderStatus.PICKED_UP ||
      order.status === OrderStatus.IN_TRANSIT_TO_SHOP
    ) {
      return shopLocation;
    }
    return pickupAddress ?? shopLocation;
  }

  if (order.status === OrderStatus.OUT_FOR_DELIVERY) {
    return deliveryAddress ?? shopLocation;
  }

  return shopLocation;
}

function estimateEtaMinutes(distance: number | null) {
  if (distance == null || distance <= 0) return null;
  return Math.max(1, Math.ceil((distance / 25) * 60));
}

export function buildActiveAssignmentPayload(
  order: OrderDocument,
  userId: string,
  rider: RiderDocument,
  customerName: string | undefined,
  pickupAddress: NavTarget | null,
  deliveryAddress: NavTarget | null,
  shopLocation: NavTarget,
): ActiveAssignmentPayload {
  const leg = isPickupLeg(order, userId) ? 'pickup' : 'delivery';
  const navigateTarget = resolveNavigateTarget(
    order,
    leg,
    pickupAddress,
    deliveryAddress,
    shopLocation,
  );

  const riderCoords = rider.currentLocation?.coordinates as [number, number] | undefined;
  const destCoords = resolveCoordinates(
    navigateTarget.city,
    navigateTarget.latitude,
    navigateTarget.longitude,
  );

  let distance: number | null = null;
  if (riderCoords?.length === 2) {
    distance = Math.round(distanceKm(riderCoords, destCoords) * 10) / 10;
  }

  const etaMinutes = estimateEtaMinutes(distance);
  const pickupLeg = leg === 'pickup';
  const workflowStep = pickupLeg
    ? getPickupWorkflowStepIndex({ status: order.status, pickup: order.pickup })
    : getDeliveryWorkflowStepIndex({ status: order.status, delivery: order.delivery });
  const workflowTotal = pickupLeg ? PICKUP_WORKFLOW_STEPS.length : DELIVERY_WORKFLOW_STEPS.length;
  const workflowLabel = pickupLeg
    ? PICKUP_WORKFLOW_STEPS[workflowStep]?.label ?? 'Pickup'
    : DELIVERY_WORKFLOW_STEPS[workflowStep]?.label ?? 'Delivery';

  return {
    orderId: order._id.toString(),
    orderNumber: formatRiderOrderNumber(order._id.toString()),
    customerName,
    bookingType: order.bookingType,
    serviceType: order.bookingType.replace(/_/g, ' '),
    status: order.status,
    leg,
    distanceKm: distance,
    distanceLabel: distance != null ? `${distance} km` : '—',
    etaMinutes,
    etaLabel: etaMinutes != null ? `${etaMinutes} min` : '—',
    workflowStep,
    workflowTotal,
    workflowLabel,
    navigateTarget,
  };
}
