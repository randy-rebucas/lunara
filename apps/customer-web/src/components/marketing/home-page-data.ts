export const HERO_STATS = [
  { value: '3 min', label: 'Average booking time' },
  { value: 'Live', label: 'Order tracking' },
  { value: '4+', label: 'Payment options' },
] as const;

export const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Book a pickup',
    description:
      'Choose wash, dry clean, or express service. Pick a time slot and confirm your order with a clear price breakdown.',
  },
  {
    step: '2',
    title: 'Rider collects',
    description:
      'A Lunara rider picks up from your home or office. Pin your address for accurate routing and handoff.',
  },
  {
    step: '3',
    title: 'Partner processes',
    description:
      'Trusted laundry partners wash, dry, and fold your clothes. Track every step from shop to dispatch.',
  },
  {
    step: '4',
    title: 'Delivered fresh',
    description:
      'Get laundry returned to your door. Pay your way — GCash, card, wallet, or cash — and rate your experience.',
  },
] as const;

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

export const WHY_CHOOSE = [
  {
    label: 'Convenience',
    title: 'Door-to-door convenience',
    description: 'No laundromat trips. Schedule pickup and delivery around your day.',
    accent: 'primary' as const,
  },
  {
    label: 'Pricing',
    title: 'Transparent pricing',
    description: 'See service rates, add-ons, and delivery fees before you confirm.',
    accent: 'secondary' as const,
  },
  {
    label: 'Tracking',
    title: 'Live order tracking',
    description: 'Follow pickup, shop processing, and delivery in real time on web or mobile.',
    accent: 'accent' as const,
  },
  {
    label: 'Payments',
    title: 'Flexible payments',
    description: 'GCash, card, Lunara wallet, or cash on pickup or delivery.',
    accent: 'primary' as const,
  },
  {
    label: 'Partners',
    title: 'Trusted partner network',
    description: 'Vetted laundry shops with quality standards and operations support.',
    accent: 'secondary' as const,
  },
  {
    label: 'Rewards',
    title: 'Promos & wallet',
    description: 'Apply deals at checkout, top up your wallet, and manage refunds in one place.',
    accent: 'accent' as const,
  },
] as const;

export const CUSTOMER_REVIEWS = [
  {
    name: 'Maria C.',
    location: 'Makati',
    rating: 5,
    quote:
      'Booking took less than five minutes. The rider was on time and I tracked everything until delivery.',
  },
  {
    name: 'James R.',
    location: 'BGC',
    rating: 5,
    quote:
      'Finally laundry that fits my schedule. Pricing was clear upfront and the clothes came back perfectly folded.',
  },
  {
    name: 'Angela T.',
    location: 'Quezon City',
    rating: 5,
    quote:
      'Used the mobile app and web — both work great. Wallet top-up and GCash checkout made paying easy.',
  },
] as const;

export const PARTNER_HIGHLIGHTS = [
  {
    name: 'Lunara Makati',
    city: 'Makati',
    specialty: 'Wash & fold · Dry cleaning',
    highlight: 'Same-day express available for CBD addresses',
  },
  {
    name: 'Lunara Quezon City',
    city: 'Quezon City',
    specialty: 'Wash, dry & fold · Uniforms',
    highlight: 'High-volume family loads with careful sorting',
  },
  {
    name: 'Lunara BGC',
    city: 'Taguig',
    specialty: 'Premium press · Delicates',
    highlight: 'Office-ready laundry for professionals on the go',
  },
] as const;
