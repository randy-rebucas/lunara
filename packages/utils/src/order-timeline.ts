import { OrderStatus } from '@lunara/types';

export type TimelineStepState = 'done' | 'current' | 'upcoming';

export interface CustomerTimelineStep {
  id: string;
  label: string;
  milestone: OrderStatus;
  state: TimelineStepState;
  timestamp?: string;
  note?: string;
}

/** Customer-facing milestones (ironing omitted; covered while between folding and QC). */
export const CUSTOMER_TRACK_TIMELINE: { id: string; label: string; milestone: OrderStatus }[] = [
  { id: 'order_created', label: 'Order Created', milestone: OrderStatus.PENDING },
  { id: 'pending_dispatch', label: 'Pending Dispatch', milestone: OrderStatus.PENDING_DISPATCH },
  { id: 'shop_assigned', label: 'Shop Assigned', milestone: OrderStatus.SHOP_ASSIGNED },
  {
    id: 'rider_assigned_pickup',
    label: 'Rider Assigned (Pickup)',
    milestone: OrderStatus.RIDER_ASSIGNED_PICKUP,
  },
  { id: 'picked_up', label: 'Picked Up', milestone: OrderStatus.PICKED_UP },
  {
    id: 'in_transit_to_shop',
    label: 'In Transit to Shop',
    milestone: OrderStatus.IN_TRANSIT_TO_SHOP,
  },
  {
    id: 'received_at_shop',
    label: 'Received at Shop',
    milestone: OrderStatus.RECEIVED_AT_SHOP,
  },
  { id: 'laundry_received', label: 'Received', milestone: OrderStatus.RECEIVED },
  { id: 'sorting', label: 'Sorting', milestone: OrderStatus.SORTING },
  { id: 'washing', label: 'Washing', milestone: OrderStatus.WASHING },
  { id: 'drying', label: 'Drying', milestone: OrderStatus.DRYING },
  { id: 'folding', label: 'Folding', milestone: OrderStatus.FOLDING },
  { id: 'quality_check', label: 'Quality Check', milestone: OrderStatus.QUALITY_CHECK },
  { id: 'ready_for_delivery', label: 'Ready For Delivery', milestone: OrderStatus.READY_FOR_DELIVERY },
  {
    id: 'rider_assigned_delivery',
    label: 'Rider Assigned (Delivery)',
    milestone: OrderStatus.RIDER_ASSIGNED_DELIVERY,
  },
  { id: 'out_for_delivery', label: 'Out For Delivery', milestone: OrderStatus.OUT_FOR_DELIVERY },
  { id: 'delivered', label: 'Delivered', milestone: OrderStatus.DELIVERED },
];

const FLOW_INDEX: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PENDING_DISPATCH,
  OrderStatus.SHOP_ASSIGNED,
  OrderStatus.CONFIRMED,
  OrderStatus.RIDER_ASSIGNED_PICKUP,
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT_TO_SHOP,
  OrderStatus.RECEIVED_AT_SHOP,
  OrderStatus.RECEIVED,
  OrderStatus.SORTING,
  OrderStatus.WASHING,
  OrderStatus.DRYING,
  OrderStatus.FOLDING,
  OrderStatus.IRONING,
  OrderStatus.QUALITY_CHECK,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.RIDER_ASSIGNED_DELIVERY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

function statusIndex(status: string): number {
  const idx = FLOW_INDEX.indexOf(status as OrderStatus);
  return idx >= 0 ? idx : -1;
}

export function formatOrderStatusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

export function buildCustomerTimeline(
  currentStatus: string,
  statusHistory?: { status: string; timestamp: string; note?: string }[],
): {
  steps: CustomerTimelineStep[];
  progressPercent: number;
  currentStepLabel: string;
  isTerminal: boolean;
} {
  if (currentStatus === OrderStatus.CANCELLED || currentStatus === OrderStatus.REFUNDED) {
    return {
      steps: CUSTOMER_TRACK_TIMELINE.map((s) => ({ ...s, state: 'upcoming' as const })),
      progressPercent: 0,
      currentStepLabel: formatOrderStatusLabel(currentStatus),
      isTerminal: true,
    };
  }

  const currentIdx = statusIndex(currentStatus);
  const history = statusHistory ?? [];

  const steps: CustomerTimelineStep[] = CUSTOMER_TRACK_TIMELINE.map((def) => {
    const milestoneIdx = statusIndex(def.milestone);
    let state: TimelineStepState = 'upcoming';
    if (currentIdx < 0) {
      state = 'upcoming';
    } else if (currentIdx > milestoneIdx) {
      state = 'done';
    } else if (currentIdx === milestoneIdx) {
      state = 'current';
    } else if (
      currentStatus === OrderStatus.IRONING &&
      def.milestone === OrderStatus.QUALITY_CHECK
    ) {
      state = 'current';
    } else if (currentStatus === OrderStatus.COMPLETED && def.milestone === OrderStatus.DELIVERED) {
      state = 'done';
    }

    const hit = history.find((h) => h.status === def.milestone);
    return {
      ...def,
      state,
      timestamp: hit?.timestamp,
      note: hit?.note,
    };
  });

  if (currentStatus === OrderStatus.PENDING) {
    const created = steps.find((s) => s.id === 'order_created');
    if (created) created.state = 'current';
  }

  if (currentStatus === OrderStatus.PENDING_DISPATCH) {
    const created = steps.find((s) => s.id === 'order_created');
    const pending = steps.find((s) => s.id === 'pending_dispatch');
    if (created) created.state = 'done';
    if (pending) pending.state = 'current';
  }

  if (currentStatus === OrderStatus.IN_TRANSIT_TO_SHOP) {
    const picked = steps.find((s) => s.id === 'picked_up');
    const transit = steps.find((s) => s.id === 'in_transit_to_shop');
    if (picked) picked.state = 'done';
    if (transit) transit.state = 'current';
  }

  if (currentStatus === OrderStatus.RECEIVED_AT_SHOP) {
    const transit = steps.find((s) => s.id === 'in_transit_to_shop');
    const atShop = steps.find((s) => s.id === 'received_at_shop');
    if (transit) transit.state = 'done';
    if (atShop) atShop.state = 'current';
  }

  if (currentStatus === OrderStatus.SHOP_ASSIGNED) {
    const created = steps.find((s) => s.id === 'order_created');
    const pending = steps.find((s) => s.id === 'pending_dispatch');
    const shop = steps.find((s) => s.id === 'shop_assigned');
    if (created) created.state = 'done';
    if (pending) pending.state = 'done';
    if (shop) shop.state = 'current';
  }

  if (currentStatus === OrderStatus.IRONING) {
    const folding = steps.find((s) => s.id === 'folding');
    const qc = steps.find((s) => s.id === 'quality_check');
    if (folding) folding.state = 'done';
    if (qc) qc.state = 'current';
  }

  if (currentStatus === OrderStatus.COMPLETED) {
    steps.forEach((s) => {
      s.state = 'done';
    });
  }

  const doneCount = steps.filter((s) => s.state === 'done').length;
  const current = steps.find((s) => s.state === 'current');
  const progressPercent =
    currentStatus === OrderStatus.COMPLETED
      ? 100
      : Math.round((doneCount / steps.length) * 100);

  return {
    steps,
    progressPercent,
    currentStepLabel: current?.label ?? formatOrderStatusLabel(currentStatus),
    isTerminal:
      currentStatus === OrderStatus.COMPLETED ||
      currentStatus === OrderStatus.CANCELLED ||
      currentStatus === OrderStatus.REFUNDED,
  };
}
