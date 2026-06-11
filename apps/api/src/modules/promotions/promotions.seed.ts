import { PromotionAudience, PromotionKind } from '@lunara/types';
import type { Collection } from 'mongodb';

function defaultFlashEndsAt() {
  const end = new Date();
  end.setDate(end.getDate() + 30);
  return end;
}

export const DEFAULT_PROMOTIONS = [
  {
    code: 'WELCOME10',
    title: 'Welcome discount',
    description: '10% off your first order',
    discountType: 'percent' as const,
    discountValue: 10,
    minOrderAmount: 200,
    isActive: true,
    audience: PromotionAudience.NEW_CUSTOMERS,
    kind: PromotionKind.STANDARD,
    maxUsesPerCustomer: 1,
    newCustomerWithinDays: 30,
  },
  {
    code: 'SIGNUP15',
    title: 'New member gift',
    description: '15% off your first booking — personal code on signup',
    discountType: 'percent' as const,
    discountValue: 15,
    minOrderAmount: 150,
    isActive: true,
    audience: PromotionAudience.ALL,
    kind: PromotionKind.SIGNUP_TEMPLATE,
    newCustomerWithinDays: 14,
  },
  {
    code: 'FREEDEL50',
    title: 'Free delivery',
    description: '₱50 off delivery fee',
    discountType: 'fixed' as const,
    discountValue: 50,
    minOrderAmount: 500,
    isActive: true,
    audience: PromotionAudience.ALL,
    kind: PromotionKind.STANDARD,
  },
  {
    code: 'FLASH50',
    title: 'Flash deal',
    description: 'Limited-time ₱50 off',
    discountType: 'fixed' as const,
    discountValue: 50,
    minOrderAmount: 300,
    isActive: true,
    audience: PromotionAudience.ALL,
    kind: PromotionKind.STANDARD,
    endsAt: defaultFlashEndsAt(),
  },
];

export async function reseedPromotions(collection: Collection) {
  const now = new Date();
  for (const promo of DEFAULT_PROMOTIONS) {
    await collection.updateOne(
      { code: promo.code },
      {
        $set: { ...promo, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    console.log(`  ${promo.code} — ${promo.title}`);
  }
}
