'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { adminLogout, getAdminUser } from '../../lib/admin-api';
import type { User } from '@lunara/types';

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function ProfileDetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="text-sm text-slate-900 sm:text-right">{value}</dd>
    </div>
  );
}

export default function AdminProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getAdminUser());
  }, []);

  async function logout() {
    await adminLogout();
    router.replace('/login');
  }

  const displayName = user?.email ?? user?.phone ?? 'Admin';

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Your signed-in admin account. Contact platform ops to change role or access."
      />

      <Card className="max-w-2xl">
        <CardBody>
          <div className="mb-6 flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
              {(displayName[0] ?? 'A').toUpperCase()}
            </span>
            <div>
              <p className="text-lg font-semibold text-slate-900">{displayName}</p>
              <p className="text-sm capitalize text-muted">{user?.role ?? 'admin'}</p>
            </div>
          </div>

          <dl>
            <ProfileDetailRow label="Email" value={user?.email ?? '—'} />
            <ProfileDetailRow label="Phone" value={user?.phone ?? '—'} />
            <ProfileDetailRow label="User ID" value={<span className="font-mono text-xs">{user?.id ?? '—'}</span>} />
            <ProfileDetailRow
              label="Account status"
              value={
                user?.isActive === false ? (
                  <span className="text-destructive">Inactive</span>
                ) : (
                  <span className="text-emerald-600">Active</span>
                )
              }
            />
            <ProfileDetailRow label="Last login" value={formatDate(user?.lastLoginAt)} />
            <ProfileDetailRow label="Member since" value={formatDate(user?.createdAt)} />
          </dl>

          <div className="mt-8 flex flex-wrap gap-3 border-t border-border/60 pt-6">
            <button type="button" onClick={logout} className="btn-outline">
              Sign out
            </button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
