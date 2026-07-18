'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';
import { BranchAddressEditor, type BranchAddressValue } from '../../components/datacenter/branch-address-editor';

interface SetupStatus {
  initialized: boolean;
  hqBranch: { id: string; code: string; name: string; city: string } | null;
  operationalBranchCount: number;
}

const MANILA: BranchAddressValue = {
  line1: '',
  city: '',
  province: '',
  latitude: 14.5995,
  longitude: 120.9842,
};

const INITIAL_HQ_FORM = { code: 'HQ-01', name: 'Lunara HQ' };

const INITIAL_BRANCH_FORM = {
  code: '',
  name: '',
  branchType: 'partner_shop' as 'partner_shop' | 'franchise',
  maxActiveOrders: '20',
  maxWeightCapacityKg: '200',
  serviceRadiusKm: '12',
};

export default function SetupPage() {
  const fetchStatus = useCallback(() => adminFetch<SetupStatus>('/admin/setup/status'), []);
  const { data: status, loading, error: statusError, reload } = useAdminQuery(fetchStatus, []);

  const [hqForm, setHqForm]       = useState(INITIAL_HQ_FORM);
  const [hqAddress, setHqAddress] = useState<BranchAddressValue>(MANILA);
  const [hqBusy, setHqBusy]       = useState(false);
  const [hqError, setHqError]     = useState('');

  const [branchForm, setBranchForm]       = useState(INITIAL_BRANCH_FORM);
  const [branchAddress, setBranchAddress] = useState<BranchAddressValue>(MANILA);
  const [branchBusy, setBranchBusy]       = useState(false);
  const [branchError, setBranchError]     = useState('');
  const [branchCreated, setBranchCreated] = useState(false);

  function setHq(key: keyof typeof INITIAL_HQ_FORM) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setHqForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function setBranch(key: keyof typeof INITIAL_BRANCH_FORM) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setBranchForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleInitNetwork(e: React.FormEvent) {
    e.preventDefault();
    setHqBusy(true);
    setHqError('');
    try {
      await adminFetch('/admin/setup/init', {
        method: 'POST',
        body: JSON.stringify({
          code: hqForm.code.trim().toUpperCase(),
          name: hqForm.name.trim(),
          line1: hqAddress.line1.trim(),
          city: hqAddress.city.trim(),
          province: hqAddress.province.trim(),
          coordinates: [hqAddress.longitude, hqAddress.latitude],
        }),
      });
      await reload();
    } catch (err) {
      setHqError(err instanceof Error ? err.message : 'Failed to initialize network');
    } finally {
      setHqBusy(false);
    }
  }

  async function handleCreateBranch(e: React.FormEvent) {
    e.preventDefault();
    setBranchBusy(true);
    setBranchError('');
    setBranchCreated(false);
    try {
      await adminFetch('/admin/setup/branch', {
        method: 'POST',
        body: JSON.stringify({
          code: branchForm.code.trim().toUpperCase(),
          name: branchForm.name.trim(),
          branchType: branchForm.branchType,
          line1: branchAddress.line1.trim(),
          city: branchAddress.city.trim(),
          province: branchAddress.province.trim(),
          coordinates: [branchAddress.longitude, branchAddress.latitude],
          maxActiveOrders: Number(branchForm.maxActiveOrders),
          maxWeightCapacityKg: Number(branchForm.maxWeightCapacityKg),
          serviceRadiusKm: Number(branchForm.serviceRadiusKm),
        }),
      });
      setBranchCreated(true);
      setBranchForm(INITIAL_BRANCH_FORM);
      setBranchAddress(MANILA);
      await reload();
    } catch (err) {
      setBranchError(err instanceof Error ? err.message : 'Failed to create branch');
    } finally {
      setBranchBusy(false);
    }
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Platform</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Setup
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              One-time initialization to prepare the platform for production. Complete these steps before onboarding your first partner.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/branches" className="btn-outline btn-sm">Branches</Link>
            <Link href="/settings" className="btn-outline btn-sm">Settings</Link>
          </div>
        </div>
      </header>

      {statusError && <div className="alert-error mb-4" role="alert">{statusError}</div>}

      {loading && !status && (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
          Checking setup status…
        </div>
      )}

      {status && (
        <div className="space-y-4">

          {/* ── Status banner ─────────────────────────────────────── */}
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${status.initialized ? 'border-emerald-500/30 bg-emerald-950/5' : 'border-amber-500/35 bg-amber-950/5'}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.initialized ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">
                {status.initialized ? 'Network initialized' : 'Setup required'}
              </p>
              <p className="text-xs text-muted">
                {status.initialized
                  ? `HQ: ${status.hqBranch?.name} (${status.hqBranch?.code}) — ${status.hqBranch?.city} · ${status.operationalBranchCount} operational branch${status.operationalBranchCount !== 1 ? 'es' : ''}`
                  : 'No network structure found. Initialize the HQ branch below before onboarding partners.'}
              </p>
            </div>
            {status.initialized && (
              <span className="badge-accent px-3 py-1 text-xs font-semibold">
                {status.operationalBranchCount} branch{status.operationalBranchCount !== 1 ? 'es' : ''}
              </span>
            )}
          </div>

          {/* ── Step A: Initialize network ────────────────────────── */}
          {!status.initialized && (
            <section className="dc-panel">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Step 1 — Initialize network</h2>
                <p className="text-xs text-muted">
                  Creates the root HQ branch that anchors the branch hierarchy. Required before any partner can be onboarded.
                </p>
              </div>
              <form onSubmit={handleInitNetwork} className="dc-panel-body">
                <div className="dc-form-grid">
                  <div>
                    <label htmlFor="hq-code" className="form-label">HQ code</label>
                    <input id="hq-code" className="input-field uppercase" value={hqForm.code}
                      onChange={setHq('code')} required placeholder="HQ-01" />
                  </div>
                  <div>
                    <label htmlFor="hq-name" className="form-label">HQ name</label>
                    <input id="hq-name" className="input-field" value={hqForm.name}
                      onChange={setHq('name')} required placeholder="e.g. Lunara HQ" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label">Location</label>
                    <BranchAddressEditor value={hqAddress} onChange={setHqAddress} />
                  </div>
                </div>
                {hqError && <div className="alert-error mt-4" role="alert">{hqError}</div>}
                <div className="dc-form-actions mt-4">
                  <button type="submit" className="btn-primary btn-sm" disabled={hqBusy}>
                    {hqBusy ? 'Initializing…' : 'Initialize network'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* ── Step B: Add first operational branch ─────────────── */}
          {status.initialized && status.operationalBranchCount === 0 && (
            <section className="dc-panel">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Step 2 — Add first operational branch</h2>
                <p className="text-xs text-muted">
                  This branch will appear in the Parent branch dropdown when onboarding partners. Add at least one before creating partners.
                </p>
              </div>
              <form onSubmit={handleCreateBranch} className="dc-panel-body">
                <div className="dc-form-grid">
                  <div>
                    <label htmlFor="br-code" className="form-label">Branch code</label>
                    <input id="br-code" className="input-field uppercase" value={branchForm.code}
                      onChange={setBranch('code')} required placeholder="e.g. MNL-01" />
                  </div>
                  <div>
                    <label htmlFor="br-name" className="form-label">Branch name</label>
                    <input id="br-name" className="input-field" value={branchForm.name}
                      onChange={setBranch('name')} required placeholder="e.g. Manila Central" />
                  </div>
                  <div>
                    <label htmlFor="br-type" className="form-label">Type</label>
                    <select id="br-type" className="input-field" value={branchForm.branchType}
                      onChange={setBranch('branchType')}>
                      <option value="partner_shop">Partner shop</option>
                      <option value="franchise">Franchise</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="br-radius" className="form-label">Service radius (km)</label>
                    <input id="br-radius" type="number" min="1" max="50" className="input-field"
                      value={branchForm.serviceRadiusKm} onChange={setBranch('serviceRadiusKm')} required />
                  </div>
                  <div>
                    <label htmlFor="br-orders" className="form-label">Max active orders</label>
                    <input id="br-orders" type="number" min="1" className="input-field"
                      value={branchForm.maxActiveOrders} onChange={setBranch('maxActiveOrders')} required />
                  </div>
                  <div>
                    <label htmlFor="br-weight" className="form-label">Max weight (kg)</label>
                    <input id="br-weight" type="number" min="1" className="input-field"
                      value={branchForm.maxWeightCapacityKg} onChange={setBranch('maxWeightCapacityKg')} required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label">Location</label>
                    <BranchAddressEditor value={branchAddress} onChange={setBranchAddress} />
                  </div>
                </div>
                {branchError && <div className="alert-error mt-4" role="alert">{branchError}</div>}
                {branchCreated && (
                  <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-950/5 px-4 py-3">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                    <p className="text-sm text-slate-900">
                      Branch created.{' '}
                      <Link href="/partners/new" className="link-primary font-medium">
                        Onboard your first partner →
                      </Link>
                    </p>
                  </div>
                )}
                <div className="dc-form-actions mt-4">
                  <button type="submit" className="btn-primary btn-sm" disabled={branchBusy}>
                    {branchBusy ? 'Creating…' : 'Create branch'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* ── Quick links ──────────────────────────────────────── */}
          <section className="dc-panel">
            <div className="dc-panel-header">
              <h2 className="text-sm font-semibold text-slate-900">Quick links</h2>
              <p className="text-xs text-muted">Next steps after setup</p>
            </div>
            <div className="dc-panel-body">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  {status.operationalBranchCount ? (
                    <Link href="/partners/new" className="link-primary font-medium">Onboard a partner</Link>
                  ) : (
                    <span className="text-muted">Onboard a partner</span>
                  )}
                  {!status.operationalBranchCount && (
                    <span className="badge-neutral text-xs">Requires 1+ operational branch</span>
                  )}
                </li>
                <li>
                  <Link href="/branches" className="link-primary font-medium">Branches</Link>
                  <span className="text-muted"> — view and manage the full branch network</span>
                </li>
                <li>
                  <Link href="/settings" className="link-primary font-medium">Settings</Link>
                  <span className="text-muted"> — delivery fees, coverage radii, display preferences</span>
                </li>
                <li>
                  <Link href="/partners" className="link-primary font-medium">Partners</Link>
                  <span className="text-muted"> — partner accounts overview</span>
                </li>
              </ul>
            </div>
          </section>

        </div>
      )}
    </div>
  );
}
