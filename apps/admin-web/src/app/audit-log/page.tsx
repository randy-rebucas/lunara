'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/page-header';
import { adminFetch } from '../../lib/admin-api';
import { formatSlugLabel } from '../../lib/format-label';

interface AuditLogEntry {
  _id: string;
  actorEmail: string;
  actorRole: string;
  method: string;
  path: string;
  action: string;
  statusCode: number;
  requestBody: Record<string, unknown> | null;
  params: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

interface AuditLogPage {
  items: AuditLogEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  stats: {
    failedTotal: number;
    uniqueActors: number;
    topAction: { action: string; count: number } | null;
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function methodBadgeClass(method: string) {
  if (method === 'DELETE') return 'badge-danger';
  if (method === 'POST') return 'badge-primary';
  if (method === 'PATCH' || method === 'PUT') return 'badge-secondary';
  return 'badge-neutral';
}

function actionLabel(action: string): string {
  return formatSlugLabel(action.replace(/^(get|post|patch|put|delete)\./i, ''));
}

// ── Stat tiles (matches the rest of the admin suite) ───────────────────────
const TILE_TONES = {
  primary: 'bg-primary/[0.04] ring-primary/15',
  accent: 'bg-accent/[0.04] ring-accent/20',
  secondary: 'bg-secondary/[0.04] ring-secondary/15',
  rose: 'bg-rose-500/[0.04] ring-rose-500/20',
  violet: 'bg-violet-500/[0.04] ring-violet-500/20',
} as const;

function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TILE_TONES;
}) {
  return (
    <div className={`rounded-xl p-4 ring-1 ${TILE_TONES[tone]}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="dc-value mt-1">{value}</p>
      {sub ? <p className="dc-sublabel mt-0.5 truncate">{sub}</p> : null}
    </div>
  );
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [method, setMethod] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [data, setData] = useState<AuditLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search.trim()) params.set('search', search.trim());
      if (action) params.set('action', action);
      if (method) params.set('method', method);
      const res = await adminFetch<AuditLogPage>(`/admin/audit-logs?${params.toString()}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [page, search, action, method]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    adminFetch<string[]>('/admin/audit-logs/actions')
      .then(setActions)
      .catch(() => setActions([]));
    adminFetch<string[]>('/admin/audit-logs/methods')
      .then(setMethods)
      .catch(() => setMethods([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, action, method]);

  const filtersActive = Boolean(search || action || method);

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every create, update, and delete action taken in the admin panel, attributed to the admin who did it."
      />

      {data ? (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Matching actions"
            value={data.total.toLocaleString()}
            sub={filtersActive ? 'current filter' : 'all time'}
            tone="primary"
          />
          <StatTile
            label="Failed requests"
            value={data.stats.failedTotal.toLocaleString()}
            sub="status 400+"
            tone={data.stats.failedTotal > 0 ? 'rose' : 'accent'}
          />
          <StatTile
            label="Admins involved"
            value={data.stats.uniqueActors.toLocaleString()}
            sub="unique actors"
            tone="secondary"
          />
          <StatTile
            label="Most common action"
            value={data.stats.topAction ? String(data.stats.topAction.count) : '—'}
            sub={data.stats.topAction ? actionLabel(data.stats.topAction.action) : 'no data'}
            tone="violet"
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="audit-action" className="form-label">
            Action
          </label>
          <select
            id="audit-action"
            className="input-field"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="audit-search" className="form-label">
            Search
          </label>
          <input
            id="audit-search"
            type="search"
            className="input-field w-full"
            placeholder="Admin email, action, path…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {data && (
          <p className="pb-2 text-sm text-muted">
            Showing {data.items.length} of {data.total.toLocaleString()}
          </p>
        )}
      </div>

      {methods.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setMethod('')}
            className={method === '' ? 'filter-chip-active' : 'filter-chip'}
          >
            All methods
          </button>
          {methods.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={method === m ? 'filter-chip-active' : 'filter-chip'}
            >
              {m}
            </button>
          ))}
        </div>
      ) : null}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {loading && !data && <p className="mt-4 text-sm text-muted">Loading…</p>}

      {!loading && data && data.items.length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">No audit log entries found.</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="section-panel mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Admin</th>
                    <th>Action</th>
                    <th>Method</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((entry) => {
                    const isExpanded = expandedId === entry._id;
                    return (
                      <Fragment key={entry._id}>
                        <tr
                          className="cursor-pointer"
                          aria-expanded={isExpanded}
                          onClick={() => setExpandedId((id) => (id === entry._id ? null : entry._id))}
                        >
                          <td className="whitespace-nowrap text-muted" title={formatDate(entry.createdAt)}>
                            {timeAgo(entry.createdAt)}
                          </td>
                          <td className="max-w-[14rem] truncate font-medium text-slate-900" title={entry.actorEmail}>
                            {entry.actorEmail}
                          </td>
                          <td className="text-muted">{actionLabel(entry.action)}</td>
                          <td>
                            <span className={methodBadgeClass(entry.method)}>{entry.method}</span>
                          </td>
                          <td>
                            <span
                              className={entry.statusCode >= 400 ? 'badge-danger' : 'badge-accent'}
                            >
                              {entry.statusCode}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="bg-surface-muted">
                              <div className="space-y-1.5 p-3 text-xs">
                                <p className="text-muted">
                                  <span className="font-medium text-slate-900">Path:</span>{' '}
                                  <span className="text-code">{entry.path}</span>
                                </p>
                                <p className="text-muted">
                                  <span className="font-medium text-slate-900">Role:</span>{' '}
                                  <span className="capitalize">{entry.actorRole}</span>
                                </p>
                                <p className="text-muted">
                                  <span className="font-medium text-slate-900">Timestamp:</span>{' '}
                                  {formatDate(entry.createdAt)}
                                </p>
                                {entry.ip && (
                                  <p className="text-muted">
                                    <span className="font-medium text-slate-900">IP:</span> {entry.ip}
                                  </p>
                                )}
                                {entry.requestBody && (
                                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-slate-100">
                                    {JSON.stringify(entry.requestBody, null, 2)}
                                  </pre>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="text-sm text-muted">
              Page {data.page} of {data.totalPages}
            </span>
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
