'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { adminFetch, adminLogout, getAdminUser } from '../../lib/admin-api';
import { formatSlugLabel } from '../../lib/format-label';
import { useAdminQuery } from '../../lib/use-admin-query';
import type { User } from '@lunara/types';

// ── Formatting helpers ─────────────────────────────────────────────────────
function formatDateTime(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return iso;
  }
}

function timeAgo(value?: string | Date): string {
  if (!value) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

// ── Audit log types ────────────────────────────────────────────────────────
interface AuditLogEntry {
  _id: string;
  action: string;
  method: string;
  path: string;
  statusCode: number;
  createdAt: string;
}

interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
}

// ── Small building blocks ──────────────────────────────────────────────────
function Icon({ d, d2, className = 'h-4 w-4' }: { d: string; d2?: string; className?: string }) {
  return (
    <svg className={`${className} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      {d2 && <path strokeLinecap="round" strokeLinejoin="round" d={d2} />}
    </svg>
  );
}

const icons = {
  mail: <Icon d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
  phone: <Icon d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />,
  calendar: <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  id: <Icon d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />,
  user: <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  shield: <Icon d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
  activity: <Icon d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  key: <Icon d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />,
  signout: <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
};

type TabId = 'account' | 'security' | 'activity';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'account', label: 'Account information', icon: icons.user },
  { id: 'security', label: 'Security', icon: icons.shield },
  { id: 'activity', label: 'Activity log', icon: icons.activity },
];

function Field({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1.5 text-sm text-slate-900">{value}</div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const SUMMARY_TONES = {
  primary: 'bg-primary/[0.04] ring-primary/15',
  accent: 'bg-accent/[0.04] ring-accent/20',
  amber: 'bg-amber-500/[0.04] ring-amber-500/20',
  violet: 'bg-violet-500/[0.04] ring-violet-500/20',
} as const;

function SummaryTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof SUMMARY_TONES;
}) {
  return (
    <div className={`rounded-lg p-4 ring-1 ${SUMMARY_TONES[tone]}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

function methodTone(method: string): string {
  if (method === 'DELETE') return 'badge-danger';
  if (method === 'POST') return 'badge-primary';
  return 'badge-secondary';
}

/** Action labels come as "patch.admin.settings.app-version" — the method badge already shows the verb. */
function actionLabel(action: string): string {
  return action.replace(/^(get|post|patch|put|delete)\./i, '');
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function AdminProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [tab, setTab] = useState<TabId>('account');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUser(getAdminUser());
  }, []);

  const userEmail = user?.email ?? null;
  const loadActivity = useCallback(async (): Promise<AuditLogPage | null> => {
    if (!userEmail) return null;
    return adminFetch<AuditLogPage>(
      `/admin/audit-logs?actorEmail=${encodeURIComponent(userEmail)}&limit=10`,
    );
  }, [userEmail]);
  const activity = useAdminQuery(loadActivity, [userEmail]);

  // Security tab — password reset via the standard email flow
  const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resetError, setResetError] = useState('');

  async function sendPasswordReset() {
    if (!userEmail) return;
    setResetState('sending');
    setResetError('');
    try {
      await adminFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: userEmail }),
      });
      setResetState('sent');
    } catch (e) {
      setResetState('error');
      setResetError(e instanceof Error ? e.message : 'Failed to send reset email');
    }
  }

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
      <div>
        <PageHeader title="My profile" description="Manage your account information, security, and activity." />
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <PageHeader title="My profile" description="Manage your account information, security, and activity." />
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

  const displayName = user.email ? user.email.split('@')[0] : (user.phone ?? 'Admin');
  const memberDays = daysSince(user.createdAt);
  const actionsLogged = activity.data?.total ?? null;

  return (
    <div>
      <PageHeader
        title="My profile"
        description="Manage your account information, security, and activity."
        actions={
          <Link href="/settings" className="btn-outline btn-sm">
            System settings
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-12 xl:items-start">
        {/* ── Identity card ── */}
        <Card className="xl:col-span-3 xl:sticky xl:top-20">
          <CardBody className="flex flex-col items-center text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-3xl font-semibold text-primary">
              {(displayName[0] ?? 'A').toUpperCase()}
            </span>
            <p className="mt-4 text-base font-semibold capitalize text-slate-900">{displayName}</p>
            <span className="badge-primary mt-2 capitalize">{formatSlugLabel(user.role)}</span>
            <div className="mt-3">
              {user.isActive === false ? (
                <span className="badge-danger">Inactive account</span>
              ) : (
                <span className="badge-accent">Active</span>
              )}
            </div>

            <ul className="mt-5 w-full space-y-2.5 border-t border-border/60 pt-5 text-left text-sm">
              <li className="flex items-center gap-2.5 text-muted">
                <span className="text-primary">{icons.mail}</span>
                <span className="min-w-0 truncate text-slate-900" title={user.email ?? undefined}>
                  {user.email ?? '—'}
                </span>
              </li>
              <li className="flex items-center gap-2.5 text-muted">
                <span className="text-primary">{icons.phone}</span>
                <span className="text-slate-900">{user.phone ?? '—'}</span>
              </li>
              <li className="flex items-center gap-2.5 text-muted">
                <span className="text-primary">{icons.calendar}</span>
                <span className="text-slate-900">Joined {formatDate(user.createdAt)}</span>
              </li>
            </ul>

            <button type="button" onClick={() => void logout()} className="btn-outline btn-sm mt-5 w-full">
              Sign out
            </button>
          </CardBody>
        </Card>

        {/* ── Tabbed detail card ── */}
        <section className="section-panel min-w-0 xl:col-span-6">
          <div
            className="overflow-x-auto overflow-y-hidden border-b border-border/60 px-3"
            role="tablist"
            aria-label="Profile sections"
          >
            <div className="flex min-w-max gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-medium transition-colors ${
                    tab === t.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted hover:text-slate-900'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tab === 'account' ? (
            <div className="grid gap-5 px-6 py-5 sm:grid-cols-2">
              <Field label="Email address" value={user.email ?? '—'} />
              <Field label="Phone number" value={user.phone ?? '—'} />
              <Field label="Role" value={<span className="capitalize">{formatSlugLabel(user.role)}</span>} />
              <Field
                label="Status"
                value={
                  user.isActive === false ? (
                    <span className="badge-danger">Inactive</span>
                  ) : (
                    <span className="badge-accent">Active</span>
                  )
                }
              />
              <Field label="Member since" value={formatDateTime(user.createdAt)} />
              <Field label="Last login" value={formatDateTime(user.lastLoginAt)} hint={timeAgo(user.lastLoginAt)} />
              <div className="sm:col-span-2">
                <Field
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
              </div>
              <p className="text-xs text-muted sm:col-span-2">
                Contact details, role, and activation are managed by platform administrators — not editable here.
              </p>
            </div>
          ) : null}

          {tab === 'security' ? (
            <div className="divide-y divide-border/60">
              <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <span className="text-primary">{icons.key}</span>
                    Password
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Password changes go through the email reset flow. We&apos;ll send a reset link to{' '}
                    <span className="font-medium text-slate-900">{user.email ?? 'your email'}</span>.
                  </p>
                  {resetState === 'sent' ? (
                    <p className="mt-2 text-sm font-medium text-accent">
                      Reset link sent — check your inbox.
                    </p>
                  ) : null}
                  {resetState === 'error' ? <p className="mt-2 text-sm text-destructive">{resetError}</p> : null}
                </div>
                <button
                  type="button"
                  className="btn-outline btn-sm shrink-0"
                  disabled={resetState === 'sending' || resetState === 'sent' || !user.email}
                  onClick={() => void sendPasswordReset()}
                >
                  {resetState === 'sending' ? 'Sending…' : 'Send reset link'}
                </button>
              </div>

              <div className="px-6 py-5">
                <p className="text-sm font-medium text-slate-900">Session</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted">Last login</dt>
                    <dd className="text-slate-900">{formatDateTime(user.lastLoginAt)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted">Session lifetime</dt>
                    <dd className="text-slate-900">7 days, then re-authentication is required</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="btn-outline btn-sm mt-4 inline-flex items-center gap-2"
                >
                  {icons.signout}
                  Sign out of this device
                </button>
              </div>

              <div className="px-6 py-5">
                <p className="text-sm font-medium text-slate-900">Access</p>
                <p className="mt-1 text-sm text-muted">
                  Admin permissions are granted per role. Every change you make is recorded in the{' '}
                  <Link href="/audit-log" className="link-primary">
                    audit log
                  </Link>
                  .
                </p>
              </div>
            </div>
          ) : null}

          {tab === 'activity' ? (
            <div>
              {activity.loading && !activity.data ? (
                <p className="px-6 py-6 text-sm text-muted">Loading activity…</p>
              ) : null}
              {activity.error ? (
                <p className="px-6 py-6 text-sm text-destructive">{activity.error}</p>
              ) : null}
              {activity.data && activity.data.items.length === 0 ? (
                <p className="px-6 py-6 text-sm text-muted">
                  No logged actions yet. Mutating admin actions (create, update, delete) appear here.
                </p>
              ) : null}
              {activity.data && activity.data.items.length > 0 ? (
                <>
                  <ul className="divide-y divide-border/40">
                    {activity.data.items.map((entry) => (
                      <li key={entry._id} className="flex items-center gap-3 px-6 py-3">
                        <span className={`${methodTone(entry.method)} shrink-0`}>{entry.method}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{actionLabel(entry.action)}</p>
                          <p className="text-code truncate text-muted" title={entry.path}>
                            {entry.path}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={`text-xs font-semibold tabular-nums ${
                              entry.statusCode < 400 ? 'text-accent' : 'text-red-600'
                            }`}
                          >
                            {entry.statusCode}
                          </p>
                          <p className="text-xs tabular-nums text-muted">{timeAgo(entry.createdAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-border/60 px-6 py-3">
                    <Link href="/audit-log" className="link-primary text-xs font-medium">
                      View full audit log →
                    </Link>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* ── Right rail ── */}
        <div className="space-y-5 xl:col-span-3">
          <section className="section-panel">
            <div className="section-panel-header">
              <h3 className="text-sm font-semibold text-slate-900">Account summary</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <SummaryTile
                label="Actions logged"
                value={actionsLogged != null ? actionsLogged.toLocaleString() : '—'}
                sub="all time"
                tone="primary"
              />
              <SummaryTile
                label="Member since"
                value={memberDays != null ? `${memberDays}d` : '—'}
                sub={formatDate(user.createdAt)}
                tone="accent"
              />
              <SummaryTile label="Last login" value={timeAgo(user.lastLoginAt)} tone="amber" />
              <SummaryTile
                label="Status"
                value={user.isActive === false ? 'Inactive' : 'Active'}
                sub={formatSlugLabel(user.role)}
                tone="violet"
              />
            </div>
          </section>

          <section className="section-panel">
            <div className="section-panel-header">
              <h3 className="text-sm font-semibold text-slate-900">Quick links</h3>
            </div>
            <ul className="divide-y divide-border/40 text-sm">
              {[
                { href: '/settings', label: 'System settings', sub: 'platform configuration' },
                { href: '/audit-log', label: 'Audit log', sub: 'all admin activity' },
                { href: '/users', label: 'Users & roles', sub: 'manage admin accounts' },
                { href: '/control-tower', label: 'Control tower', sub: 'live ops overview' },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="flex items-center justify-between gap-2 px-5 py-3 transition-colors hover:bg-primary/5"
                  >
                    <span>
                      <span className="block font-medium text-slate-900">{l.label}</span>
                      <span className="text-xs text-muted">{l.sub}</span>
                    </span>
                    <span className="text-muted" aria-hidden>
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
