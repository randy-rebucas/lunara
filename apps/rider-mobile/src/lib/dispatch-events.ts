/** Socket.IO payloads from Lunara dispatch (`/tracking` namespace). */

export interface DispatchOfferPayload {
  _id?: string;
  orderId?: string;
  bookingType?: string;
  status?: string;
  pickupAddress?: { label?: string; city?: string } | null;
  deliveryAddress?: { label?: string; city?: string } | null;
  branchName?: string;
}

export interface DispatchAssignmentPayload {
  type?: 'pickup_assignment' | 'delivery_assignment';
  orderId?: string;
  title?: string;
  body?: string;
  status?: string;
  branchName?: string;
}

export interface RiderNotificationPayload {
  type?: string;
  orderId?: string;
  title?: string;
  body?: string;
  status?: string;
}

export interface OrderRealtimePayload {
  orderId: string;
  status?: string;
  event?: string;
  message?: string;
}

export function dispatchOfferAlert(payload: DispatchOfferPayload, kind: 'pickup' | 'delivery') {
  const label =
    kind === 'pickup'
      ? payload.pickupAddress?.label ?? payload.branchName ?? 'New pickup'
      : payload.deliveryAddress?.label ?? payload.branchName ?? 'New delivery';
  const city =
    kind === 'pickup' ? payload.pickupAddress?.city : payload.deliveryAddress?.city;
  const where = city ? `${label} · ${city}` : label;
  return kind === 'pickup'
    ? { title: 'New pickup offer', body: `${where} — tap Tasks to accept.` }
    : { title: 'Delivery queue update', body: `${where} — ready at shop.` };
}

export function dispatchAssignmentAlert(payload: DispatchAssignmentPayload) {
  return {
    title: payload.title ?? 'New assignment',
    body: payload.body ?? 'Lunara dispatch assigned you a task.',
  };
}

export function dispatchNotificationAlert(payload: RiderNotificationPayload) {
  return {
    title: payload.title ?? 'Dispatch update',
    body: payload.body ?? 'You have a new notification.',
  };
}
