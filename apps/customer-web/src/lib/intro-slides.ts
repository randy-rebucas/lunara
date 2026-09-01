import { Calendar, Layers, Route, Wallet, type LucideIcon } from 'lucide-react';

export interface IntroSlide {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

// keep copy in sync with apps/customer-mobile/src/lib/intro-slides.ts
export const INTRO_SLIDES: IntroSlide[] = [
  { key: 'welcome', title: 'Welcome', description: 'Find trusted laundry shops, choose your services, and schedule your laundry pickup—all from your phone.', icon: Layers },
  { key: 'book', title: 'Book pickup', description: 'Schedule a convenient pickup and keep track of your laundry from collection to delivery.', icon: Calendar },
  { key: 'track', title: 'Track orders', description: 'Follow your laundry in real time, from pickup to delivery, with live status updates every step of the way.', icon: Route },
  { key: 'pay', title: 'Pay securely', description: 'Check out with your wallet or card and enjoy fast, secure payments for every order.', icon: Wallet },
];
