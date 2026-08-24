'use client';

import { resolveApiV1BaseUrl } from '@lunara/utils';
import { useCallback, useRef, useState } from 'react';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';

const API_URL = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);

// ── Types ─────────────────────────────────────────────────────────────────────

interface CollectionStat { collection: string; count: number }
interface SeedResult     { log: string[]; count: number }
interface ResetResult    { dropped: string[]; scope: string }
interface ScriptResult   { output: string; exitCode: number }

// ── Constants ─────────────────────────────────────────────────────────────────

const SEED_TARGETS = [
  { id: 'users',       label: 'Dev users',        description: 'Upsert partner, rider, admin, staff, customer accounts' },
  { id: 'services',    label: 'Services',          description: 'Upsert default laundry service catalog' },
  { id: 'addons',      label: 'Add-ons',           description: 'Upsert default laundry add-on catalog' },
  { id: 'promotions',  label: 'Promotions',        description: 'Upsert WELCOME10, SIGNUP15, FREEDEL50, FLASH50' },
  { id: 'blog',        label: 'Blog posts',        description: 'Upsert helpful published blog posts for the site' },
  { id: 'all',         label: 'Seed everything',   description: 'Run all seed targets above in sequence' },
] as const;

const RESET_SCOPES = [
  { id: 'orders',      label: 'Orders',              description: 'Drop orders collection' },
  { id: 'settlements', label: 'Settlements + Ledger', description: 'Drop partner_settlements + ledger_entries' },
  { id: 'ledger',      label: 'Ledger only',          description: 'Drop ledger_entries' },
  { id: 'wallets',     label: 'Wallets',              description: 'Drop wallets + rider_wallets' },
  { id: 'remittances', label: 'Remittances',          description: 'Drop rider_cash_remittances' },
  { id: 'users',       label: 'Users + Profiles',     description: 'Drop users, riders, customers, addresses, wallets' },
  { id: 'all',         label: 'Everything (nuclear)', description: 'Drop all transactional collections' },
] as const;

const ALLOWED_SCRIPTS = [
  { id: 'seed',                      label: 'seed — Dev users + full catalog' },
  { id: 'seed:promotions',           label: 'seed:promotions — Promotions only' },
  { id: 'seed:services',             label: 'seed:services — Laundry services' },
  { id: 'seed:addons',               label: 'seed:addons — Laundry add-ons' },
  { id: 'migrate:settlement-ledger', label: 'migrate:settlement-ledger — Fix ledger entries' },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

type Tab = 'status' | 'seed' | 'reset' | 'scripts' | 'backup';

const TABS: { id: Tab; label: string }[] = [
  { id: 'status',  label: 'Status' },
  { id: 'seed',    label: 'Seed' },
  { id: 'reset',   label: 'Reset' },
  { id: 'scripts', label: 'Scripts' },
  { id: 'backup',  label: 'Backup & Restore' },
];

// ── Shared tile styling (matches the rest of the admin suite) ─────────────────

const TILE_TONES = {
  primary: 'bg-primary/[0.04] ring-primary/15',
  accent: 'bg-accent/[0.04] ring-accent/20',
  secondary: 'bg-secondary/[0.04] ring-secondary/15',
  amber: 'bg-amber-500/[0.04] ring-amber-500/20',
  violet: 'bg-violet-500/[0.04] ring-violet-500/20',
  rose: 'bg-rose-500/[0.04] ring-rose-500/20',
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

// ── Status Tab ────────────────────────────────────────────────────────────────

function StatusTab() {
  const load = useCallback(() => adminFetch<CollectionStat[]>('/admin/maintenance/status'), []);
  const { data, loading, error, reload } = useAdminQuery(load, []);
  const total = data?.reduce((s, r) => s + r.count, 0) ?? 0;
  const maxCount = Math.max(1, ...(data ?? []).map((r) => r.count));
  const largest = data && data.length > 0 ? [...data].sort((a, b) => b.count - a.count)[0] : null;
  const emptyCount = data?.filter((r) => r.count === 0).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total documents" value={total.toLocaleString()} sub="across all collections" tone="primary" />
        <StatTile label="Collections tracked" value={String(data?.length ?? 0)} tone="secondary" />
        <StatTile
          label="Largest collection"
          value={largest ? largest.count.toLocaleString() : '—'}
          sub={largest?.collection}
          tone="violet"
        />
        <StatTile
          label="Empty collections"
          value={String(emptyCount)}
          sub={emptyCount > 0 ? 'no documents yet' : 'all seeded'}
          tone={emptyCount > 0 ? 'amber' : 'accent'}
        />
      </div>

      <section className="dc-panel">
        <div className="dc-panel-header flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Collection statistics</h2>
            <p className="text-xs text-muted">Live document counts per MongoDB collection.</p>
          </div>
          <button type="button" onClick={() => void reload()} className="btn-outline btn-sm" disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {loading && !data && (
          <div className="flex items-center gap-3 px-3 py-4 text-sm text-muted">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
            Loading…
          </div>
        )}
        {error && <div className="alert-error m-3" role="alert">{error}</div>}

        {data && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Collection</th>
                  <th scope="col">Share</th>
                  <th scope="col" className="text-right">Documents</th>
                </tr>
              </thead>
              <tbody>
                {[...data]
                  .sort((a, b) => b.count - a.count)
                  .map((row) => (
                    <tr key={row.collection}>
                      <td className="text-code text-slate-700">{row.collection}</td>
                      <td>
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-primary/70"
                            style={{ width: `${(row.count / maxCount) * 100}%` }}
                          />
                        </div>
                      </td>
                      <td className="text-right tabular-nums font-medium">{row.count.toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border/60 bg-slate-50/80 font-medium">
                  <td className="text-slate-900">Total</td>
                  <td />
                  <td className="text-right tabular-nums text-slate-900">{total.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Seed Tab ──────────────────────────────────────────────────────────────────

function SeedTab() {
  const [busy, setBusy]       = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, SeedResult | string>>({});

  async function runSeed(target: string) {
    setBusy(target);
    try {
      const res = await adminFetch<SeedResult>('/admin/maintenance/seed', {
        method: 'POST',
        body: JSON.stringify({ target }),
      });
      setResults((prev) => ({ ...prev, [target]: res }));
    } catch (e) {
      setResults((prev) => ({ ...prev, [target]: e instanceof Error ? e.message : 'Failed' }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="dc-panel">
        <div className="dc-panel-header">
          <h2 className="text-sm font-semibold text-slate-900">Seed data</h2>
          <p className="text-xs text-muted">Upsert default records into the database. Safe to run multiple times (idempotent).</p>
        </div>
        <div className="dc-panel-body">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SEED_TARGETS.map((t) => {
              const result    = results[t.id];
              const isSuccess = result && typeof result !== 'string';
              const isError   = result && typeof result === 'string';
              const tone: keyof typeof TILE_TONES = t.id === 'all' ? 'violet' : 'primary';
              return (
                <div key={t.id} className={`flex flex-col gap-3 rounded-xl p-4 ring-1 ${TILE_TONES[tone]}`}>
                  <div>
                    <p className="font-medium text-slate-900">{t.label}</p>
                    <p className="mt-0.5 text-xs text-muted">{t.description}</p>
                  </div>
                  {isSuccess && (
                    <div className="space-y-0.5 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700">
                      {(result as SeedResult).log.map((l, i) => <p key={i}>✓ {l}</p>)}
                    </div>
                  )}
                  {isError && (
                    <p className="rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-600">{result as string}</p>
                  )}
                  <button
                    type="button"
                    disabled={busy === t.id}
                    className="btn-primary btn-sm mt-auto"
                    onClick={() => void runSeed(t.id)}
                  >
                    {busy === t.id ? 'Running…' : 'Run seed'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reset Tab ─────────────────────────────────────────────────────────────────

function ResetTab() {
  const [scope, setScope]           = useState('orders');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy]             = useState(false);
  const [result, setResult]         = useState<ResetResult | null>(null);
  const [error, setError]           = useState<string | null>(null);

  async function handleReset() {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const res = await adminFetch<ResetResult>('/admin/maintenance/reset', {
        method: 'POST',
        body: JSON.stringify({ scope, confirm: 'RESET' }),
      });
      setResult(res);
      setConfirmText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  const selectedScope = RESET_SCOPES.find((s) => s.id === scope);

  return (
    <section className="dc-panel">
      <div className="dc-panel-header">
        <h2 className="text-sm font-semibold text-slate-900">Reset collections</h2>
        <p className="text-xs text-muted">Select a scope and type RESET to confirm. Dropped collections cannot be recovered without a backup.</p>
      </div>
      <div className="dc-panel-body space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-red-400/40 bg-red-950/5 px-4 py-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" aria-hidden />
          <p className="text-sm font-semibold text-red-700">Danger zone — this is irreversible without a backup.</p>
        </div>

        <div>
          <p className="form-label">Scope</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {RESET_SCOPES.map((s) => {
              const selected = scope === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setScope(s.id); setConfirmText(''); setResult(null); setError(null); }}
                  aria-pressed={selected}
                  className={`rounded-lg p-3 text-left ring-1 transition-all ${
                    selected
                      ? s.id === 'all'
                        ? 'bg-red-50 ring-2 ring-red-400'
                        : 'bg-primary/5 ring-2 ring-primary/40'
                      : 'ring-border/60 hover:ring-primary/30'
                  }`}
                >
                  <p className={`text-sm font-medium ${s.id === 'all' && selected ? 'text-red-700' : 'text-slate-900'}`}>
                    {s.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{s.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="reset-confirm" className="form-label">
            Type <span className="text-code text-red-600">RESET</span> to confirm
          </label>
          <input
            id="reset-confirm"
            className="input-field font-mono"
            placeholder="RESET"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </div>

        <button
          type="button"
          disabled={busy || confirmText !== 'RESET'}
          className="rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={handleReset}
        >
          {busy ? 'Dropping…' : `Drop: ${selectedScope?.label}`}
        </button>

        {result && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/5 p-4 text-sm">
            <p className="font-semibold text-slate-900">Dropped {result.dropped.length} collection(s)</p>
            {result.dropped.length > 0
              ? result.dropped.map((c) => <p key={c} className="text-code mt-0.5 text-xs text-muted">· {c}</p>)
              : <p className="mt-1 text-xs text-muted">No collections found (already empty).</p>
            }
          </div>
        )}
        {error && <div className="alert-error" role="alert">{error}</div>}
      </div>
    </section>
  );
}

// ── Scripts Tab ───────────────────────────────────────────────────────────────

function ScriptsTab() {
  const [script, setScript] = useState('seed');
  const [busy, setBusy]     = useState(false);
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const outputRef           = useRef<HTMLDivElement>(null);

  async function handleRun() {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const res = await adminFetch<ScriptResult>('/admin/maintenance/run-script', {
        method: 'POST',
        body: JSON.stringify({ script }),
      });
      setResult(res);
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Script failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dc-panel">
      <div className="dc-panel-header">
        <h2 className="text-sm font-semibold text-slate-900">Run npm script</h2>
        <p className="text-xs text-muted">Execute a whitelisted package script on the server. Output streams to the box below.</p>
      </div>
      <div className="dc-panel-body space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <label htmlFor="script-select" className="form-label">Script</label>
            <select id="script-select" className="input-field" value={script} onChange={(e) => setScript(e.target.value)}>
              {ALLOWED_SCRIPTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <button type="button" disabled={busy} className="btn-primary btn-sm shrink-0" onClick={handleRun}>
            {busy ? 'Running…' : 'Run'}
          </button>
        </div>

        {error && <div className="alert-error" role="alert">{error}</div>}

        {result && (
          <div ref={outputRef}>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-sm font-medium text-slate-700">Output</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${result.exitCode === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                exit {result.exitCode}
              </span>
            </div>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-slate-900 p-4 text-xs text-slate-100">
              {result.output || '(no output)'}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Backup & Restore Tab ──────────────────────────────────────────────────────

function BackupTab() {
  const [restoreFile, setRestoreFile]     = useState<File | null>(null);
  const [restoring, setRestoring]         = useState(false);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);
  const [restoreError, setRestoreError]   = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloadError(null);
    try {
      const { getAdminToken } = await import('../../lib/admin-api');
      const token = getAdminToken();
      const res = await fetch(`${API_URL}/admin/maintenance/backup`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(json.error?.message ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lunara-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Download failed');
    }
  }

  async function handleRestore() {
    if (!restoreFile) return;
    if (
      !window.confirm(
        `Restore from "${restoreFile.name}"? This drops every existing collection and replaces it with the backup's contents. This cannot be undone.`,
      )
    ) {
      return;
    }
    setRestoring(true);
    setRestoreResult(null);
    setRestoreError(null);
    try {
      const { getAdminToken } = await import('../../lib/admin-api');
      const token = getAdminToken();
      const formData = new FormData();
      formData.append('file', restoreFile);
      const res = await fetch(`${API_URL}/admin/maintenance/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json() as { success?: boolean; data?: { result: string }; error?: { message: string } };
      if (!res.ok || !json.success) throw new Error(json.error?.message ?? 'Restore failed');
      setRestoreResult(json.data?.result ?? 'Restore completed.');
      setRestoreFile(null);
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">

      <section className="dc-panel">
        <div className="dc-panel-header">
          <h2 className="text-sm font-semibold text-slate-900">Backup</h2>
          <p className="text-xs text-muted">Downloads a JSON snapshot of every collection in the database.</p>
        </div>
        <div className="dc-panel-body space-y-3">
          <button type="button" className="btn-primary btn-sm" onClick={handleDownload}>
            Download backup
          </button>
          {downloadError && <div className="alert-error" role="alert">{downloadError}</div>}
        </div>
      </section>

      <section className="dc-panel">
        <div className="dc-panel-header">
          <h2 className="text-sm font-semibold text-slate-900">Restore</h2>
          <p className="text-xs text-muted">Upload a <span className="text-code">.json</span> file produced by the backup above.</p>
        </div>
        <div className="dc-panel-body space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-amber-500/35 bg-amber-950/5 px-4 py-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" aria-hidden />
            <p className="text-xs text-amber-800"><span className="font-semibold">Warning:</span> Restore drops existing collections before importing. Back up first.</p>
          </div>
          <input
            type="file"
            accept=".json,application/json"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-primary/90"
            onChange={(e) => { setRestoreFile(e.target.files?.[0] ?? null); setRestoreResult(null); setRestoreError(null); }}
          />
          {restoreFile && (
            <p className="text-xs text-muted">{restoreFile.name} · {(restoreFile.size / 1024 / 1024).toFixed(2)} MB</p>
          )}
          <button
            type="button"
            disabled={!restoreFile || restoring}
            className="rounded-lg border border-amber-300 bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={handleRestore}
          >
            {restoring ? 'Restoring…' : 'Restore from file'}
          </button>
          {restoreResult && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/5 p-3 text-sm">
              <p className="font-semibold text-slate-900">Restore complete</p>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted">{restoreResult}</pre>
            </div>
          )}
          {restoreError && <div className="alert-error" role="alert">{restoreError}</div>}
        </div>
      </section>

    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const [activeTab, setActiveTab] = useState<Tab>('status');

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Platform</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Maintenance
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Manage collections, run seeds, execute scripts, and backup or restore the database.
            </p>
          </div>
        </div>
      </header>

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div className="mb-5 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'status'  && <StatusTab />}
      {activeTab === 'seed'    && <SeedTab />}
      {activeTab === 'reset'   && <ResetTab />}
      {activeTab === 'scripts' && <ScriptsTab />}
      {activeTab === 'backup'  && <BackupTab />}
    </div>
  );
}
