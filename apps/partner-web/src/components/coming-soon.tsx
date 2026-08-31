'use client';

import { AuthLoading } from './auth-loading';
import { PageHeader } from './ui/page-header';
import { useRequirePartner } from '../hooks/use-protected-page';

export function ComingSoonPage({
  title,
  description,
  eyebrow = 'Coming soon',
}: {
  title: string;
  description: string;
  eyebrow?: string;
}) {
  const { ready } = useRequirePartner();
  if (!ready) return <AuthLoading message={`Loading ${title.toLowerCase()}…`} />;

  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="mt-6 rounded-xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
        <p className="mt-2 font-medium text-slate-700">This section isn&apos;t built yet.</p>
        <p className="mt-1 text-sm text-muted">
          It&apos;s reserved in the navigation so the layout is ready when this feature ships.
        </p>
      </div>
    </div>
  );
}
