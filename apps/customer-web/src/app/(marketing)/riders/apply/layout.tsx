import type { Metadata } from 'next';
import { buildPageMetadata } from '../../../../lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Apply as a delivery rider',
  description:
    'Apply to become a pickup and delivery rider. Flexible schedules, clear tasks, and weekly earnings tracking.',
  path: '/riders/apply',
});

export default function RiderApplyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
