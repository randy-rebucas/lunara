'use client';

import { useCallback, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { MetricCell } from './metric-cell';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';

interface UserRow {
  _id: string;
  email?: string;
  phone?: string;
  role: string;
  branchId?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

const ROLES = ['customer', 'rider', 'partner', 'staff', 'admin'] as const;
type RoleFilter = (typeof ROLES)[number] | '';

const ROLE_BADGE: Record<string, string> = {
  admin:    'bg-violet-100 text-violet-700',
  partner:  'bg-blue-100 text-blue-700',
  staff:    'bg-sky-100 text-sky-700',
  rider:    'bg-amber-100 text-amber-700',
  customer: 'bg-slate-100 text-slate-600',
};

function fmt(date?: string) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(date?: string) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function IconBtn({
  label, onClick, disabled, children, danger,
}: {
  label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-40 ${
        danger ? 'text-red-400 hover:bg-red-50 hover:text-red-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function IconActivate() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="10" cy="10" r="7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 10l2 2 4-4" />
    </svg>
  );
}

function IconDeactivate() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="10" cy="10" r="7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 12.5l5-5M12.5 12.5l-5-5" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="7" y="3" width="9" height="12" rx="1.5" />
      <path strokeLinecap="round" d="M4 7h2M4 10h2M4 13h2" />
      <path strokeLinecap="round" d="M7 6H5.5A1.5 1.5 0 004 7.5v8A1.5 1.5 0 005.5 17h7a1.5 1.5 0 001.5-1.5V15" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2.5" y="5" width="15" height="11" rx="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 7l7.5 5 7.5-5" />
    </svg>
  );
}

export function UsersBoard() {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => adminFetch<UserRow[]>('/users'), []);
  const { data, loading, error, reload, setData } = useAdminQuery(load, []);

  const users = data ?? [];

  const counts = useMemo(() => {
    return Object.fromEntries(ROLES.map((r) => [r, users.filter((u) => u.role === r).length]));
  }, [users]);

  const activeCount = useMemo(() => users.filter((u) => u.isActive).length, [users]);

  const searched = useMemo(() => {
    let list = users;
    if (roleFilter) list = list.filter((u) => u.role === roleFilter);
    return filterBySearch(list, search, [(u) => u.email, (u) => u.phone, (u) => u.role, (u) => u._id]);
  }, [users, search, roleFilter]);

  const visible = useMemo(() => searched.slice(0, limit), [searched, limit]);

  async function toggleActive(id: string, next: boolean) {
    setBusyId(id);
    try {
      const updated = await adminFetch<UserRow>(`/users/${id}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      });
      setData((prev) => (prev ?? []).map((u) => (u._id === id ? updated : u)));
    } catch {
      // leave state unchanged on error
    } finally {
      setBusyId(null);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
  }

  const roleFilterOptions = [
    { value: '' as RoleFilter, label: 'All roles', count: users.length },
    ...ROLES.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) + 's', count: counts[r] ?? 0 })),
  ];

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Accounts</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Users
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              All registered accounts — customers, riders, partners, staff, and admins.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => void reload()}
              disabled={loading}
            >
              {loading ? 'Syncing…' : 'Sync'}
            </button>
          </div>
        </div>
      </header>

      {error && <div className="alert-error mb-4" role="alert">{error}</div>}

      {loading && !data ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
          Loading users…
        </div>
      ) : null}

      {data ? (
        <div className="space-y-3">
          {/* ── Metric row ────────────────────────────────────────── */}
          <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            <MetricCell label="Active" value={activeCount} highlight={activeCount > 0 ? 'accent' : undefined} />
            {ROLES.map((r) => (
              <MetricCell key={r} label={r.charAt(0).toUpperCase() + r.slice(1) + 's'} value={counts[r] ?? 0} />
            ))}
          </div>

          {/* ── List controls + table ─────────────────────────────── */}
          <ListControls
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by email, phone, or ID…"
            limit={limit}
            onLimitChange={setLimit}
            limitOptions={[25, 50, 100, 250]}
            total={searched.length}
            filtered={visible.length}
            filterValue={roleFilter}
            onFilterChange={(v) => setRoleFilter(v as RoleFilter)}
            filterOptions={roleFilterOptions}
            filterLabel="Role"
          />

          <section className="dc-panel">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">User roster</h2>
                <p className="text-xs text-muted">
                  Showing {visible.length} of {searched.length}{roleFilter ? ` ${roleFilter}s` : ' users'}
                </p>
              </div>
            </div>

            {visible.length === 0 ? (
              <div className="dc-panel-empty">
                <p className="font-medium text-slate-900">No users found</p>
                <p className="mt-1 text-sm text-muted">Try a different search or role filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Email / Phone</th>
                      <th scope="col">Role</th>
                      <th scope="col">Status</th>
                      <th scope="col">Last login</th>
                      <th scope="col">Joined</th>
                      <th scope="col" className="w-24"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((u) => (
                      <tr key={u._id} className="group">
                        <td>
                          <div className="flex flex-col gap-0.5">
                            {u.email && <span className="text-sm font-medium text-slate-900">{u.email}</span>}
                            {u.phone && <span className="text-xs text-muted">{u.phone}</span>}
                            {!u.email && !u.phone && <span className="text-xs text-muted">—</span>}
                            <span className="font-mono text-[10px] text-muted/50">{u._id}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${ROLE_BADGE[u.role] ?? 'bg-slate-100 text-slate-600'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          {u.isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />Inactive
                            </span>
                          )}
                        </td>
                        <td className="text-sm text-muted">{fmtTime(u.lastLoginAt)}</td>
                        <td className="text-sm text-muted">{fmt(u.createdAt)}</td>
                        <td>
                          <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <IconBtn
                              label={u.isActive ? 'Deactivate account' : 'Activate account'}
                              disabled={busyId === u._id}
                              danger={u.isActive}
                              onClick={() => toggleActive(u._id, !u.isActive)}
                            >
                              {u.isActive ? <IconDeactivate /> : <IconActivate />}
                            </IconBtn>
                            <IconBtn
                              label={copied === `id-${u._id}` ? 'Copied!' : 'Copy user ID'}
                              onClick={() => copy(u._id, `id-${u._id}`)}
                            >
                              <IconClipboard />
                            </IconBtn>
                            {u.email && (
                              <IconBtn
                                label={copied === `email-${u._id}` ? 'Copied!' : 'Copy email'}
                                onClick={() => copy(u.email!, `email-${u._id}`)}
                              >
                                <IconMail />
                              </IconBtn>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
