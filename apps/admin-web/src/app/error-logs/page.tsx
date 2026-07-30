'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/page-header';
import { adminFetch } from '../../lib/admin-api';

interface ErrorLogEntry {
  _id: string;
  source: 'api' | 'admin-web' | 'customer-web' | 'partner-web';
  message: string;
  stack?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  userRole?: string;
  context?: Record<string, unknown> | null;
  createdAt: string;
}

interface ErrorLogPage {
  items: ErrorLogEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  bySource: Record<string, number>;
}

const SOURCES: ErrorLogEntry['source'][] = ['api', 'admin-web', 'customer-web', 'partner-web'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
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

function sourceBadgeClass(source: string) {
  if (source === 'api') return 'badge-danger';
  return 'badge-secondary';
}

export default function ErrorLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [data, setData] = useState<ErrorLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search.trim()) params.set('search', search.trim());
      if (source) params.set('source', source);
      const res = await adminFetch<ErrorLogPage>(`/admin/error-logs?${params.toString()}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load error logs');
    } finally {
      setLoading(false);
    }
  }, [page, search, source]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, source]);

  return (
    <div>
      <PageHeader
        title="Error logs"
        description="Server-side 5xx failures and frontend crash reports, captured automatically — no third-party service involved."
      />

      {data ? (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {SOURCES.map((s) => (
            <div key={s} className="rounded-xl bg-primary/[0.04] p-4 ring-1 ring-primary/15">
              <p className="text-xs font-medium text-muted">{s}</p>
              <p className="dc-value mt-1">{(data.bySource[s] ?? 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="error-search" className="form-label">
            Search
          </label>
          <input
            id="error-search"
            type="search"
            className="input-field w-full"
            placeholder="Message, path…"
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

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setSource('')}
          className={source === '' ? 'filter-chip-active' : 'filter-chip'}
        >
          All sources
        </button>
        {SOURCES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSource(s)}
            className={source === s ? 'filter-chip-active' : 'filter-chip'}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {loading && !data && <p className="mt-4 text-sm text-muted">Loading…</p>}

      {!loading && data && data.items.length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">No errors logged. Good sign.</p>
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
                    <th>Source</th>
                    <th>Message</th>
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
                          <td>
                            <span className={sourceBadgeClass(entry.source)}>{entry.source}</span>
                          </td>
                          <td className="max-w-[28rem] truncate" title={entry.message}>
                            {entry.message}
                          </td>
                          <td>
                            {entry.statusCode ? (
                              <span className="badge-danger">{entry.statusCode}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={4} className="bg-surface-muted">
                              <div className="space-y-1.5 p-3 text-xs">
                                {entry.path && (
                                  <p className="text-muted">
                                    <span className="font-medium text-slate-900">Path:</span>{' '}
                                    <span className="text-code">
                                      {entry.method ? `${entry.method} ` : ''}
                                      {entry.path}
                                    </span>
                                  </p>
                                )}
                                {entry.userRole && (
                                  <p className="text-muted">
                                    <span className="font-medium text-slate-900">Actor role:</span>{' '}
                                    <span className="capitalize">{entry.userRole}</span>
                                  </p>
                                )}
                                <p className="text-muted">
                                  <span className="font-medium text-slate-900">Timestamp:</span>{' '}
                                  {formatDate(entry.createdAt)}
                                </p>
                                {entry.stack && (
                                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-slate-100">
                                    {entry.stack}
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
