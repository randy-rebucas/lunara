export type SlaStatus = 'ok' | 'warning' | 'breached' | 'not_applicable';

export interface OrderSlaInput {
  status: string;
  scheduledPickupAt?: string | Date;
  dispatchStatus?: 'pending_dispatch' | 'dispatched';
  partnerAcceptedAt?: string | Date;
  pickupRiderId?: string;
  pickupCollectedAt?: string | Date;
  createdAt?: string | Date;
}

const PICKUP_WARNING_MINUTES = 30;
const PICKUP_BREACH_MINUTES = 60;

export function computePickupSla(input: OrderSlaInput): {
  status: SlaStatus;
  dueAt: Date | null;
  minutesUntilDue: number | null;
  label: string;
} {
  if (
    input.status === 'pending' ||
    input.status === 'pending_dispatch' ||
    input.dispatchStatus === 'pending_dispatch'
  ) {
    return { status: 'not_applicable', dueAt: null, minutesUntilDue: null, label: 'Awaiting dispatch' };
  }

  if (!input.scheduledPickupAt) {
    return { status: 'not_applicable', dueAt: null, minutesUntilDue: null, label: 'No pickup window' };
  }

  const dueAt = new Date(input.scheduledPickupAt);
  const now = Date.now();
  const minutesUntilDue = Math.round((dueAt.getTime() - now) / 60000);

  if (
    input.pickupCollectedAt ||
    input.status === 'picked_up' ||
    input.status === 'in_transit_to_shop' ||
    input.pickupRiderId
  ) {
    const collectedMs = input.pickupCollectedAt
      ? new Date(input.pickupCollectedAt).getTime()
      : now;
    if (collectedMs <= dueAt.getTime() + PICKUP_BREACH_MINUTES * 60000) {
      return { status: 'ok', dueAt, minutesUntilDue, label: 'Pickup on track' };
    }
    return { status: 'warning', dueAt, minutesUntilDue, label: 'Pickup completed late' };
  }

  if (minutesUntilDue < -PICKUP_BREACH_MINUTES) {
    return { status: 'breached', dueAt, minutesUntilDue, label: 'Pickup SLA breached' };
  }
  if (minutesUntilDue < -PICKUP_WARNING_MINUTES) {
    return { status: 'warning', dueAt, minutesUntilDue, label: 'Pickup overdue' };
  }
  if (minutesUntilDue < PICKUP_WARNING_MINUTES) {
    return { status: 'warning', dueAt, minutesUntilDue, label: 'Pickup due soon' };
  }

  return { status: 'ok', dueAt, minutesUntilDue, label: 'Pickup scheduled' };
}
