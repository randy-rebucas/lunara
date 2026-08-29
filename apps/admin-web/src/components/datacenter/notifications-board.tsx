'use client';

import { useCallback, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';

type Audience = 'all' | 'customer' | 'rider' | 'partner' | 'staff';

interface AudienceCounts {
  customer?: number;
  rider?: number;
  partner?: number;
  staff?: number;
  admin?: number;
}

interface BroadcastHistoryItem {
  id: string;
  title: string;
  body: string;
  audience: string;
  sentCount: number;
  createdByName?: string;
  createdAt: string;
}

const AUDIENCE_OPTIONS: { value: Audience; label: string; description: string }[] = [
  { value: 'all', label: 'All users', description: 'Everyone with a registered push token' },
  { value: 'customer', label: 'Customers', description: 'App customers only' },
  { value: 'rider', label: 'Riders', description: 'Delivery fleet only' },
  { value: 'partner', label: 'Laundry partners', description: 'Shop owner accounts only' },
  { value: 'staff', label: 'Staff', description: 'Branch staff accounts only' },
];

function audienceLabel(value: string) {
  return AUDIENCE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function formatSentAt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Stat tiles ─────────────────────────────────────────────────────────────
const TILE_TONES = {
  primary: 'bg-primary/[0.04] ring-primary/15',
  accent: 'bg-accent/[0.04] ring-accent/20',
  secondary: 'bg-secondary/[0.04] ring-secondary/15',
  amber: 'bg-amber-500/[0.04] ring-amber-500/20',
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
    <div className={`rounded-lg p-4 ring-1 ${TILE_TONES[tone]}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="dc-value mt-1">{value}</p>
      {sub ? <p className="dc-sublabel mt-0.5">{sub}</p> : null}
    </div>
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

function RailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function NotificationsBoard() {
  const [showCompose, setShowCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadCounts = useCallback(
    () => adminFetch<AudienceCounts>('/admin/broadcast/audience-counts'),
    [],
  );
  const { data: counts, reload: reloadCounts } = useAdminQuery(loadCounts, []);

  const loadHistory = useCallback(
    () => adminFetch<BroadcastHistoryItem[]>('/admin/broadcast/history'),
    [],
  );
  const { data: history, loading, error, reload: reloadHistory } = useAdminQuery(loadHistory, []);

  const items = useMemo(() => history ?? [], [history]);

  const totalDevices = counts
    ? (counts.customer ?? 0) + (counts.rider ?? 0) + (counts.partner ?? 0) + (counts.staff ?? 0) + (counts.admin ?? 0)
    : 0;

  function reachFor(a: Audience): number | null {
    if (!counts) return null;
    if (a === 'all') return totalDevices;
    return counts[a] ?? 0;
  }

  const totalRecipients = items.reduce((s, i) => s + i.sentCount, 0);

  const filteredItems = useMemo(
    () => filterBySearch(items, search, [(i) => i.title, (i) => i.body]).slice(0, limit),
    [items, search, limit],
  );

  const selected = useMemo(
    () => (selectedId ? (items.find((i) => i.id === selectedId) ?? null) : null),
    [items, selectedId],
  );

  const selectedOption = AUDIENCE_OPTIONS.find((o) => o.value === audience);
  const selectedReach = reachFor(audience);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    const reachLabel =
      selectedReach != null ? `${selectedReach.toLocaleString()} device${selectedReach === 1 ? '' : 's'}` : 'an unknown number of devices';
    if (
      !window.confirm(
        `Send this push notification to ${selectedOption?.label} (${reachLabel})? This can't be recalled once sent.`,
      )
    ) {
      return;
    }
    setSending(true);
    setActionError('');
    try {
      await adminFetch<{ success: boolean; sent: number }>('/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), body: body.trim(), audience }),
      });
      setTitle('');
      setBody('');
      setShowCompose(false);
      await Promise.all([reloadHistory(), reloadCounts()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to send notification');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Marketing</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Notifications
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Send a push notification to users with a registered device, and review what&apos;s
              already gone out.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-outline btn-sm" onClick={() => void reloadCounts()}>
              Refresh reach
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => {
                setShowCompose((v) => !v);
                setSelectedId(null);
              }}
            >
              {showCompose ? 'Close composer' : '+ Send notification'}
            </button>
          </div>
        </div>
      </header>

      {/* Stat tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Total sent" value={items.length.toLocaleString()} sub="all time" tone="primary" />
        <StatTile label="Total recipients" value={totalRecipients.toLocaleString()} sub="devices reached" tone="accent" />
        <StatTile label="Registered devices" value={totalDevices.toLocaleString()} sub="all audiences" tone="secondary" />
        <StatTile label="Customers reachable" value={(counts?.customer ?? 0).toLocaleString()} tone="amber" />
      </div>

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}
      {actionError ? (
        <div className="alert-error mb-4" role="alert">
          {actionError}
        </div>
      ) : null}

      {showCompose ? (
        <section className="dc-panel mb-4 ring-2 ring-primary/30">
          <div className="dc-panel-header">
            <h2 className="text-sm font-semibold text-slate-900">Compose message</h2>
            <p className="text-xs text-muted">Title and body are required</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <form onSubmit={send} className="dc-panel-body lg:col-span-2">
              <div className="space-y-4">
                <div>
                  <p className="form-label">Audience</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {AUDIENCE_OPTIONS.map((o) => {
                      const selectedAudience = audience === o.value;
                      const reach = reachFor(o.value);
                      return (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setAudience(o.value)}
                          aria-pressed={selectedAudience}
                          className={`rounded-lg p-3 text-left ring-1 transition-all ${
                            selectedAudience ? 'bg-primary/5 ring-2 ring-primary/40' : 'ring-border/60 hover:ring-primary/30'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900">{o.label}</p>
                            <span className="text-xs font-semibold tabular-nums text-muted">
                              {reach != null ? `${reach.toLocaleString()} devices` : '—'}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted">{o.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="notif-title" className="form-label">
                    Title
                    <span className="ml-1 font-normal text-muted">({title.length}/65 chars)</span>
                  </label>
                  <input
                    id="notif-title"
                    className="input-field"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={65}
                    placeholder="e.g. Special offer this weekend!"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="notif-body" className="form-label">
                    Message
                    <span className="ml-1 font-normal text-muted">({body.length}/240 chars)</span>
                  </label>
                  <textarea
                    id="notif-body"
                    className="input-field min-h-[100px] resize-y"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={240}
                    placeholder="e.g. Get 20% off your next laundry order. Use code WEEKEND20 at checkout."
                    required
                  />
                </div>
              </div>

              <div className="dc-form-actions mt-4">
                <button
                  type="submit"
                  disabled={sending || !title.trim() || !body.trim()}
                  className="btn-primary btn-sm"
                >
                  {sending
                    ? 'Sending…'
                    : `Send to ${selectedReach != null ? selectedReach.toLocaleString() : ''} device${selectedReach === 1 ? '' : 's'}`}
                </button>
              </div>
            </form>

            <div className="border-t border-border/60 px-5 py-4 lg:border-l lg:border-t-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Preview</p>
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded bg-primary/20" aria-hidden />
                  <span className="text-xs font-medium text-slate-500">Lunara</span>
                  <span className="ml-auto text-xs text-slate-400">now</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">{title.trim() || 'Notification title'}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  {body.trim() || 'Your message will appear here.'}
                </p>
              </div>
              <p className="mt-3 text-xs text-muted">
                Sending to <span className="font-medium text-slate-700">{selectedOption?.label}</span>
                {selectedReach != null
                  ? ` — ${selectedReach.toLocaleString()} registered device${selectedReach === 1 ? '' : 's'}`
                  : ''}
                . Push notifications require the mobile app to be installed with notifications enabled.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
        {/* ── History list ── */}
        <section className="dc-panel min-w-0 xl:col-span-8">
          <div className="px-4 pt-4 pb-1">
            <ListControls
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Title or message…"
              limit={limit}
              onLimitChange={setLimit}
              total={items.length}
              filtered={filteredItems.length}
            />
          </div>

          {loading && !history ? (
            <div className="flex items-center gap-3 px-5 py-8 text-sm text-muted">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
              Loading notifications…
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="dc-panel-empty">
              <p className="font-medium text-slate-900">{search ? 'No notifications match' : 'No notifications sent yet'}</p>
              <p className="mt-1 text-sm text-muted">
                {search ? 'Try another search term.' : 'Sent broadcasts will show up here.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[640px]">
                <caption className="sr-only">Sent notifications history</caption>
                <thead>
                  <tr>
                    <th scope="col">Title</th>
                    <th scope="col">Audience</th>
                    <th scope="col">Sent</th>
                    <th scope="col" className="text-right">Recipients</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const isSelected = selectedId === item.id;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedId((prev) => (prev === item.id ? null : item.id))}
                        aria-selected={isSelected}
                        className={`cursor-pointer ${isSelected ? 'bg-primary/5 hover:bg-primary/5' : ''}`}
                      >
                        <td>
                          <p className="max-w-[16rem] truncate text-sm font-medium text-slate-900" title={item.title}>
                            {item.title}
                          </p>
                          <p className="max-w-[16rem] truncate text-xs text-muted" title={item.body}>
                            {item.body}
                          </p>
                        </td>
                        <td>
                          <span className="badge-secondary">{audienceLabel(item.audience)}</span>
                        </td>
                        <td className="whitespace-nowrap text-sm text-muted">{formatSentAt(item.createdAt)}</td>
                        <td className="text-right text-sm font-medium tabular-nums">
                          {item.sentCount.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Detail rail ── */}
        <div className="xl:col-span-4">
          {!selected ? (
            <section className="dc-panel">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Notification detail</h2>
              </div>
              <p className="px-5 py-8 text-center text-sm text-muted">
                Select a row to preview what was sent.
              </p>
            </section>
          ) : (
            <section className="dc-panel">
              <div className="dc-panel-header flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="badge-accent w-fit">Sent</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={selected.title}>
                    {selected.title}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost btn-sm shrink-0"
                  aria-label="Close detail panel"
                  onClick={() => setSelectedId(null)}
                >
                  ✕
                </button>
              </div>

              <RailSection title="Details">
                <RailRow label="Audience" value={audienceLabel(selected.audience)} />
                <RailRow label="Sent on" value={formatSentAt(selected.createdAt)} />
                <RailRow label="Recipients" value={selected.sentCount.toLocaleString()} />
                {selected.createdByName ? <RailRow label="Sent by" value={selected.createdByName} /> : null}
              </RailSection>

              <RailSection title="Message">
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded bg-primary/20" aria-hidden />
                    <span className="text-xs font-medium text-slate-500">Lunara</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{selected.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{selected.body}</p>
                </div>
              </RailSection>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
