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

export const PARTNER_BENEFITS = [
  'More bookings',
  'Rider network',
  'Customer app',
  'Admin dashboard',
  'Analytics & reports',
  'Digital payments',
  'Marketing support',
  'Operations support',
] as const;

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
  };
}

/** Groups service areas by partner, falling back to one group per branch when no partnerId is present. */
export function groupServiceAreasByPartner(areas: ServiceArea[]) {
  const groups = new Map<string, { partnerId: string; partnerName: string; branches: ServiceArea[] }>();
  for (const area of areas) {
    const key = area.partnerId ?? area.id;
    const existing = groups.get(key);
    if (existing) {
      existing.branches.push(area);
    } else {
      groups.set(key, {
        partnerId: key,
        partnerName: area.partnerName || area.name,
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
  {
    name: 'Paolo D.',
    initials: 'PD',
    location: 'Salcedo Village',
    rating: 5,
    quote:
      'I work night shifts, so the flexible pickup windows are a lifesaver. Dropped off my laundry bag and it was back the next day.',
    avatarColor: 'primary' as const,
  },
  {
    name: 'Kristine V.',
    initials: 'KV',
    location: 'Kamuning',
    rating: 4,
    quote:
      'Great service overall. One pickup got rescheduled, but support messaged me right away and the rider arrived in the new window.',
    avatarColor: 'secondary' as const,
  },
  {
    name: 'Miguel S.',
    initials: 'MS',
    location: 'McKinley Hill',
    rating: 5,
    quote:
      'The live map tracking is my favorite part. I always know exactly when the rider is arriving — no more waiting around.',
    avatarColor: 'accent' as const,
  },
  {
    name: 'Denise L.',
    initials: 'DL',
    location: 'Legazpi Village',
    rating: 5,
    quote:
      'Sent in office uniforms and delicate blouses. Everything came back pressed, bagged, and smelling fresh. Very professional.',
    avatarColor: 'primary' as const,
  },
  {
    name: 'Carlo M.',
    initials: 'CM',
    location: 'Timog',
    rating: 5,
    quote:
      'Express wash saved me before a business trip — picked up in the morning, delivered clean by mid-afternoon.',
    avatarColor: 'secondary' as const,
  },
  {
    name: 'Bianca F.',
    initials: 'BF',
    location: 'Bonifacio Global City',
    rating: 5,
    quote:
      'As a mom of three, laundry used to eat my whole weekend. Now it is two taps on my phone. Worth every peso.',
    avatarColor: 'accent' as const,
  },
  {
    name: 'Rafael G.',
    initials: 'RG',
    location: 'South Triangle',
    rating: 4,
    quote:
      'Solid and consistent. Prices are fair and the app shows the breakdown before you confirm, so there are no surprises.',
    avatarColor: 'primary' as const,
  },
  {
    name: 'Joyce A.',
    initials: 'JA',
    location: 'Makati CBD',
    rating: 5,
    quote:
      'The refer-a-friend credits stack up fast. I have paid for two full loads with rewards alone.',
    avatarColor: 'secondary' as const,
  },
  {
    name: 'Nathan P.',
    initials: 'NP',
    location: 'Taguig',
    rating: 5,
    quote:
      'Comforters and bedsheets used to be a hassle at the laundromat. Lunara picks them up, and they come back like new.',
    avatarColor: 'accent' as const,
  },
] as const;

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
