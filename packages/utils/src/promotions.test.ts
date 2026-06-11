import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BookingType } from '@lunara/types';
import { calculateQuote } from './booking.js';
import { formatDealExpiry } from './deals.js';
import {
  applyPromotionToQuote,
  computePromotionDiscountAmount,
  generateSignupPromoCode,
  isNewCustomer,
  isPromotionActive,
  normalizePromotionCode,
  validateCustomerPromoForQuote,
  validatePromotionForCustomer,
  validatePromotionForQuote,
} from './promotions.js';

const baseQuote = calculateQuote({
  bookingType: BookingType.WASH_FOLD,
  weightKg: 5,
  addonIds: [],
});

const now = new Date('2026-06-11T12:00:00Z');

describe('promotions', () => {
  it('normalizes promo codes', () => {
    assert.equal(normalizePromotionCode(' welcome10 '), 'WELCOME10');
  });

  it('checks active window', () => {
    assert.equal(
      isPromotionActive({ isActive: true, startsAt: '2026-06-01', endsAt: '2026-06-30' }, now),
      true,
    );
    assert.equal(
      isPromotionActive({ isActive: true, startsAt: '2026-07-01', endsAt: null }, now),
      false,
    );
  });

  it('computes percent discount on subtotal', () => {
    assert.equal(computePromotionDiscountAmount(400, 50, { discountType: 'percent', discountValue: 10 }), 40);
  });

  it('computes fixed discount capped at order amount', () => {
    assert.equal(computePromotionDiscountAmount(400, 50, { discountType: 'fixed', discountValue: 50 }), 50);
    assert.equal(computePromotionDiscountAmount(30, 50, { discountType: 'fixed', discountValue: 99 }), 80);
  });

  it('validates minimum order amount', () => {
    const promo = {
      code: 'WELCOME10',
      title: 'Welcome',
      discountType: 'percent' as const,
      discountValue: 10,
      minOrderAmount: 200,
      isActive: true,
    };
    assert.deepEqual(validatePromotionForQuote(promo, 150), {
      valid: false,
      message: 'Minimum order of ₱200 required for this promo',
    });
    assert.deepEqual(validatePromotionForQuote(promo, 400), { valid: true });
  });

  it('applies promotion to quote breakdown', () => {
    const discounted = applyPromotionToQuote(baseQuote, {
      code: 'WELCOME10',
      title: 'Welcome discount',
      discountType: 'percent',
      discountValue: 10,
    });
    assert.equal(discounted.discount, 40);
    assert.equal(discounted.total, baseQuote.subtotal + baseQuote.deliveryFee - 40);
    assert.equal(discounted.couponCode, 'WELCOME10');
    assert.equal(discounted.promotionTitle, 'Welcome discount');
  });

  it('validates new customer audience and usage limits', () => {
    const promo = {
      code: 'WELCOME10',
      title: 'Welcome',
      discountType: 'percent' as const,
      discountValue: 10,
      minOrderAmount: 0,
      isActive: true,
      audience: 'new_customers' as const,
      maxUsesPerCustomer: 1,
      newCustomerWithinDays: 30,
    };
    const context = {
      subtotal: 400,
      userCreatedAt: '2026-06-01',
      completedOrderCount: 0,
      redemptionCount: 0,
      now,
    };
    assert.deepEqual(validatePromotionForCustomer(promo, context), { valid: true });

    assert.deepEqual(
      validatePromotionForCustomer(promo, { ...context, completedOrderCount: 1 }),
      { valid: false, message: 'This promo is only for new customers' },
    );

    assert.deepEqual(
      validatePromotionForCustomer(promo, { ...context, redemptionCount: 1 }),
      { valid: false, message: 'You have already used this promo code' },
    );

    assert.deepEqual(
      validatePromotionForCustomer(promo, {
        ...context,
        userCreatedAt: '2026-04-01',
      }),
      { valid: false, message: 'This promo is only for new customers' },
    );
  });

  it('validates personal customer promo expiry and redemption', () => {
    const personal = {
      code: 'LUN8F2K9',
      title: 'Welcome gift',
      discountType: 'percent' as const,
      discountValue: 15,
      minOrderAmount: 0,
      expiresAt: '2026-06-30',
    };
    assert.deepEqual(validateCustomerPromoForQuote(personal, 400, now), { valid: true });
    assert.deepEqual(
      validateCustomerPromoForQuote({ ...personal, expiresAt: '2026-06-01' }, 400, now),
      { valid: false, message: 'This promo code has expired' },
    );
    assert.deepEqual(
      validateCustomerPromoForQuote({ ...personal, redeemedAt: '2026-06-10' }, 400, now),
      { valid: false, message: 'This promo code has already been used' },
    );
  });

  it('detects new customers by completed orders and signup window', () => {
    assert.equal(isNewCustomer(0, '2026-06-01', 30, now), true);
    assert.equal(isNewCustomer(1, '2026-06-01', 30, now), false);
    assert.equal(isNewCustomer(0, '2026-04-01', 30, now), false);
  });

  it('generates signup promo codes', () => {
    const code = generateSignupPromoCode();
    assert.match(code, /^LUN[A-Z2-9]{6}$/);
  });

  it('formats deal expiry', () => {
    assert.equal(formatDealExpiry('2026-06-30', now), 'Expires Jun 30, 2026');
    assert.equal(formatDealExpiry('2026-06-01', now), null);
    assert.equal(formatDealExpiry(undefined, now), null);
  });
});
