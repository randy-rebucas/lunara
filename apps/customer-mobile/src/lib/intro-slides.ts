import type { Ionicons } from '@expo/vector-icons';

export interface IntroSlide {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

// keep copy in sync with apps/customer-web/src/lib/intro-slides.ts
export const INTRO_SLIDES: IntroSlide[] = [
  { key: 'welcome', title: 'Welcome', description: 'Find trusted laundry shops, choose your services, and schedule your laundry pickup—all from your phone.', icon: 'layers-outline' },
  { key: 'book', title: 'Book pickup', description: 'Schedule a convenient pickup and keep track of your laundry from collection to delivery.', icon: 'calendar-outline' },
  { key: 'track', title: 'Track orders', description: 'Follow your laundry in real time, from pickup to delivery, with live status updates every step of the way.', icon: 'map-outline' },
  { key: 'pay', title: 'Pay securely', description: 'Check out with your wallet or card and enjoy fast, secure payments for every order.', icon: 'wallet-outline' },
];
