import type { PromotionAudience } from '@lunara/types';
import type { QuoteBreakdown } from './booking.js';

export interface PromotionDiscountInput {
  code: string;
  title: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
}

export interface PromotionEligibilityInput extends PromotionDiscountInput {
  minOrderAmount: number;
  isActive: boolean;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  audience?: PromotionAudience | 'all' | 'new_customers';
  maxUsesPerCustomer?: number | null;
  newCustomerWithinDays?: number | null;
}

export interface PromotionCustomerContext {
  subtotal: number;
  userCreatedAt: string | Date;
  completedOrderCount: number;
  redemptionCount?: number;
  now?: Date;
}

const SIGNUP_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizePromotionCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isPromotionActive(
  promo: Pick<PromotionEligibilityInput, 'isActive' | 'startsAt' | 'endsAt'>,
  now: Date = new Date(),
): boolean {
  if (!promo.isActive) return false;
  if (promo.startsAt && new Date(promo.startsAt) > now) return false;
  if (promo.endsAt && new Date(promo.endsAt) < now) return false;
  return true;
}

export function isWithinNewCustomerWindow(
  userCreatedAt: string | Date,
  withinDays: number,
  now: Date = new Date(),
): boolean {
  const created = new Date(userCreatedAt);
  const deadline = new Date(created);
  deadline.setDate(deadline.getDate() + withinDays);
  return now <= deadline;
}

export function isNewCustomer(
  completedOrderCount: number,
  userCreatedAt: string | Date,
  newCustomerWithinDays?: number | null,
  now: Date = new Date(),
): boolean {
  if (completedOrderCount > 0) return false;
  if (newCustomerWithinDays != null && newCustomerWithinDays > 0) {
    return isWithinNewCustomerWindow(userCreatedAt, newCustomerWithinDays, now);
  }
  return true;
}

export function promotionMinOrderError(minOrderAmount: number): string {
  return `Minimum order of ₱${minOrderAmount} required for this promo`;
}

export function validatePromotionForQuote(
  promo: PromotionEligibilityInput,
  subtotal: number,
  now: Date = new Date(),
): { valid: true } | { valid: false; message: string } {
  if (!isPromotionActive(promo, now)) {
    return { valid: false, message: 'Invalid or expired promo code' };
  }
  if (subtotal < promo.minOrderAmount) {
    return { valid: false, message: promotionMinOrderError(promo.minOrderAmount) };
  }
  return { valid: true };
}

export function validatePromotionForCustomer(
  promo: PromotionEligibilityInput,
  context: PromotionCustomerContext,
): { valid: true } | { valid: false; message: string } {
  const now = context.now ?? new Date();
  const quoteCheck = validatePromotionForQuote(promo, context.subtotal, now);
  if (!quoteCheck.valid) return quoteCheck;

  const audience = promo.audience ?? 'all';
  if (audience === 'new_customers') {
    if (
      !isNewCustomer(
        context.completedOrderCount,
        context.userCreatedAt,
        promo.newCustomerWithinDays,
        now,
      )
    ) {
      return { valid: false, message: 'This promo is only for new customers' };
    }
  }

  if (promo.maxUsesPerCustomer != null && promo.maxUsesPerCustomer > 0) {
    const used = context.redemptionCount ?? 0;
    if (used >= promo.maxUsesPerCustomer) {
      return { valid: false, message: 'You have already used this promo code' };
    }
  }

  return { valid: true };
}

export function validateCustomerPromoForQuote(
  promo: Pick<PromotionDiscountInput, 'code' | 'title' | 'discountType' | 'discountValue'> & {
    minOrderAmount: number;
    expiresAt: string | Date;
    redeemedAt?: string | Date | null;
  },
  subtotal: number,
  now: Date = new Date(),
): { valid: true } | { valid: false; message: string } {
  if (promo.redeemedAt) {
    return { valid: false, message: 'This promo code has already been used' };
  }
  if (new Date(promo.expiresAt) < now) {
    return { valid: false, message: 'This promo code has expired' };
  }
  if (subtotal < promo.minOrderAmount) {
    return { valid: false, message: promotionMinOrderError(promo.minOrderAmount) };
  }
  return { valid: true };
}

export function computePromotionDiscountAmount(
  subtotal: number,
  deliveryFee: number,
  promo: Pick<PromotionDiscountInput, 'discountType' | 'discountValue'>,
): number {
  if (promo.discountType === 'percent') {
    const pct = Math.min(100, Math.max(0, promo.discountValue));
    return Math.min(subtotal, Math.round((subtotal * pct) / 100));
  }
  return Math.min(promo.discountValue, subtotal + deliveryFee);
}

export function applyPromotionToQuote(
  quote: QuoteBreakdown,
  promo: PromotionDiscountInput,
): QuoteBreakdown {
  const discount = computePromotionDiscountAmount(quote.subtotal, quote.deliveryFee, promo);
  return {
    ...quote,
    discount,
    total: quote.subtotal + quote.deliveryFee - discount,
    couponCode: promo.code,
    promotionTitle: promo.title,
  };
}

export function generateSignupPromoCode(): string {
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += SIGNUP_CODE_CHARS[Math.floor(Math.random() * SIGNUP_CODE_CHARS.length)];
  }
  return `LUN${suffix}`;
}
