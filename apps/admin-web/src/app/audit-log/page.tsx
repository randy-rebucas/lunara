'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/page-header';
import { adminFetch } from '../../lib/admin-api';

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
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [actions, setActions] = useState<string[]>([]);
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
      const res = await adminFetch<AuditLogPage>(`/admin/audit-logs?${params.toString()}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [page, search, action]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    adminFetch<string[]>('/admin/audit-logs/actions')
      .then(setActions)
      .catch(() => setActions([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, action]);

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every create, update, and delete action taken in the admin panel, attributed to the admin who did it."
      />

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
            Showing {data.items.length} of {data.total}
          </p>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {loading && <p className="mt-4 text-sm text-muted">Loading…</p>}

      {!loading && data && data.items.length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">No audit log entries found.</p>
        </div>
      )}

      {!loading && data && data.items.length > 0 && (
        <>
          <div className="section-panel mt-6 overflow-hidden">
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
                  {data.items.map((entry) => (
                    <Fragment key={entry._id}>
                      <tr
                        className="cursor-pointer"
                        onClick={() =>
                          setExpandedId((id) => (id === entry._id ? null : entry._id))
                        }
                      >
                        <td className="whitespace-nowrap text-muted">
                          {formatDate(entry.createdAt)}
                        </td>
                        <td className="font-medium text-slate-900">{entry.actorEmail}</td>
                        <td className="text-muted">{entry.action}</td>
                        <td className="text-muted">{entry.method}</td>
                        <td>
                          <span
                            className={
                              entry.statusCode >= 400 ? 'badge-error text-xs' : 'badge-accent text-xs'
                            }
                          >
                            {entry.statusCode}
                          </span>
                        </td>
                      </tr>
                      {expandedId === entry._id && (
                        <tr>
                          <td colSpan={5} className="bg-surface-subtle">
                            <div className="p-3 text-xs">
                              <p className="text-muted">
                                <span className="font-medium text-slate-900">Path:</span> {entry.path}
                              </p>
                              {entry.ip && (
                                <p className="mt-1 text-muted">
                                  <span className="font-medium text-slate-900">IP:</span> {entry.ip}
                                </p>
                              )}
                              {entry.requestBody && (
                                <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-2 text-slate-100">
                                  {JSON.stringify(entry.requestBody, null, 2)}
                                </pre>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
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
