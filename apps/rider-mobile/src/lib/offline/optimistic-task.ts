import type { RiderCashPaymentInfo } from '@lunara/utils';
import type { WorkflowStepKey } from './types';

export interface PickupTaskLike {
  _id: string;
  status: string;
  cashPayment?: RiderCashPaymentInfo | null;
  pickup?: {
    acceptedAt?: string;
    arrivedAt?: string;
    customerVerifiedAt?: string;
    collectedAt?: string;
    photoUrl?: string;
    receiptCode?: string;
    receiptGeneratedAt?: string;
    droppedAtShop?: string;
  };
}

export interface DeliveryTaskLike {
  _id: string;
  status: string;
  cashPayment?: RiderCashPaymentInfo | null;
  customerReceived?: boolean;
  customerSigned?: boolean;
  canPickupFromShop?: boolean;
  canGoOutForDelivery?: boolean;
  canMarkCustomerReceived?: boolean;
  canCapturePhoto?: boolean;
  canComplete?: boolean;
  delivery?: {
    acceptedAt?: string;
    pickedUpFromShopAt?: string;
    startedAt?: string;
    customerReceivedAt?: string;
    photoUrl?: string;
    receiptCode?: string;
  };
}

const now = () => new Date().toISOString();

export function inferStepKey(path: string, method: string): WorkflowStepKey | null {
  if (method !== 'POST' && method !== 'PATCH') return null;
  if (path.includes('/pickup-offers/') && path.endsWith('/accept')) return 'pickup:accept';
  if (path.includes('/pickup-tasks/') && path.endsWith('/arrive')) return 'pickup:arrive';
  if (path.includes('/pickup-tasks/') && path.endsWith('/verify')) return 'pickup:verify';
  if (path.includes('/pickup-tasks/') && path.endsWith('/collect-cash')) {
    return 'pickup:collect-cash';
  }
  if (path.includes('/pickup-tasks/') && path.endsWith('/collect')) return 'pickup:collect';
  if (path.includes('/pickup-tasks/') && path.endsWith('/photo-upload')) return 'pickup:photo';
  if (path.includes('/pickup-tasks/') && path.endsWith('/generate-receipt')) return 'pickup:receipt';
  if (path.includes('/pickup-tasks/') && path.endsWith('/drop-at-shop')) return 'pickup:drop-at-shop';
  if (path.includes('/delivery-offers/') && path.endsWith('/accept')) return 'delivery:accept';
  if (path.includes('/delivery-tasks/') && path.endsWith('/pickup-from-shop')) {
    return 'delivery:pickup-from-shop';
  }
  if (path.includes('/delivery-tasks/') && path.endsWith('/out-for-delivery')) {
    return 'delivery:out-for-delivery';
  }
  if (path.includes('/delivery-tasks/') && path.endsWith('/customer-received')) {
    return 'delivery:customer-received';
  }
  if (path.includes('/delivery-tasks/') && path.endsWith('/photo-upload')) return 'delivery:photo';
  if (path.includes('/delivery-tasks/') && path.endsWith('/collect-cash')) {
    return 'delivery:collect-cash';
  }
  if (path.includes('/delivery-tasks/') && path.endsWith('/complete')) return 'delivery:complete';
  return null;
}

export function extractOrderId(path: string): string | null {
  const match = path.match(/\/(?:pickup|delivery)-(?:offers|tasks)\/([^/]+)/);
  return match?.[1] ?? null;
}

export function applyPickupStep(
  task: PickupTaskLike,
  stepKey: WorkflowStepKey,
  extras?: { photoLocalUri?: string; receiptCode?: string },
): PickupTaskLike {
  const pickup = { ...(task.pickup ?? {}) };
  const t = now();

  switch (stepKey) {
    case 'pickup:accept':
      pickup.acceptedAt = t;
      return { ...task, status: 'rider_assigned_pickup', pickup };
    case 'pickup:arrive':
      pickup.arrivedAt = t;
      return { ...task, pickup };
    case 'pickup:verify':
      pickup.customerVerifiedAt = t;
      return { ...task, pickup };
    case 'pickup:collect-cash':
      return {
        ...task,
        cashPayment: task.cashPayment
          ? {
              ...task.cashPayment,
              collected: true,
              status: 'paid',
              canCollect: false,
            }
          : task.cashPayment,
      };
    case 'pickup:collect':
      pickup.collectedAt = t;
      return { ...task, status: 'picked_up', pickup };
    case 'pickup:photo':
      pickup.photoUrl = extras?.photoLocalUri ?? `pending://${task._id}-photo`;
      return { ...task, pickup };
    case 'pickup:receipt':
      pickup.receiptGeneratedAt = t;
      pickup.receiptCode = extras?.receiptCode ?? `PU-PENDING-${task._id.slice(-4)}`;
      return { ...task, pickup };
    case 'pickup:drop-at-shop':
      pickup.droppedAtShop = t;
      return { ...task, status: 'in_transit_to_shop', pickup };
    default:
      return task;
  }
}

export function applyDeliveryStep(
  task: DeliveryTaskLike,
  stepKey: WorkflowStepKey,
  extras?: { photoLocalUri?: string; receiptCode?: string },
): DeliveryTaskLike {
  const delivery = { ...(task.delivery ?? {}) };
  const t = now();

  switch (stepKey) {
    case 'delivery:accept':
      delivery.acceptedAt = t;
      return {
        ...task,
        status: 'rider_assigned_delivery',
        canPickupFromShop: true,
        delivery,
      };
    case 'delivery:pickup-from-shop':
      delivery.pickedUpFromShopAt = t;
      return {
        ...task,
        canPickupFromShop: false,
        canGoOutForDelivery: true,
        delivery,
      };
    case 'delivery:out-for-delivery':
      delivery.startedAt = t;
      return {
        ...task,
        status: 'out_for_delivery',
        canGoOutForDelivery: false,
        canMarkCustomerReceived: true,
        delivery,
      };
    case 'delivery:customer-received':
      delivery.customerReceivedAt = t;
      return {
        ...task,
        customerReceived: true,
        canMarkCustomerReceived: false,
        canCapturePhoto: true,
        delivery,
      };
    case 'delivery:photo':
      delivery.photoUrl = extras?.photoLocalUri ?? `pending://${task._id}-photo`;
      return {
        ...task,
        canCapturePhoto: false,
        canComplete:
          !!task.customerSigned && (!task.cashPayment || task.cashPayment.collected),
        delivery,
      };
    case 'delivery:collect-cash':
      return {
        ...task,
        cashPayment: task.cashPayment
          ? {
              ...task.cashPayment,
              collected: true,
              status: 'paid',
              canCollect: false,
            }
          : task.cashPayment,
        canComplete:
          task.status === 'out_for_delivery' &&
          !!delivery.photoUrl &&
          !!task.customerSigned,
      };
    case 'delivery:complete':
      delivery.receiptCode = extras?.receiptCode ?? `DL-PENDING-${task._id.slice(-4)}`;
      return {
        ...task,
        status: 'delivered',
        canComplete: false,
        delivery,
      };
    default:
      return task;
  }
}

export function isPickupStepDone(task: PickupTaskLike, stepKey: WorkflowStepKey): boolean {
  const p = task.pickup ?? {};
  switch (stepKey) {
    case 'pickup:accept':
      return !!p.acceptedAt;
    case 'pickup:arrive':
      return !!p.arrivedAt;
    case 'pickup:verify':
      return !!p.customerVerifiedAt;
    case 'pickup:collect-cash':
      return !!task.cashPayment?.collected;
    case 'pickup:collect':
      return !!p.collectedAt;
    case 'pickup:photo':
      return !!p.photoUrl;
    case 'pickup:receipt':
      return !!p.receiptCode;
    case 'pickup:drop-at-shop':
      return !!p.droppedAtShop;
    default:
      return false;
  }
}

export function isDeliveryStepDone(task: DeliveryTaskLike, stepKey: WorkflowStepKey): boolean {
  const d = task.delivery ?? {};
  switch (stepKey) {
    case 'delivery:accept':
      return !!d.acceptedAt;
    case 'delivery:pickup-from-shop':
      return !!d.pickedUpFromShopAt;
    case 'delivery:out-for-delivery':
      return task.status === 'out_for_delivery' || !!d.startedAt;
    case 'delivery:customer-received':
      return !!d.customerReceivedAt || !!task.customerReceived;
    case 'delivery:photo':
      return !!d.photoUrl;
    case 'delivery:collect-cash':
      return !!task.cashPayment?.collected;
    case 'delivery:complete':
      return task.status === 'delivered' || task.status === 'completed' || !!d.receiptCode;
    default:
      return false;
  }
}

export function isAlreadyDoneError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('already') ||
    lower.includes('must be') ||
    lower.includes('not active') ||
    lower.includes('not available') ||
    lower.includes('complete') && lower.includes('first')
  );
}
