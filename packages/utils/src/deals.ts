import type { Deal } from '@lunara/types';
import { formatCurrency } from './format.js';

export function formatDealDiscount(deal: Pick<Deal, 'discountType' | 'discountValue'>): string {
  if (deal.discountType === 'percent') return `${deal.discountValue}% off`;
  return `${formatCurrency(deal.discountValue)} off`;
}

export function formatDealMinimum(deal: Pick<Deal, 'minOrderAmount'>): string | null {
  if (deal.minOrderAmount <= 0) return null;
  return `Min. order ${formatCurrency(deal.minOrderAmount)}`;
}

export function formatDealExpiry(
  endsAt: string | Date | undefined | null,
  now: Date = new Date(),
): string | null {
  if (!endsAt) return null;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime()) || end < now) return null;
  return `Expires ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
