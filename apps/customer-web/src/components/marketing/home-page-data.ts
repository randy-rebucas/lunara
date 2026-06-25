import type { LucideIcon } from 'lucide-react';
import {
  CalendarCheck,
  Bike,
  Layers,
  PackageCheck,
  MapPin,
  CircleDollarSign,
  Navigation,
  CreditCard,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

export const HERO_STATS = [
  { value: '3 min', label: 'Average booking time' },
  { value: 'Live', label: 'Order tracking' },
  { value: '4+', label: 'Payment options' },
] as const;

export const SOCIAL_PROOF = [
  { value: '1,000+', label: 'Orders completed' },
  { value: '50+', label: 'Partner laundry shops' },
  { value: '3', label: 'Metro Manila areas' },
  { value: '4.8★', label: 'Play Store rating' },
] as const;

// Unsplash base helper — keeps URLs DRY and easy to swap
const u = (id: string, w = 800, h = 500) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&q=80&auto=format&fit=crop`;

export const HERO_IMAGE = {
  src: u('1582735689369-4fe89db7114c', 900, 560),
  alt: 'Neatly folded clean laundry',
};

export type HowItWorksItem = {
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
  image: string;
  imageAlt: string;
};

export const HOW_IT_WORKS: HowItWorksItem[] = [
  {
    step: '1',
    title: 'Book a pickup',
    description:
      'Choose wash, dry clean, or express service. Pick a time slot and confirm your order with a clear price breakdown.',
    icon: CalendarCheck,
    image: u('1512941937669-90a1b58e7e9c', 640, 360),
    imageAlt: 'Person booking a laundry pickup on a smartphone',
  },
  {
    step: '2',
    title: 'Rider collects',
    description:
      'A Lunara rider picks up from your home or office. Pin your address for accurate routing and handoff.',
    icon: Bike,
    image: u('1558981403-c5f9899a28bc', 640, 360),
    imageAlt: 'Delivery rider on a scooter collecting a laundry bag',
  },
  {
    step: '3',
    title: 'Partner processes',
    description:
      'Trusted laundry partners wash, dry, and fold your clothes. Track every step from shop to dispatch.',
    icon: Layers,
    image: u('1517677208171-0bc6132a26b5', 640, 360),
    imageAlt: 'Professional laundry shop with washing machines',
  },
  {
    step: '4',
    title: 'Delivered fresh',
    description:
      'Get laundry returned to your door. Pay your way — GCash, card, wallet, or cash — and rate your experience.',
    icon: PackageCheck,
    image: u('1558618666-fcd25c85cd64', 640, 360),
    imageAlt: 'Clean freshly folded clothes ready for delivery',
  },
];

export const SERVICE_AREAS = [
  {
    name: 'Lunara Makati',
    city: 'Makati',
    province: 'Metro Manila',
    area: 'Makati CBD, Legazpi, Salcedo, and nearby barangays',
    radiusKm: 12,
  },
  {
    name: 'Lunara Quezon City',
    city: 'Quezon City',
    province: 'Metro Manila',
    area: 'Timog, Kamuning, South Triangle, and surrounding areas',
    radiusKm: 14,
  },
  {
    name: 'Lunara BGC',
    city: 'Taguig',
    province: 'Metro Manila',
    area: 'Bonifacio Global City, McKinley Hill, and nearby communities',
    radiusKm: 10,
  },
] as const;

export interface ServiceArea {
  name: string;
  city: string;
  province: string;
  area: string;
  radiusKm: number;
}

/** Fetches live, active branches from the public API; falls back to the static list on any failure. */
export async function fetchActiveServiceAreas(apiBase: string): Promise<ServiceArea[]> {
  try {
    const res = await fetch(`${apiBase}/public/branches`, { next: { revalidate: 60 } });
    if (!res.ok) return [...SERVICE_AREAS];
    const body = await res.json();
    const data = body?.data;
    if (!Array.isArray(data) || data.length === 0) return [...SERVICE_AREAS];
    return data.map((branch: { name: string; city: string; province: string; radiusKm?: number }) => ({
      name: branch.name,
      city: branch.city,
      province: branch.province,
      area: `${branch.city}, ${branch.province}`,
      radiusKm: branch.radiusKm ?? 10,
    }));
  } catch {
    return [...SERVICE_AREAS];
  }
}

export const EXPANDING_AREAS = [
  'Pasig & Ortigas',
  'Manila & Ermita',
  'Parañaque & Las Piñas',
  'Cebu Metro',
] as const;

export type WhyChooseItem = {
  label: string;
  title: string;
  description: string;
  accent: 'primary' | 'secondary' | 'accent';
  icon: LucideIcon;
};

export const WHY_CHOOSE: WhyChooseItem[] = [
  {
    label: 'Convenience',
    title: 'Door-to-door convenience',
    description: 'No laundromat trips. Schedule pickup and delivery around your day.',
    accent: 'primary',
    icon: MapPin,
  },
  {
    label: 'Pricing',
    title: 'Transparent pricing',
    description: 'See service rates, add-ons, and delivery fees before you confirm.',
    accent: 'secondary',
    icon: CircleDollarSign,
  },
  {
    label: 'Tracking',
    title: 'Live order tracking',
    description: 'Follow pickup, shop processing, and delivery in real time on web or mobile.',
    accent: 'accent',
    icon: Navigation,
  },
  {
    label: 'Payments',
    title: 'Flexible payments',
    description: 'GCash, card, Lunara wallet, or cash on pickup or delivery.',
    accent: 'primary',
    icon: CreditCard,
  },
  {
    label: 'Partners',
    title: 'Trusted partner network',
    description: 'Vetted laundry shops with quality standards and operations support.',
    accent: 'secondary',
    icon: ShieldCheck,
  },
  {
    label: 'Rewards',
    title: 'Promos & wallet',
    description: 'Apply deals at checkout, top up your wallet, and manage refunds in one place.',
    accent: 'accent',
    icon: Wallet,
  },
];

export const CUSTOMER_REVIEWS = [
  {
    name: 'Maria C.',
    initials: 'MC',
    location: 'Makati',
    rating: 5,
    quote:
      'Booking took less than five minutes. The rider was on time and I tracked everything until delivery.',
    avatarColor: 'primary' as const,
  },
  {
    name: 'James R.',
    initials: 'JR',
    location: 'BGC',
    rating: 5,
    quote:
      'Finally laundry that fits my schedule. Pricing was clear upfront and the clothes came back perfectly folded.',
    avatarColor: 'secondary' as const,
  },
  {
    name: 'Angela T.',
    initials: 'AT',
    location: 'Quezon City',
    rating: 5,
    quote:
      'Used the mobile app and web — both work great. Wallet top-up and GCash checkout made paying easy.',
    avatarColor: 'accent' as const,
  },
] as const;

export const PRICING_TIERS = [
  {
    service: 'Wash & Fold',
    badge: 'Most popular',
    badgeVariant: 'primary' as const,
    from: '₱280',
    unit: 'per 4 kg load',
    highlights: ['Sorted & folded', 'Same-day available', 'GCash / card accepted'],
    image: u('1545173168-9f1947eebb7f', 640, 300),
    imageAlt: 'Stack of clean neatly folded laundry',
  },
  {
    service: 'Dry Cleaning',
    badge: 'Delicates',
    badgeVariant: 'secondary' as const,
    from: '₱120',
    unit: 'per garment',
    highlights: ['Suits, dresses & blazers', 'Careful handling', 'Pressed & bagged'],
    image: u('1489274495757-95c7c837b101', 640, 300),
    imageAlt: 'Pressed suits and garments on hangers ready for dry cleaning pickup',
  },
  {
    service: 'Express Wash',
    badge: '4-hour turnaround',
    badgeVariant: 'accent' as const,
    from: '₱350',
    unit: 'per 4 kg load',
    highlights: ['Priority processing', 'Pick-up & delivery', 'CBD areas only'],
    image: u('1582735689369-4fe89db7114c', 640, 300),
    imageAlt: 'Clean laundry basket ready for express delivery',
  },
] as const;
