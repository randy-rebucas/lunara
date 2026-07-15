import type { Metadata } from 'next';
import { buildPageMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Sign in',
  description: 'Sign in to your account to book pickups, track orders, and manage your laundry.',
  path: '/login',
  noindex: true,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
