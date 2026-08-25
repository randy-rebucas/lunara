import type { Metadata } from 'next';
import { buildPageMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Verify email',
  description: 'Verify your email address to activate your Lunara account.',
  path: '/verify-email',
  noindex: true,
});

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
