'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardBody, SectionPanel } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { adminLogout, getAdminUser } from '../../lib/admin-api';
import { formatSlugLabel } from '../../lib/format-label';
import type { User } from '@lunara/types';

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function formatRelativeLogin(iso?: string) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  return null;
}

function ProfileField({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="border-b border-border/60 px-6 py-4 last:border-0 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1.5 text-sm text-slate-900">{value}</div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export default function AdminProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUser(getAdminUser());
  }, []);

  async function logout() {
    await adminLogout();
    router.replace('/login');
  }

  async function copyUserId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — ignore
    }
  }

  if (user === undefined) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Profile" description="Your signed-in admin account." />
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Profile" description="Your signed-in admin account." />
        <Card className="max-w-md">
          <CardBody>
            <p className="text-sm text-muted">No active session. Sign in to view your profile.</p>
            <Link href="/login" className="btn-primary btn-sm mt-4 inline-flex">
              Sign in
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const displayName = user.email ?? user.phone ?? 'Admin';
  const relativeLogin = formatRelativeLogin(user.lastLoginAt);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Profile"
        description="Your signed-in admin account. Contact platform ops to change role or access."
        actions={
          <Link href="/settings" className="btn-outline btn-sm">
            App settings
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
        <Card className="lg:sticky lg:top-6">
          <CardBody className="flex flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
              {(displayName[0] ?? 'A').toUpperCase()}
            </span>
            <p className="mt-4 text-base font-semibold text-slate-900">{displayName}</p>
            <span className="badge-primary mt-2 capitalize">{formatSlugLabel(user.role)}</span>
            <p className="mt-3 text-xs text-muted">
              {user.isActive === false ? (
                <span className="badge-danger">Inactive account</span>
              ) : (
                <span className="badge-accent">Active</span>
              )}
            </p>
          </CardBody>
        </Card>

        <div className="min-w-0 space-y-6">
          <SectionPanel title="Account" description="Identity tied to this admin console session.">
            <ProfileField label="Email" value={user.email ?? '—'} />
            <ProfileField label="Phone" value={user.phone ?? '—'} />
            <ProfileField
              label="User ID"
              value={
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="text-code break-all">{user.id}</span>
                  <button
                    type="button"
                    className="link-primary text-xs font-medium"
                    onClick={() => void copyUserId(user.id)}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </span>
              }
              hint="Use when coordinating with engineering or support."
            />
          </SectionPanel>

          <SectionPanel title="Session" description="Activity on this device.">
            <ProfileField
              label="Last login"
              value={formatDateTime(user.lastLoginAt)}
              hint={relativeLogin ?? undefined}
            />
            <ProfileField label="Member since" value={formatDateTime(user.createdAt)} />
            <div className="border-t border-border/60 px-6 py-4 sm:px-8">
              <p className="text-xs text-muted">
                Role and activation are managed by platform administrators — not editable here.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => void logout()} className="btn-outline btn-sm">
                  Sign out
                </button>
                <Link href="/" className="btn-outline btn-sm">
                  Ops center
                </Link>
              </div>
            </div>
          </SectionPanel>

          <Card>
            <CardBody className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Shortcuts</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/settings" className="link-primary">
                    App settings
                  </Link>
                  <span className="text-muted"> — display and alert preferences</span>
                </li>
                <li>
                  <Link href="/control-tower" className="link-primary">
                    Control tower
                  </Link>
                  <span className="text-muted"> — live ops overview</span>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
