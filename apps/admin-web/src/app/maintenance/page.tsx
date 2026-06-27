'use client';

import { useCallback, useRef, useState } from 'react';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';

// ── Types ────────────────────────────────────────────────────────────────────

interface CollectionStat {
  collection: string;
  count: number;
}

interface SeedResult {
  log: string[];
  count: number;
}

interface ResetResult {
  dropped: string[];
  scope: string;
}

interface ScriptResult {
  output: string;
  exitCode: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SEED_TARGETS = [
  { id: 'users', label: 'Dev Users', description: 'Upsert partner, rider, admin, staff, customer accounts' },
  { id: 'services', label: 'Services', description: 'Upsert default laundry service catalog' },
  { id: 'addons', label: 'Add-ons', description: 'Upsert default laundry add-on catalog' },
  { id: 'promotions', label: 'Promotions', description: 'Upsert WELCOME10, SIGNUP15, FREEDEL50, FLASH50' },
  { id: 'all', label: 'Seed Everything', description: 'Run all seed targets above in sequence' },
] as const;

const RESET_SCOPES = [
  { id: 'orders', label: 'Orders', description: 'Drop orders collection' },
  { id: 'settlements', label: 'Settlements + Ledger', description: 'Drop partner_settlements + ledger_entries' },
  { id: 'ledger', label: 'Ledger only', description: 'Drop ledger_entries' },
  { id: 'wallets', label: 'Wallets', description: 'Drop wallets + rider_wallets' },
  { id: 'remittances', label: 'Remittances', description: 'Drop rider_cash_remittances' },
  { id: 'users', label: 'Users + Profiles', description: 'Drop users, riders, customers, addresses, wallets' },
  { id: 'all', label: 'Everything (nuclear)', description: 'Drop all transactional collections' },
] as const;

const ALLOWED_SCRIPTS = [
  { id: 'seed', label: 'seed — Dev users + full catalog' },
  { id: 'seed:promotions', label: 'seed:promotions — Promotions only' },
  { id: 'seed:services', label: 'seed:services — Laundry services' },
  { id: 'seed:addons', label: 'seed:addons — Laundry add-ons' },
  { id: 'migrate:settlement-ledger', label: 'migrate:settlement-ledger — Fix ledger entries' },
] as const;

// ── Sub-components ───────────────────────────────────────────────────────────

type Tab = 'status' | 'seed' | 'reset' | 'scripts' | 'backup';

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'status', label: 'Status' },
    { id: 'seed', label: 'Seed' },
    { id: 'reset', label: 'Reset' },
    { id: 'scripts', label: 'Scripts' },
    { id: 'backup', label: 'Backup & Restore' },
  ];
  return (
    <div className="flex gap-1 border-b border-border mb-6">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === t.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-slate-700'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ResultBox({ title, children, variant = 'info' }: { title: string; children: React.ReactNode; variant?: 'info' | 'success' | 'error' }) {
  const colors = {
    info: 'border-border bg-slate-50 text-slate-700',
    success: 'border-green-200 bg-green-50 text-green-800',
    error: 'border-red-200 bg-red-50 text-red-800',
  }[variant];
  return (
    <div className={`mt-4 rounded-lg border p-4 text-sm ${colors}`}>
      <p className="font-semibold mb-1">{title}</p>
      {children}
    </div>
  );
}

// ── Status Tab ───────────────────────────────────────────────────────────────

function StatusTab() {
  const load = useCallback(() => adminFetch<CollectionStat[]>('/admin/maintenance/status'), []);
  const { data, loading, error, reload } = useAdminQuery(load, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Collection statistics</h2>
          <p className="text-sm text-muted">Live document counts per MongoDB collection.</p>
        </div>
        <button type="button" onClick={() => void reload()} className="btn-outline btn-sm" disabled={loading}>
          Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <div className="section-panel overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Collection</th>
                <th className="text-right">Documents</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.collection}>
                  <td className="font-mono text-sm text-slate-700">{row.collection}</td>
                  <td className="text-right text-slate-900 font-medium">{row.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border/60 bg-slate-50/80 font-medium">
                <td className="text-slate-900">Total</td>
                <td className="text-right text-slate-900">
                  {data.reduce((s, r) => s + r.count, 0).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Seed Tab ─────────────────────────────────────────────────────────────────

function SeedTab() {
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, SeedResult | string>>({});

  async function runSeed(target: string) {
    setBusy(target);
    try {
      const res = await adminFetch<SeedResult>('/admin/maintenance/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <div>
      <h2 className="font-semibold text-slate-900 mb-1">Seed data</h2>
      <p className="text-sm text-muted mb-6">Upsert default records into the database. Safe to run multiple times (idempotent).</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SEED_TARGETS.map((t) => {
          const result = results[t.id];
          const isSuccess = result && typeof result !== 'string';
          const isError = result && typeof result === 'string';
          return (
            <div key={t.id} className="section-panel p-4 flex flex-col gap-3">
              <div>
                <p className="font-medium text-slate-900">{t.label}</p>
                <p className="text-xs text-muted mt-0.5">{t.description}</p>
              </div>
              {isSuccess && (
                <div className="text-xs text-green-700 bg-green-50 rounded px-2 py-1.5 space-y-0.5">
                  {(result as SeedResult).log.map((l, i) => <p key={i}>✓ {l}</p>)}
                </div>
              )}
              {isError && (
                <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1.5">{result as string}</p>
              )}
              <button
                type="button"
                disabled={busy === t.id}
                className="btn-primary btn-sm mt-auto disabled:opacity-50"
                onClick={() => void runSeed(t.id)}
              >
                {busy === t.id ? 'Running…' : 'Run seed'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Reset Tab ────────────────────────────────────────────────────────────────

function ResetTab() {
  const [scope, setScope] = useState('orders');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const res = await adminFetch<ResetResult>('/admin/maintenance/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="max-w-xl">
      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <span className="font-semibold">Danger zone.</span> Dropped collections cannot be recovered without a backup.
      </div>

      <h2 className="font-semibold text-slate-900 mb-1">Reset collections</h2>
      <p className="text-sm text-muted mb-4">Select a scope and type RESET to confirm.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Scope</label>
          <select
            className="input-field w-full"
            value={scope}
            onChange={(e) => { setScope(e.target.value); setConfirmText(''); setResult(null); setError(null); }}
          >
            {RESET_SCOPES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          {selectedScope && (
            <p className="mt-1 text-xs text-muted">{selectedScope.description}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Type <span className="font-mono text-red-600">RESET</span> to confirm
          </label>
          <input
            className="input-field w-full font-mono"
            placeholder="RESET"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </div>

        <button
          type="button"
          disabled={busy || confirmText !== 'RESET'}
          className="w-full rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          onClick={handleReset}
        >
          {busy ? 'Dropping…' : `Drop: ${selectedScope?.label}`}
        </button>

        {result && (
          <ResultBox title={`Dropped ${result.dropped.length} collection(s)`} variant="success">
            {result.dropped.length > 0
              ? result.dropped.map((c) => <p key={c} className="font-mono text-xs">· {c}</p>)
              : <p className="text-xs">No collections found (already empty).</p>}
          </ResultBox>
        )}
        {error && <ResultBox title="Error" variant="error"><p>{error}</p></ResultBox>}
      </div>
    </div>
  );
}

// ── Scripts Tab ──────────────────────────────────────────────────────────────

function ScriptsTab() {
  const [script, setScript] = useState('seed');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  async function handleRun() {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const res = await adminFetch<ScriptResult>('/admin/maintenance/run-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="max-w-2xl">
      <h2 className="font-semibold text-slate-900 mb-1">Run npm script</h2>
      <p className="text-sm text-muted mb-4">Execute a whitelisted package script on the server. Output streams to the box below.</p>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Script</label>
          <select
            className="input-field w-full"
            value={script}
            onChange={(e) => setScript(e.target.value)}
          >
            {ALLOWED_SCRIPTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={busy}
          className="btn-primary btn-sm disabled:opacity-50 shrink-0"
          onClick={handleRun}
        >
          {busy ? 'Running…' : 'Run'}
        </button>
      </div>

      {error && <ResultBox title="Error" variant="error"><p>{error}</p></ResultBox>}

      {result && (
        <div className="mt-4" ref={outputRef}>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-medium text-slate-700">Output</p>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
              result.exitCode === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              exit {result.exitCode}
            </span>
          </div>
          <pre className="rounded-lg border border-border bg-slate-900 p-4 text-xs text-slate-100 overflow-auto max-h-80 whitespace-pre-wrap">
            {result.output || '(no output)'}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Backup & Restore Tab ─────────────────────────────────────────────────────

function BackupTab() {
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setBusy] = useState(false);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloadError(null);
    try {
      // Use fetch directly to get the binary blob
      const { getAdminToken } = await import('../../lib/admin-api');
      const token = getAdminToken();
      const res = await fetch('/api/v1/admin/maintenance/backup', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(json.error?.message ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `lunara-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Download failed');
    }
  }

  async function handleRestore() {
    if (!restoreFile) return;
    setBusy(true);
    setRestoreResult(null);
    setRestoreError(null);
    try {
      const { getAdminToken } = await import('../../lib/admin-api');
      const token = getAdminToken();
      const formData = new FormData();
      formData.append('file', restoreFile);
      const res = await fetch('/api/v1/admin/maintenance/restore', {
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
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-8">
      {/* Backup */}
      <div>
        <h2 className="font-semibold text-slate-900 mb-1">Backup</h2>
        <p className="text-sm text-muted mb-4">
          Downloads a JSON snapshot of every collection in the database.
        </p>
        <button type="button" className="btn-primary btn-sm" onClick={handleDownload}>
          Download backup
        </button>
        {downloadError && <p className="mt-2 text-sm text-red-600">{downloadError}</p>}
      </div>

      <hr className="border-border" />

      {/* Restore */}
      <div>
        <h2 className="font-semibold text-slate-900 mb-1">Restore</h2>
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Warning:</span> Restore drops existing collections before importing. Back up first.
        </div>
        <p className="text-sm text-muted mb-4">Upload a <span className="font-mono text-xs">.json</span> file produced by the backup above.</p>

        <div className="space-y-3">
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
            className="w-full rounded-lg border border-amber-300 bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            onClick={handleRestore}
          >
            {restoring ? 'Restoring…' : 'Restore from file'}
          </button>
        </div>

        {restoreResult && (
          <ResultBox title="Restore complete" variant="success">
            <pre className="text-xs whitespace-pre-wrap mt-1 max-h-48 overflow-auto">{restoreResult}</pre>
          </ResultBox>
        )}
        {restoreError && <ResultBox title="Restore failed" variant="error"><p>{restoreError}</p></ResultBox>}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const [activeTab, setActiveTab] = useState<Tab>('status');

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Database Maintenance</h1>
        <p className="mt-1 text-sm text-muted">
          Manage collections, run seeds, execute scripts, and backup or restore the database.
        </p>
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === 'status' && <StatusTab />}
      {activeTab === 'seed' && <SeedTab />}
      {activeTab === 'reset' && <ResetTab />}
      {activeTab === 'scripts' && <ScriptsTab />}
      {activeTab === 'backup' && <BackupTab />}
    </div>
  );
}
