'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';
import { PageHeader } from '../../components/ui/page-header';
import { Card, CardBody, SectionPanel } from '../../components/ui/card';
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
  const fetchStatus = useCallback(
    () => adminFetch<SetupStatus>('/admin/setup/status'),
    [],
  );
  const { data: status, loading, error: statusError, reload } = useAdminQuery(fetchStatus, []);

  // HQ init form
  const [hqForm, setHqForm] = useState(INITIAL_HQ_FORM);
  const [hqAddress, setHqAddress] = useState<BranchAddressValue>(MANILA);
  const [hqBusy, setHqBusy] = useState(false);
  const [hqError, setHqError] = useState('');

  // Operational branch form
  const [branchForm, setBranchForm] = useState(INITIAL_BRANCH_FORM);
  const [branchAddress, setBranchAddress] = useState<BranchAddressValue>(MANILA);
  const [branchBusy, setBranchBusy] = useState(false);
  const [branchError, setBranchError] = useState('');
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
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="App Setup"
        description="One-time initialization to prepare the platform for production. Complete these steps before onboarding your first partner."
      />

      {/* Status banner */}
      {loading && !status && (
        <p className="text-sm text-muted">Checking setup status…</p>
      )}
      {statusError && (
        <div className="alert-error" role="alert">{statusError}</div>
      )}
      {status && (
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
            status.initialized
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-300 bg-amber-50 text-amber-800'
          }`}
        >
          <span className="mt-0.5 shrink-0 text-base">{status.initialized ? '✓' : '!'}</span>
          <div>
            {status.initialized ? (
              <>
                <p className="font-medium">Network initialized</p>
                <p className="mt-0.5 text-xs">
                  HQ: {status.hqBranch?.name} ({status.hqBranch?.code}) — {status.hqBranch?.city}.
                  {' '}{status.operationalBranchCount} operational branch{status.operationalBranchCount !== 1 ? 'es' : ''}.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">Setup required</p>
                <p className="mt-0.5 text-xs">
                  No network structure found. Initialize the HQ branch below before onboarding partners.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Section A: Initialize network */}
      {status && !status.initialized && (
        <SectionPanel
          title="Initialize network"
          description="Creates the root HQ branch that anchors the branch hierarchy. Required before any partner can be onboarded."
        >
          <form onSubmit={handleInitNetwork} className="p-6">
            <div className="dc-form-grid">
              <div>
                <label className="form-label">HQ code</label>
                <input
                  className="input-field uppercase"
                  value={hqForm.code}
                  onChange={setHq('code')}
                  required
                  placeholder="HQ-01"
                />
              </div>
              <div>
                <label className="form-label">HQ name</label>
                <input
                  className="input-field"
                  value={hqForm.name}
                  onChange={setHq('name')}
                  required
                  placeholder="e.g. Lunara HQ"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Location</label>
                <BranchAddressEditor value={hqAddress} onChange={setHqAddress} />
              </div>
            </div>
            {hqError && (
              <div className="alert-error mt-4" role="alert">{hqError}</div>
            )}
            <div className="mt-4">
              <button type="submit" className="btn-primary" disabled={hqBusy}>
                {hqBusy ? 'Initializing…' : 'Initialize network'}
              </button>
            </div>
          </form>
        </SectionPanel>
      )}

      {/* Section B: Add first operational branch */}
      {status?.initialized && status.operationalBranchCount === 0 && (
        <SectionPanel
          title="Add first operational branch"
          description="This branch will appear in the Parent branch dropdown when onboarding partners. Add at least one before creating partners."
        >
          <form onSubmit={handleCreateBranch} className="p-6">
            <div className="dc-form-grid">
              <div>
                <label className="form-label">Branch code</label>
                <input
                  className="input-field uppercase"
                  value={branchForm.code}
                  onChange={setBranch('code')}
                  required
                  placeholder="e.g. MNL-01"
                />
              </div>
              <div>
                <label className="form-label">Branch name</label>
                <input
                  className="input-field"
                  value={branchForm.name}
                  onChange={setBranch('name')}
                  required
                  placeholder="e.g. Manila Central"
                />
              </div>
              <div>
                <label className="form-label">Type</label>
                <select
                  className="input-field"
                  value={branchForm.branchType}
                  onChange={setBranch('branchType')}
                >
                  <option value="partner_shop">Partner shop</option>
                  <option value="franchise">Franchise</option>
                </select>
              </div>
              <div>
                <label className="form-label">Service radius (km)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  className="input-field"
                  value={branchForm.serviceRadiusKm}
                  onChange={setBranch('serviceRadiusKm')}
                  required
                />
              </div>
              <div>
                <label className="form-label">Max active orders</label>
                <input
                  type="number"
                  min="1"
                  className="input-field"
                  value={branchForm.maxActiveOrders}
                  onChange={setBranch('maxActiveOrders')}
                  required
                />
              </div>
              <div>
                <label className="form-label">Max weight (kg)</label>
                <input
                  type="number"
                  min="1"
                  className="input-field"
                  value={branchForm.maxWeightCapacityKg}
                  onChange={setBranch('maxWeightCapacityKg')}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Location</label>
                <BranchAddressEditor value={branchAddress} onChange={setBranchAddress} />
              </div>
            </div>
            {branchError && (
              <div className="alert-error mt-4" role="alert">{branchError}</div>
            )}
            {branchCreated && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Branch created. You can now{' '}
                <Link href="/partners/new" className="font-medium underline underline-offset-2">
                  onboard your first partner
                </Link>
                .
              </div>
            )}
            <div className="mt-4">
              <button type="submit" className="btn-primary" disabled={branchBusy}>
                {branchBusy ? 'Creating…' : 'Create branch'}
              </button>
            </div>
          </form>
        </SectionPanel>
      )}

      {/* Quick links */}
      <Card>
        <CardBody className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Quick links</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/partners/new" className={status?.operationalBranchCount ? 'link-primary' : 'pointer-events-none text-muted'}>
                Onboard a partner
              </Link>
              {!status?.operationalBranchCount && (
                <span className="ml-2 text-xs text-muted">(requires at least 1 operational branch)</span>
              )}
            </li>
            <li>
              <Link href="/branches" className="link-primary">Branches</Link>
              <span className="text-muted"> — view and manage the full branch network</span>
            </li>
            <li>
              <Link href="/settings" className="link-primary">Settings</Link>
              <span className="text-muted"> — delivery fees, coverage radii, display preferences</span>
            </li>
            <li>
              <Link href="/shops" className="link-primary">Shops</Link>
              <span className="text-muted"> — partner accounts overview</span>
            </li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
