'use client';

import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Camera,
  Download,
  KeyRound,
  Laptop,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Truck,
  Upload,
  UserCog,
  Users as UsersIcon,
} from 'lucide-react';
import { filterBySearch, ListControls } from '../list-controls';
import { adminFetch, adminUpload } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';
import { exportCsv, parseCsv } from '../../lib/export-csv';

interface UserRow {
  _id: string;
  email?: string;
  phone?: string;
  role: string;
  branchId?: string;
  department?: string;
  photoUrl?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

interface AuditLogPage {
  items: {
    _id: string;
    action: string;
    method: string;
    statusCode: number;
    createdAt: string;
  }[];
  total: number;
}

interface BranchOption {
  _id: string;
  code: string;
  name: string;
}

type DetailTab = 'profile' | 'permissions' | 'activity' | 'sessions';

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'activity', label: 'Activity' },
  { id: 'sessions', label: 'Sessions' },
];

const ROLES = ['customer', 'rider', 'partner', 'staff', 'admin'] as const;
type RoleFilter = (typeof ROLES)[number] | '';
type StatusTab = 'all' | 'active' | 'inactive';

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-700',
  partner: 'bg-blue-100 text-blue-700',
  staff: 'bg-sky-100 text-sky-700',
  rider: 'bg-amber-100 text-amber-700',
  customer: 'bg-slate-100 text-slate-600',
};

const ROLE_AVATAR: Record<string, string> = {
  admin: 'bg-violet-500/10 text-violet-600',
  partner: 'bg-blue-500/10 text-blue-600',
  staff: 'bg-sky-500/10 text-sky-600',
  rider: 'bg-amber-500/10 text-amber-600',
  customer: 'bg-primary/10 text-primary',
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

function timeAgo(value?: string | Date | null): string {
  if (!value) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function displayName(u: UserRow): string {
  return u.email ?? u.phone ?? 'User';
}

function initial(u: UserRow): string {
  return (displayName(u)[0] ?? 'U').toUpperCase();
}

// ── Small blocks ───────────────────────────────────────────────────────────
const TILE_TONES = {
  primary: 'bg-primary/[0.04] ring-primary/15',
  accent: 'bg-accent/[0.04] ring-accent/20',
  secondary: 'bg-secondary/[0.04] ring-secondary/15',
  amber: 'bg-amber-500/[0.04] ring-amber-500/20',
  violet: 'bg-violet-500/[0.04] ring-violet-500/20',
  rose: 'bg-rose-500/[0.04] ring-rose-500/20',
} as const;

const TILE_ICON_TONES = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  secondary: 'bg-secondary/10 text-secondary',
  amber: 'bg-amber-500/10 text-amber-600',
  violet: 'bg-violet-500/10 text-violet-600',
  rose: 'bg-rose-500/10 text-rose-600',
} as const;

function StatTile({
  label,
  value,
  sub,
  tone,
  icon,
  onClick,
  active,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TILE_TONES;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  active?: boolean;
}) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl p-4 text-left ring-1 transition-all hover:shadow-[var(--shadow-elevated)] ${TILE_TONES[tone]} ${
        active ? 'ring-2 ring-primary/40' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TILE_ICON_TONES[tone]}`}
          aria-hidden
        >
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-xs font-medium text-muted">{label}</p>
      </div>
      <p className="dc-value mt-2">{value}</p>
      {sub ? <p className="dc-sublabel mt-0.5">{sub}</p> : null}
    </button>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 px-5 py-4 first:border-0">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Avatar({ user, size }: { user: UserRow; size: 'sm' | 'lg' }) {
  const dims = size === 'sm' ? 'h-9 w-9 text-sm' : 'h-14 w-14 text-xl';
  if (user.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={user.photoUrl}
        alt=""
        className={`${dims} shrink-0 rounded-full object-cover`}
        aria-hidden
      />
    );
  }
  return (
    <span
      className={`flex ${dims} shrink-0 items-center justify-center rounded-full font-semibold ${
        ROLE_AVATAR[user.role] ?? ROLE_AVATAR.customer
      }`}
      aria-hidden
    >
      {initial(user)}
    </span>
  );
}

function RailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 break-all text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

// ── Board ──────────────────────────────────────────────────────────────────
export function UsersBoard() {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [detailTab, setDetailTab] = useState<DetailTab>('profile');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState('');
  const [departmentDraft, setDepartmentDraft] = useState('');
  const [savingDepartment, setSavingDepartment] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [cleaningSpam, setCleaningSpam] = useState(false);
  const [spamCleanupResult, setSpamCleanupResult] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => adminFetch<UserRow[]>('/users'), []);
  const { data, loading, error, reload, setData } = useAdminQuery(load, []);

  const loadBranches = useCallback(() => adminFetch<BranchOption[]>('/admin/branches'), []);
  const { data: branches } = useAdminQuery(loadBranches, []);
  const branchName = useMemo(() => {
    const map = new Map((branches ?? []).map((b) => [b._id, b.name]));
    return (id?: string) => (id ? (map.get(id) ?? '—') : '—');
  }, [branches]);

  const users = useMemo(() => data ?? [], [data]);

  const counts = useMemo(
    () => Object.fromEntries(ROLES.map((r) => [r, users.filter((u) => u.role === r).length])),
    [users],
  );
  const activeCount = useMemo(() => users.filter((u) => u.isActive).length, [users]);
  const newThisMonth = useMemo(() => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    return users.filter((u) => new Date(u.createdAt) >= startOfMonth).length;
  }, [users]);

  const departmentOptions = useMemo(() => {
    const depts = new Set(users.map((u) => u.department).filter((d): d is string => !!d));
    return [...depts].sort((a, b) => a.localeCompare(b));
  }, [users]);

  const searched = useMemo(() => {
    let list = users;
    if (roleFilter) list = list.filter((u) => u.role === roleFilter);
    if (departmentFilter) list = list.filter((u) => u.department === departmentFilter);
    if (statusTab === 'active') list = list.filter((u) => u.isActive);
    if (statusTab === 'inactive') list = list.filter((u) => !u.isActive);
    return filterBySearch(list, search, [(u) => u.email, (u) => u.phone, (u) => u.role, (u) => u._id]);
  }, [users, search, roleFilter, departmentFilter, statusTab]);

  const visible = useMemo(() => searched.slice(0, limit), [searched, limit]);

  const selected = useMemo(
    () => (selectedId ? (users.find((u) => u._id === selectedId) ?? null) : null),
    [users, selectedId],
  );

  // Recent audit activity for the selected user — only admins/staff appear as audit actors
  const selectedEmail = selected && (selected.role === 'admin' || selected.role === 'staff') ? selected.email : null;
  const loadActivity = useCallback(async (): Promise<AuditLogPage | null> => {
    if (!selectedEmail) return null;
    return adminFetch<AuditLogPage>(
      `/admin/audit-logs?actorEmail=${encodeURIComponent(selectedEmail)}&limit=5`,
    );
  }, [selectedEmail]);
  const activity = useAdminQuery(loadActivity, [selectedEmail]);

  async function toggleActive(id: string, next: boolean) {
    setBusyId(id);
    setActionError('');
    try {
      const updated = await adminFetch<UserRow>(`/users/${id}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      });
      setData((prev) => (prev ?? []).map((u) => (u._id === id ? updated : u)));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update account status');
    } finally {
      setBusyId(null);
    }
  }

  async function sendPasswordReset(email: string) {
    setResetState('sending');
    setActionError('');
    try {
      await adminFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setResetState('sent');
      window.setTimeout(() => setResetState('idle'), 3000);
    } catch (e) {
      setResetState('error');
      setActionError(e instanceof Error ? e.message : 'Failed to send reset email');
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
  }

  function selectUser(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
    setResetState('idle');
    setActionError('');
    setDetailTab('profile');
    setDepartmentDraft(users.find((u) => u._id === id)?.department ?? '');
  }

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCheckAll() {
    setCheckedIds((prev) =>
      prev.size === visible.length ? new Set() : new Set(visible.map((u) => u._id)),
    );
  }

  async function bulkActivate(isActive: boolean) {
    const ids = Array.from(checkedIds);
    if (!ids.length) return;
    setBulkBusy(true);
    setActionError('');
    try {
      const updated = await adminFetch<UserRow[]>('/users/bulk-active', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, isActive }),
      });
      const byId = new Map(updated.map((u) => [u._id, u]));
      setData((prev) => (prev ?? []).map((u) => byId.get(u._id) ?? u));
      setCheckedIds(new Set());
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Bulk update failed');
    } finally {
      setBulkBusy(false);
    }
  }

  function exportSelected() {
    // With nothing checked, export every row matching the active filters/search — not just the
    // current page's `limit`-capped `visible` slice, which would silently truncate the export.
    const rows = checkedIds.size > 0 ? users.filter((u) => checkedIds.has(u._id)) : searched;
    exportCsv(
      `users-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Email', 'Phone', 'Role', 'Department', 'Branch', 'Status', 'Last login', 'Joined'],
      rows.map((u) => [
        u.email ?? '',
        u.phone ?? '',
        u.role,
        u.department ?? '',
        branchName(u.branchId),
        u.isActive ? 'Active' : 'Inactive',
        fmtTime(u.lastLoginAt),
        fmt(u.createdAt),
      ]),
    );
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportSummary('');
    setActionError('');
    try {
      const text = await file.text();
      const [header, ...rows] = parseCsv(text);
      const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name);
      const emailCol = col('email');
      const phoneCol = col('phone');
      const roleCol = col('role');
      const deptCol = col('department');
      if (emailCol === -1 || roleCol === -1) {
        throw new Error('CSV must include "email" and "role" columns');
      }
      const importRows = rows.map((r) => ({
        email: r[emailCol],
        phone: phoneCol >= 0 ? r[phoneCol] : undefined,
        role: r[roleCol],
        department: deptCol >= 0 ? r[deptCol] : undefined,
      }));
      const results = await adminFetch<{ email: string; status: string; message?: string }[]>(
        '/users/import',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: importRows }),
        },
      );
      const created = results.filter((r) => r.status === 'created').length;
      const updated = results.filter((r) => r.status === 'updated').length;
      const failed = results.filter((r) => r.status === 'error').length;
      setImportSummary(`Imported: ${created} created, ${updated} updated, ${failed} failed`);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }

  async function cleanupSpam() {
    if (!window.confirm('Delete all accounts with "APPSBUILDERSPH" in their email? This cannot be undone.')) {
      return;
    }
    setCleaningSpam(true);
    setActionError('');
    setSpamCleanupResult('');
    try {
      const result = await adminFetch<{ deletedCount: number }>('/users/cleanup-spam', {
        method: 'POST',
      });
      setSpamCleanupResult(`Deleted ${result.deletedCount} spam account${result.deletedCount === 1 ? '' : 's'}.`);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Spam cleanup failed');
    } finally {
      setCleaningSpam(false);
    }
  }

  async function saveDepartment() {
    if (!selected) return;
    setSavingDepartment(true);
    setActionError('');
    try {
      const updated = await adminFetch<UserRow>(`/users/${selected._id}/department`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: departmentDraft }),
      });
      setData((prev) => (prev ?? []).map((u) => (u._id === updated._id ? updated : u)));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to save department');
    } finally {
      setSavingDepartment(false);
    }
  }

  async function handlePhotoChange(file: File) {
    if (!selected) return;
    setPhotoUploading(true);
    setActionError('');
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const updated = await adminUpload<UserRow>(`/users/${selected._id}/photo`, formData);
      setData((prev) => (prev ?? []).map((u) => (u._id === updated._id ? updated : u)));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Photo upload failed');
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  const roleFilterOptions = [
    { value: '' as RoleFilter, label: 'All roles', count: users.length },
    ...ROLES.map((r) => ({
      value: r,
      label: r.charAt(0).toUpperCase() + r.slice(1) + 's',
      count: counts[r] ?? 0,
    })),
  ];

  const departmentFilterOptions = [
    { value: '', label: 'All departments', count: users.length },
    ...departmentOptions.map((d) => ({
      value: d,
      label: d,
      count: users.filter((u) => u.department === d).length,
    })),
  ];

  const STATUS_TABS: { id: StatusTab; label: string; count: number }[] = [
    { id: 'all', label: 'All users', count: users.length },
    { id: 'active', label: 'Active', count: activeCount },
    { id: 'inactive', label: 'Inactive', count: users.length - activeCount },
  ];

  return (
    <div>
      {/* ── Header ── */}
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Accounts</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Users
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Manage all registered accounts — customers, riders, partners, staff, and admins.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => void reload()}
              disabled={loading}
            >
              {loading ? 'Syncing…' : 'Sync'}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
              }}
            />
            <button
              type="button"
              className="btn-outline btn-sm gap-1.5"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              {importing ? 'Importing…' : 'Import users'}
            </button>
            <button
              type="button"
              className="btn-outline btn-sm gap-1.5 !text-red-600"
              onClick={() => void cleanupSpam()}
              disabled={cleaningSpam}
            >
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
              {cleaningSpam ? 'Cleaning…' : 'Clean up spam'}
            </button>
            <Link href="/riders" className="btn-outline btn-sm">
              Riders
            </Link>
            <Link href="/partners/new" className="btn-primary btn-sm">
              Add partner
            </Link>
          </div>
        </div>
      </header>

      {error && <div className="alert-error mb-4" role="alert">{error}</div>}
      {actionError && <div className="alert-error mb-4" role="alert">{actionError}</div>}
      {importSummary && <div className="alert-info mb-4" role="status">{importSummary}</div>}
      {spamCleanupResult && <div className="alert-info mb-4" role="status">{spamCleanupResult}</div>}

      {loading && !data ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
          Loading users…
        </div>
      ) : null}

      {data ? (
        <div className="space-y-4">
          {/* ── Stat tiles — click role tiles to filter ── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile
              label="Total users"
              value={users.length.toLocaleString()}
              sub={newThisMonth > 0 ? `+${newThisMonth} this month` : 'no new this month'}
              tone="primary"
              icon={UsersIcon}
              onClick={() => setRoleFilter('')}
              active={roleFilter === ''}
            />
            <StatTile
              label="Active accounts"
              value={activeCount.toLocaleString()}
              sub={users.length > 0 ? `${Math.round((activeCount / users.length) * 100)}% of total` : undefined}
              tone="accent"
              icon={ShieldCheck}
              onClick={() => {
                setRoleFilter('');
                setStatusTab('active');
              }}
              active={statusTab === 'active' && roleFilter === ''}
            />
            <StatTile
              label="Customers"
              value={(counts.customer ?? 0).toLocaleString()}
              tone="secondary"
              icon={UsersIcon}
              onClick={() => setRoleFilter('customer')}
              active={roleFilter === 'customer'}
            />
            <StatTile
              label="Riders"
              value={(counts.rider ?? 0).toLocaleString()}
              tone="amber"
              icon={Truck}
              onClick={() => setRoleFilter('rider')}
              active={roleFilter === 'rider'}
            />
            <StatTile
              label="Partners"
              value={(counts.partner ?? 0).toLocaleString()}
              tone="rose"
              icon={Building2}
              onClick={() => setRoleFilter('partner')}
              active={roleFilter === 'partner'}
            />
            <StatTile
              label="Team"
              value={((counts.staff ?? 0) + (counts.admin ?? 0)).toLocaleString()}
              sub={`${counts.admin ?? 0} admin · ${counts.staff ?? 0} staff`}
              tone="violet"
              icon={UserCog}
              onClick={() => setRoleFilter('admin')}
              active={roleFilter === 'admin' || roleFilter === 'staff'}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            {/* ── Roster ── */}
            <section className="dc-panel min-w-0 xl:col-span-8">
              {/* Status tabs */}
              <div
                className="overflow-x-auto overflow-y-hidden border-b border-border/60 px-3"
                role="tablist"
                aria-label="User status"
              >
                <div className="flex min-w-max gap-1">
                  {STATUS_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={statusTab === t.id}
                      onClick={() => setStatusTab(t.id)}
                      className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-medium transition-colors ${
                        statusTab === t.id
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-slate-600">
                        {t.count.toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-4 pb-1">
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
                  filter2Value={departmentOptions.length > 0 ? departmentFilter : undefined}
                  onFilter2Change={departmentOptions.length > 0 ? setDepartmentFilter : undefined}
                  filter2Options={departmentOptions.length > 0 ? departmentFilterOptions : undefined}
                  filter2Label="Department"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {checkedIds.size > 0 ? (
                    <>
                      <span className="text-sm text-muted">{checkedIds.size} selected</span>
                      <button
                        type="button"
                        className="btn-outline btn-sm"
                        disabled={bulkBusy}
                        onClick={() => void bulkActivate(true)}
                      >
                        Activate
                      </button>
                      <button
                        type="button"
                        className="btn-outline btn-sm !text-red-600"
                        disabled={bulkBusy}
                        onClick={() => void bulkActivate(false)}
                      >
                        Deactivate
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="btn-outline btn-sm ml-auto gap-1.5"
                    onClick={exportSelected}
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Export{checkedIds.size > 0 ? ` (${checkedIds.size})` : ''}
                  </button>
                </div>
              </div>

              {visible.length === 0 ? (
                <div className="dc-panel-empty">
                  <p className="font-medium text-slate-900">No users found</p>
                  <p className="mt-1 text-sm text-muted">Try a different search, role, or status tab.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[620px]">
                    <caption className="sr-only">Registered platform users</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="w-8">
                          <input
                            type="checkbox"
                            aria-label="Select all visible users"
                            checked={visible.length > 0 && checkedIds.size === visible.length}
                            onChange={toggleCheckAll}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary/25"
                          />
                        </th>
                        <th scope="col">User</th>
                        <th scope="col">Role</th>
                        <th scope="col">Department</th>
                        <th scope="col">Branch</th>
                        <th scope="col">Status</th>
                        <th scope="col">Last login</th>
                        <th scope="col">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((u) => {
                        const isSelected = selectedId === u._id;
                        return (
                          <tr
                            key={u._id}
                            onClick={() => selectUser(u._id)}
                            aria-selected={isSelected}
                            className={`cursor-pointer ${isSelected ? 'bg-primary/5 hover:bg-primary/5' : ''}`}
                          >
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Select ${displayName(u)}`}
                                checked={checkedIds.has(u._id)}
                                onChange={() => toggleChecked(u._id)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/25"
                              />
                            </td>
                            <td>
                              <div className="flex items-center gap-3">
                                <Avatar user={u} size="sm" />
                                <div className="min-w-0">
                                  <p className="max-w-[14rem] truncate text-sm font-medium text-slate-900" title={u.email}>
                                    {u.email ?? '—'}
                                  </p>
                                  <p className="text-xs text-muted">{u.phone ?? ''}</p>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                                  ROLE_BADGE[u.role] ?? 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="whitespace-nowrap text-sm text-muted">{u.department ?? '—'}</td>
                            <td className="whitespace-nowrap text-sm text-muted">{branchName(u.branchId)}</td>
                            <td>
                              {u.isActive ? (
                                <span className="badge-accent">Active</span>
                              ) : (
                                <span className="badge-neutral">Inactive</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap text-sm text-muted">{fmtTime(u.lastLoginAt)}</td>
                            <td className="whitespace-nowrap text-sm text-muted">{fmt(u.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── User details rail ── */}
            <div className="xl:col-span-4">
              {!selected ? (
                <section className="dc-panel">
                  <div className="dc-panel-header">
                    <h2 className="text-sm font-semibold text-slate-900">User details</h2>
                  </div>
                  <p className="px-5 py-8 text-center text-sm text-muted">
                    Select a user row to view details and account actions.
                  </p>
                </section>
              ) : (
                <section className="dc-panel">
                  <div className="dc-panel-header flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">User details</h2>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      aria-label="Close detail panel"
                      onClick={() => setSelectedId(null)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="relative shrink-0">
                      <Avatar user={selected} size="lg" />
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handlePhotoChange(file);
                        }}
                      />
                      <button
                        type="button"
                        className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white ring-2 ring-surface disabled:opacity-50"
                        aria-label="Upload photo"
                        disabled={photoUploading}
                        onClick={() => photoInputRef.current?.click()}
                      >
                        <Camera className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900" title={displayName(selected)}>
                        {displayName(selected)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                            ROLE_BADGE[selected.role] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {selected.role}
                        </span>
                        {selected.isActive ? (
                          <span className="badge-accent">Active</span>
                        ) : (
                          <span className="badge-neutral">Inactive</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex gap-1 overflow-x-auto border-b border-border/60 px-3"
                    role="tablist"
                    aria-label="User detail sections"
                  >
                    {DETAIL_TABS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={detailTab === t.id}
                        onClick={() => setDetailTab(t.id)}
                        className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                          detailTab === t.id
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted hover:text-slate-900'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {detailTab === 'profile' ? (
                    <>
                  <RailSection title="Contact">
                    <RailRow
                      label="Email"
                      value={
                        selected.email ? (
                          <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            {selected.email}
                            <button
                              type="button"
                              className="link-primary text-xs font-medium"
                              onClick={() => copy(selected.email!, 'email')}
                            >
                              {copied === 'email' ? 'Copied' : 'Copy'}
                            </button>
                          </span>
                        ) : (
                          '—'
                        )
                      }
                    />
                    <RailRow
                      label="Phone"
                      value={
                        selected.phone ? (
                          <a href={`tel:${selected.phone}`} className="link-primary">
                            {selected.phone}
                          </a>
                        ) : (
                          '—'
                        )
                      }
                    />
                  </RailSection>

                  <RailSection title="Account">
                    <RailRow
                      label="User ID"
                      value={
                        <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <span className="text-code">{selected._id}</span>
                          <button
                            type="button"
                            className="link-primary text-xs font-medium"
                            onClick={() => copy(selected._id, 'id')}
                          >
                            {copied === 'id' ? 'Copied' : 'Copy'}
                          </button>
                        </span>
                      }
                    />
                    <RailRow label="Joined" value={fmt(selected.createdAt)} />
                    <RailRow label="Last login" value={fmtTime(selected.lastLoginAt)} />
                    <RailRow label="Branch" value={branchName(selected.branchId)} />
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="shrink-0 text-muted">Department</span>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <input
                          type="text"
                          value={departmentDraft}
                          onChange={(e) => setDepartmentDraft(e.target.value)}
                          placeholder="e.g. Operations"
                          className="w-32 rounded-md bg-surface px-2 py-1 text-right text-sm ring-1 ring-border/60 focus:outline-none focus:ring-2 focus:ring-primary/25"
                        />
                        <button
                          type="button"
                          className="link-primary text-xs font-medium disabled:opacity-50"
                          disabled={savingDepartment || departmentDraft === (selected.department ?? '')}
                          onClick={() => void saveDepartment()}
                        >
                          {savingDepartment ? 'Saving…' : 'Save'}
                        </button>
                      </span>
                    </div>
                  </RailSection>

                  <RailSection title="Quick actions">
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        disabled={busyId === selected._id}
                        onClick={() => void toggleActive(selected._id, !selected.isActive)}
                        className={selected.isActive ? 'btn-outline btn-sm w-full !text-red-600' : 'btn-primary btn-sm w-full'}
                      >
                        {busyId === selected._id
                          ? 'Updating…'
                          : selected.isActive
                            ? 'Deactivate account'
                            : 'Activate account'}
                      </button>
                      {selected.email ? (
                        <button
                          type="button"
                          className="btn-outline btn-sm w-full"
                          disabled={resetState === 'sending' || resetState === 'sent'}
                          onClick={() => void sendPasswordReset(selected.email!)}
                        >
                          {resetState === 'sending'
                            ? 'Sending…'
                            : resetState === 'sent'
                              ? 'Reset link sent'
                              : 'Send password reset'}
                        </button>
                      ) : null}
                      {selected.role === 'rider' ? (
                        <Link href="/riders" className="btn-outline btn-sm w-full text-center">
                          Open rider management
                        </Link>
                      ) : null}
                      {selected.role === 'partner' ? (
                        <Link href="/partners" className="btn-outline btn-sm w-full text-center">
                          Open partner shops
                        </Link>
                      ) : null}
                    </div>
                  </RailSection>
                    </>
                  ) : null}

                  {detailTab === 'permissions' ? (
                    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                      <Shield className="h-8 w-8 text-muted-foreground" aria-hidden />
                      <p className="text-sm font-medium text-slate-900">Permissions not available</p>
                      <p className="max-w-xs text-sm text-muted">
                        Role-based permission editing isn&apos;t wired up yet — this account currently
                        inherits the fixed capabilities of the <span className="capitalize">{selected.role}</span> role.
                      </p>
                    </div>
                  ) : null}

                  {detailTab === 'activity' ? (
                    selectedEmail ? (
                      <RailSection title="Recent activity">
                        {activity.loading && !activity.data ? (
                          <p className="text-sm text-muted">Loading activity…</p>
                        ) : null}
                        {activity.data && activity.data.items.length === 0 ? (
                          <p className="text-sm text-muted">No logged admin actions yet.</p>
                        ) : null}
                        {activity.data && activity.data.items.length > 0 ? (
                          <>
                            <ul className="space-y-2">
                              {activity.data.items.map((entry) => (
                                <li key={entry._id} className="flex items-center gap-2 text-sm">
                                  <span
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                      entry.statusCode < 400 ? 'bg-emerald-500' : 'bg-red-500'
                                    }`}
                                    aria-hidden
                                  />
                                  <span className="min-w-0 flex-1 truncate text-slate-900" title={entry.action}>
                                    {entry.action.replace(/^(get|post|patch|put|delete)\./i, '')}
                                  </span>
                                  <span className="shrink-0 text-xs tabular-nums text-muted">
                                    {timeAgo(entry.createdAt)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            <Link href="/audit-log" className="link-primary text-xs font-medium">
                              View full audit log{activity.data.total > activity.data.items.length ? ` (${activity.data.total} total)` : ''} →
                            </Link>
                          </>
                        ) : null}
                      </RailSection>
                    ) : (
                      <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                        <KeyRound className="h-8 w-8 text-muted-foreground" aria-hidden />
                        <p className="text-sm font-medium text-slate-900">No admin activity</p>
                        <p className="max-w-xs text-sm text-muted">
                          Activity logging only tracks admin and staff actions — this account type
                          isn&apos;t an audit actor.
                        </p>
                      </div>
                    )
                  ) : null}

                  {detailTab === 'sessions' ? (
                    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                      <Laptop className="h-8 w-8 text-muted-foreground" aria-hidden />
                      <p className="text-sm font-medium text-slate-900">Session tracking not available</p>
                      <p className="max-w-xs text-sm text-muted">
                        Device and active-session tracking isn&apos;t implemented yet — accounts don&apos;t
                        currently record login devices.
                      </p>
                    </div>
                  ) : null}
                </section>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
