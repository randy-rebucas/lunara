import type { Metadata } from 'next';
import { buildPageMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Book laundry pickup — create your free account',
  description:
    'Sign up in minutes with your mobile number. Book a laundry pickup, track your order live, and pay with GCash, card, wallet, or cash.',
  path: '/signup',
});

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
