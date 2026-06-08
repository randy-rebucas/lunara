'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { UserRole, type PortalUser } from '@lunara/types';
import type { PartnerSettingsData } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { useProtectedPage } from '../../hooks/use-protected-page';
import { getPortalUser, isPartnerRole, partnerFetch, staffLogout } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="text-sm text-slate-900 sm:text-right">{value}</dd>
    </div>
  );
}

function roleLabel(role?: PortalUser['role']) {
  if (role === UserRole.PARTNER) return 'Partner';
  if (role === UserRole.STAFF) return 'Staff';
  if (role === UserRole.ADMIN) return 'Admin';
  return role ?? '—';
}

export default function PortalProfilePage() {
  const router = useRouter();
  const { ready } = useProtectedPage({
    roles: [UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN],
  });
  const [user, setUser] = useState<PortalUser | null>(null);
  const partner = isPartnerRole();

  const loadShop = useCallback(() => partnerFetch<PartnerSettingsData>('/partner/settings'), []);
  const { data: shopData, loading: shopLoading, error: shopError } = usePartnerQuery(loadShop, [ready]);

  useEffect(() => {
    setUser(getPortalUser());
  }, []);

  async function logout() {
    await staffLogout();
    router.replace('/login');
  }

  if (!ready) return <AuthLoading message="Loading profile…" />;

  const displayName = user?.email ?? 'Portal user';
  const branch = shopData?.branch;

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Your signed-in portal account and shop branch."
      />

      <Card className="max-w-2xl">
        <CardBody>
          <div className="mb-6 flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
              {(displayName[0] ?? 'P').toUpperCase()}
            </span>
            <div>
              <p className="text-lg font-semibold text-slate-900">{displayName}</p>
              <p className="text-sm text-muted">{roleLabel(user?.role)}</p>
            </div>
          </div>

          <dl>
            <DetailRow label="Email" value={user?.email ?? '—'} />
            <DetailRow label="Role" value={roleLabel(user?.role)} />
            <DetailRow
              label="Shop branch"
              value={
                shopLoading ? (
                  'Loading…'
                ) : branch ? (
                  <span>
                    {branch.name}{' '}
                    <span className="font-mono text-xs text-primary">({branch.code})</span>
                  </span>
                ) : shopError ? (
                  'Could not load branch'
                ) : (
                  '—'
                )
              }
            />
            {branch && (
              <DetailRow
                label="Address"
                value={`${branch.line1}, ${branch.city}, ${branch.province}`}
              />
            )}
          </dl>

          <div className="mt-8 flex flex-wrap gap-3 border-t border-border/60 pt-6">
            <Link href="/settings" className="btn-outline">
              Shop settings
            </Link>
            {partner && (
              <Link href="/staff" className="btn-outline">
                Staff team
              </Link>
            )}
            <button type="button" onClick={logout} className="btn-ghost text-red-600">
              Sign out
            </button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
