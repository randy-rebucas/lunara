import type { Metadata } from 'next';
import { buildPageMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Create account',
  description: 'Create your account to book laundry pickup and delivery.',
  path: '/register',
  noindex: true,
});

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
