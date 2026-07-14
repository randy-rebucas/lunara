export interface RewardsCatalogItem {
  id: string;
  title: string;
  description: string;
  points: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
}

// Single source of truth for redeemable rewards — mirrored by the customer-mobile
// and customer-web catalog UIs via GET /rewards/catalog instead of being duplicated.
export const REWARDS_CATALOG: RewardsCatalogItem[] = [
  {
    id: 'free-pickup',
    title: 'Free pickup',
    description: 'Get free pickup on your next order',
    points: 200,
    discountType: 'fixed',
    discountValue: 60,
  },
  {
    id: 'free-delivery',
    title: 'Free delivery',
    description: 'Get free delivery on your next order',
    points: 150,
    discountType: 'fixed',
    discountValue: 60,
  },
  {
    id: 'discount-10',
    title: '10% discount',
    description: 'Get 10% off on your next order',
    points: 300,
    discountType: 'percent',
    discountValue: 10,
  },
  {
    id: 'discount-20',
    title: '20% discount',
    description: 'Get 20% off on your next order',
    points: 500,
    discountType: 'percent',
    discountValue: 20,
  },
  {
    id: 'free-wash-fold-3kg',
    title: 'Free wash & fold (3 kg)',
    description: 'Enjoy free wash & fold up to 3 kg',
    points: 800,
    discountType: 'fixed',
    discountValue: 250,
  },
];

export const TIERS = [
  { name: 'Moon', min: 0 },
  { name: 'Star', min: 500 },
  { name: 'Comet', min: 1500 },
  { name: 'Galaxy', min: 3000 },
] as const;

export const POINTS_PER_COMPLETED_ORDER = 50;
export const REFERRAL_BONUS_POINTS = 100;
export const REWARD_VOUCHER_VALIDITY_DAYS = 30;
