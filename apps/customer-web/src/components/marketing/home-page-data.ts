import type { LucideIcon } from 'lucide-react';
import {
  BadgePercent,
  Bike,
  CalendarCheck,
  Clock,
  CreditCard,
  Home,
  MapPin,
  Navigation,
  Package,
  ShieldCheck,
  Star,
  Store,
  Timer,
  Truck,
  Users,
  WashingMachine,
} from 'lucide-react';
import { FAQ_CATEGORIES, type FaqItem } from './faq-data';

export const TRUST_CHIPS = [
  { icon: Truck, title: 'Free pickup', subtitle: 'for first-time users' },
  { icon: Clock, title: 'Same-day', subtitle: 'service available' },
  { icon: ShieldCheck, title: 'Trusted', subtitle: 'laundry partners' },
  { icon: CreditCard, title: 'Secure', subtitle: 'payments' },
] as const;

export const STATS = [
  { icon: Users, value: '1,000+', label: 'Orders completed' },
  { icon: Store, value: '50+', label: 'Partner laundry shops' },
  { icon: MapPin, value: '3', label: 'Metro Manila areas' },
  { icon: Star, value: '4.8★', label: 'Play Store rating' },
] as const;

export type FeatureItem = {
  title: string;
  description: string;
  icon: LucideIcon;
  accent: 'primary' | 'secondary' | 'accent';
};

export const FEATURES: FeatureItem[] = [
  {
    title: 'Pickup & delivery',
    description: 'No need to leave your house. We pick up and deliver to your doorstep.',
    icon: Bike,
    accent: 'primary',
  },
  {
    title: 'Live order tracking',
    description: 'Track your laundry in real time from pickup to delivery.',
    icon: Navigation,
    accent: 'secondary',
  },
  {
    title: 'Secure payments',
    description: 'Pay safely with cash, GCash, card, or your Lunara wallet.',
    icon: ShieldCheck,
    accent: 'accent',
  },
  {
    title: 'Professional partners',
    description: 'We work with verified laundry shops to ensure quality service.',
    icon: WashingMachine,
    accent: 'primary',
  },
  {
    title: 'Affordable pricing',
    description: 'Transparent pricing with no hidden fees, confirmed before checkout.',
    icon: BadgePercent,
    accent: 'secondary',
  },
  {
    title: 'Fast turnaround',
    description: 'Same-day or next-day options to fit your busy schedule.',
    icon: Timer,
    accent: 'accent',
  },
];

export type HowItWorksItem = {
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const HOW_IT_WORKS: HowItWorksItem[] = [
  {
    step: '1',
    title: 'Book pickup',
    description: 'Choose your service, date, and time — with a clear price upfront.',
    icon: CalendarCheck,
  },
  {
    step: '2',
    title: 'Laundry collected',
    description: 'A Lunara rider picks up your laundry from your home or office.',
    icon: Bike,
  },
  {
    step: '3',
    title: 'Professionally cleaned',
    description: 'Trusted partners carefully wash, dry, and fold your clothes.',
    icon: WashingMachine,
  },
  {
    step: '4',
    title: 'Delivered back home',
    description: 'We deliver it fresh and clean to your door — pay your way.',
    icon: Home,
  },
];

export const SERVICE_AREAS = [
  {
    id: 'lunara-makati',
    name: 'Lunara Makati',
    city: 'Makati',
    province: 'Metro Manila',
    area: 'Makati CBD, Legazpi, Salcedo, and nearby barangays',
    radiusKm: 12,
  },
  {
    id: 'lunara-quezon-city',
    name: 'Lunara Quezon City',
    city: 'Quezon City',
    province: 'Metro Manila',
    area: 'Timog, Kamuning, South Triangle, and surrounding areas',
    radiusKm: 14,
  },
  {
    id: 'lunara-bgc',
    name: 'Lunara BGC',
    city: 'Taguig',
    province: 'Metro Manila',
    area: 'Bonifacio Global City, McKinley Hill, and nearby communities',
    radiusKm: 10,
  },
] as const;

export interface ServiceAreaMachine {
  label: string;
  machineType: string;
}

export interface ServiceAreaPerson {
  displayName?: string;
  avatarUrl?: string;
}

export interface ServiceAreaSibling {
  id: string;
  name: string;
  city: string;
  province: string;
}

export interface ServiceArea {
  id: string;
  name: string;
  city: string;
  province: string;
  area: string;
  radiusKm: number;
  logoUrl?: string;
  machines?: ServiceAreaMachine[];
  owner?: ServiceAreaPerson | null;
  staff?: ServiceAreaPerson[];
  branches?: ServiceAreaSibling[];
  partnerId?: string;
  partnerName?: string;
  isMainShop?: boolean;
}

type PublicBranchApiShape = {
  id: string;
  name: string;
  city: string;
  province: string;
  radiusKm?: number;
  logoUrl?: string;
  machines?: ServiceAreaMachine[];
  owner?: ServiceAreaPerson | null;
  staff?: ServiceAreaPerson[];
  branches?: ServiceAreaSibling[];
  partnerId?: string;
  partnerName?: string;
  isMainShop?: boolean;
};

function toServiceArea(branch: PublicBranchApiShape): ServiceArea {
  return {
    id: branch.id,
    name: branch.name,
    city: branch.city,
    province: branch.province,
    area: `${branch.city}, ${branch.province}`,
    radiusKm: branch.radiusKm ?? 10,
    logoUrl: branch.logoUrl,
    machines: branch.machines,
    owner: branch.owner,
    staff: branch.staff,
    branches: branch.branches,
    partnerId: branch.partnerId,
    partnerName: branch.partnerName,
    isMainShop: branch.isMainShop,
  };
}

/** Groups service areas by partner, falling back to one group per branch when no partnerId is present. */
export function groupServiceAreasByPartner(areas: ServiceArea[]) {
  const groups = new Map<
    string,
    { partnerId: string; partnerName: string; logoUrl?: string; branches: ServiceArea[] }
  >();
  for (const area of areas) {
    const key = area.partnerId ?? area.id;
    const existing = groups.get(key);
    if (existing) {
      existing.branches.push(area);
      if (area.isMainShop && area.logoUrl) existing.logoUrl = area.logoUrl;
    } else {
      groups.set(key, {
        partnerId: key,
        partnerName: area.partnerName || area.name,
        logoUrl: area.logoUrl,
        branches: [area],
      });
    }
  }
  return [...groups.values()];
}

/** Fetches live, active branches from the public API; falls back to the static list on any failure. */
export async function fetchActiveServiceAreas(apiBase: string): Promise<ServiceArea[]> {
  try {
    const res = await fetch(`${apiBase}/public/branches`, { next: { revalidate: 60 } });
    if (!res.ok) return [...SERVICE_AREAS];
    const body = await res.json();
    const data = body?.data;
    if (!Array.isArray(data) || data.length === 0) return [...SERVICE_AREAS];
    return data.map((branch: PublicBranchApiShape) => toServiceArea(branch));
  } catch {
    return [...SERVICE_AREAS];
  }
}

/** Fetches a single branch's public detail; falls back to the static list, then null if not found anywhere. */
export async function fetchServiceAreaById(
  apiBase: string,
  id: string,
): Promise<ServiceArea | null> {
  try {
    const res = await fetch(`${apiBase}/public/branches/${id}`, { next: { revalidate: 60 } });
    if (res.ok) {
      const body = await res.json();
      if (body?.data) return toServiceArea(body.data as PublicBranchApiShape);
    }
  } catch {
    // fall through to static fallback
  }
  const fallback = SERVICE_AREAS.find((area) => area.id === id);
  return fallback ? { ...fallback } : null;
}

export const EXPANDING_AREAS = [
  'Pasig & Ortigas',
  'Manila & Ermita',
  'Parañaque & Las Piñas',
] as const;

export interface CustomerReview {
  id: string;
  name: string;
  initials: string;
  rating: number;
  quote: string;
  avatarColor: 'primary' | 'secondary' | 'accent';
}

const AVATAR_COLORS = ['primary', 'secondary', 'accent'] as const;

/** Fetches real, published customer reviews from the public API. Returns an empty list (rather
 * than fabricated testimonials) if the request fails or there aren't any published yet — the
 * reviews section is skipped in that case. */
export async function fetchFeaturedReviews(apiBase: string): Promise<CustomerReview[]> {
  try {
    const res = await fetch(`${apiBase}/public/reviews/featured`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const body = await res.json();
    const data = body?.data;
    if (!Array.isArray(data)) return [];
    return data.map((review, i) => ({
      id: review.id,
      name: review.name,
      initials: review.initials,
      rating: review.rating,
      quote: review.quote,
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
    }));
  } catch {
    return [];
  }
}

export const PRICING_TIERS = [
  {
    service: 'Wash & Fold',
    badge: 'Most popular',
    badgeVariant: 'primary' as const,
    icon: Package,
    from: '₱280',
    unit: 'per 4 kg load',
    highlights: ['Sorted & folded', 'Same-day available', 'GCash / card accepted'],
  },
  {
    service: 'Dry Cleaning',
    badge: 'Delicates',
    badgeVariant: 'secondary' as const,
    icon: ShieldCheck,
    from: '₱120',
    unit: 'per garment',
    highlights: ['Suits, dresses & blazers', 'Careful handling', 'Pressed & bagged'],
  },
  {
    service: 'Express Wash',
    badge: '4-hour turnaround',
    badgeVariant: 'accent' as const,
    icon: Timer,
    from: '₱350',
    unit: 'per 4 kg load',
    highlights: ['Priority processing', 'Pick-up & delivery', 'CBD areas only'],
  },
] as const;

const HOME_FAQ_IDS = [
  'book-pickup',
  'pickup-lead-time',
  'track-order',
  'service-areas',
  'weight-estimate',
] as const;

/** Handpicked FAQ teaser for the homepage, sourced from the canonical FAQ data. */
export const HOME_FAQS: FaqItem[] = FAQ_CATEGORIES.flatMap((category) => category.items).filter(
  (item) => (HOME_FAQ_IDS as readonly string[]).includes(item.id),
);
