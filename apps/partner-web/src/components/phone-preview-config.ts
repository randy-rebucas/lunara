/** Content for the three coded phone-mockup screens (Intro, Sign in, Book). Kept as
 * plain data — separate from phone-preview-mockup.tsx's rendering — so copy can be
 * tweaked without touching component code. Branding (logo, business name, accent
 * color) is applied on top of this at render time, not baked in here. */

export interface PhonePreviewConfig {
  intro: {
    tagline: string;
    headline: string;
    subheadline: string;
    primaryCta: string;
    secondaryCta: string;
    trustLine: string;
    paymentMethods: string[];
    featuresHeading: string;
    features: { icon: 'calendar' | 'box' | 'wallet'; label: string; description: string }[];
    promo: string;
  };
  auth: {
    tagline: string;
    headline: string;
    subheadline: string;
    tabs: string[];
    phonePlaceholder: string;
    helperText: string;
    trustItems: { icon: 'shield' | 'zap' | 'bell'; title: string; description: string }[];
    submitCta: string;
    signupPrompt: string;
    signupCta: string;
  };
  book: {
    title: string;
    stepLabel: string;
    sectionHeading: string;
    autoPick: { title: string; description: string };
    otherShops: { name: string; location: string; status: string; price: string; badge?: string }[];
    pointerLabel: string;
  };
}

export const PHONE_PREVIEW_CONFIG: PhonePreviewConfig = {
  intro: {
    tagline: 'Laundry made simple',
    headline: 'Laundry made simple',
    subheadline: 'Laundry made simple',
    primaryCta: 'Get started',
    secondaryCta: 'Sign in',
    trustLine: 'Secure · Reliable · Convenient',
    paymentMethods: ['GCash', 'Maya', 'Visa', 'Mastercard'],
    featuresHeading: 'Everything you need in one app',
    features: [
      { icon: 'calendar', label: 'Book pickup', description: 'Schedule in minutes' },
      { icon: 'box', label: 'Track orders', description: 'Live status updates' },
      { icon: 'wallet', label: 'Pay securely', description: 'Wallet & checkout' },
    ],
    promo: 'New here? Get 20% off your first order!',
  },
  auth: {
    tagline: 'Laundry made simple',
    headline: 'Welcome back!',
    subheadline: 'Sign in to book and track your laundry.',
    tabs: ['Phone OTP', 'Email'],
    phonePlaceholder: 'Mobile number',
    helperText: 'Enter your number without the leading 0 — country code is already applied.',
    trustItems: [
      { icon: 'shield', title: 'Secure & private', description: 'Your data is safe with us.' },
      { icon: 'zap', title: 'Quick & easy', description: 'Sign in in seconds with OTP.' },
      { icon: 'bell', title: 'Stay updated', description: 'Get order updates instantly.' },
    ],
    submitCta: 'Send OTP',
    signupPrompt: 'New here?',
    signupCta: 'Create account',
  },
  book: {
    title: 'Book laundry',
    stepLabel: 'Step 2 of 8 · Shop',
    sectionHeading: 'Choose a laundry shop',
    autoPick: {
      title: 'Let Lunara pick for you',
      description: 'Best available shop nearby — handy when your usual spot is full.',
    },
    otherShops: [
      {
        name: "Van's Laundry Shop - Baybay",
        location: 'City of Baybay · 108.7 km',
        status: 'Open until 5:00 PM',
        price: 'From ₱39.00 / kg',
        badge: 'Outside delivery range',
      },
      {
        name: 'Jelave laundromat - Zone 2',
        location: 'City of Baybay · 108.7 km',
        status: 'Open until 5:00 PM',
        price: 'From ₱39.00 / kg',
      },
    ],
    pointerLabel: 'shows up here',
  },
};
