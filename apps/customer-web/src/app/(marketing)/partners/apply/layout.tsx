import type { Metadata } from 'next';
import { buildPageMetadata } from '../../../../lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Apply as a laundry partner',
  description:
    'Apply to join the partner network. Submit your business details and permits — our team reviews applications within a few business days.',
  path: '/partners/apply',
});

export default function PartnerApplyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
