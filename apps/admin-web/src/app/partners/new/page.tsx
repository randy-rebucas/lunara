'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '../../../lib/admin-api';

interface Branch {
  _id: string;
  code: string;
  name: string;
}

const INITIAL_FORM = {
  email: '',
  phone: '',
  password: '',
  branchCode: '',
  branchName: '',
  branchType: 'partner_shop' as 'partner_shop' | 'franchise',
  parentBranchId: '',
  line1: '',
  city: '',
  province: '',
  lat: '14.5995',
  lng: '120.9842',
  commissionRate: '20',
  maxActiveOrders: '20',
  maxWeightCapacityKg: '200',
};

export default function CreatePartnerPage() {
  const router = useRouter();
  const [form, setForm] = useState(INITIAL_FORM);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadBranches = useCallback(async () => {
    try {
      const data = await adminFetch<Branch[]>('/admin/branches');
      setBranches(data);
    } catch {
      // non-fatal — dropdown will be empty
    }
  }, []);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  function set(key: keyof typeof INITIAL_FORM) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function generatePassword() {
    setForm((f) => ({ ...f, password: `Lunara${Math.random().toString(36).slice(2, 10)}!` }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await adminFetch('/admin/partners/onboard', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          password: form.password,
          branchCode: form.branchCode.trim().toUpperCase(),
          branchName: form.branchName.trim(),
          branchType: form.branchType,
          parentBranchId: form.parentBranchId,
          line1: form.line1.trim(),
          city: form.city.trim(),
          province: form.province.trim(),
          coordinates: [Number(form.lng), Number(form.lat)],
          commissionRate: Number(form.commissionRate) / 100,
          maxActiveOrders: Number(form.maxActiveOrders),
          maxWeightCapacityKg: Number(form.maxWeightCapacityKg),
        }),
      });
      router.push('/shops');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create partner');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/shops" className="text-xs text-muted hover:text-primary">← Shops</Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Create partner</h1>
          <p className="mt-1 text-sm text-muted">Creates a portal login account and branch in one step.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Account */}
        <section className="section-panel">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Account</h2>
            <p className="mt-0.5 text-xs text-muted">Partner uses these credentials to log in to partner-web.</p>
          </div>
          <div className="p-6">
            <div className="dc-form-grid">
              <div>
                <label htmlFor="email" className="form-label">Email</label>
                <input id="email" type="email" className="input-field" value={form.email} onChange={set('email')} required autoComplete="off" />
              </div>
              <div>
                <label htmlFor="phone" className="form-label">
                  Phone <span className="font-normal text-muted">(optional)</span>
                </label>
                <input id="phone" type="tel" className="input-field" value={form.phone} onChange={set('phone')} placeholder="+63917…" autoComplete="off" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="password" className="form-label">Temporary password</label>
                <div className="flex gap-2">
                  <input
                    id="password"
                    type="text"
                    className="input-field min-w-0 flex-1 font-mono text-sm"
                    value={form.password}
                    onChange={set('password')}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                  />
                  <button type="button" className="btn-outline btn-sm shrink-0 self-end" onClick={generatePassword}>
                    Generate
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted">Share this with the partner after creation. They can change it on first login.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Branch */}
        <section className="section-panel">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Branch</h2>
            <p className="mt-0.5 text-xs text-muted">Physical shop location that receives and processes orders.</p>
          </div>
          <div className="p-6">
            <div className="dc-form-grid">
              <div>
                <label htmlFor="branchCode" className="form-label">Branch code</label>
                <input id="branchCode" className="input-field uppercase" value={form.branchCode} onChange={set('branchCode')} required placeholder="e.g. PS-QC-01" />
              </div>
              <div>
                <label htmlFor="branchName" className="form-label">Branch name</label>
                <input id="branchName" className="input-field" value={form.branchName} onChange={set('branchName')} required placeholder="e.g. Quezon City North" />
              </div>
              <div>
                <label htmlFor="branchType" className="form-label">Type</label>
                <select id="branchType" className="input-field" value={form.branchType} onChange={set('branchType')}>
                  <option value="partner_shop">Partner shop</option>
                  <option value="franchise">Franchise</option>
                </select>
              </div>
              <div>
                <label htmlFor="parentBranchId" className="form-label">Parent branch</label>
                <select id="parentBranchId" className="input-field" value={form.parentBranchId} onChange={set('parentBranchId')} required>
                  <option value="">Select parent</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>{b.code} — {b.name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="line1" className="form-label">Address</label>
                <input id="line1" className="input-field" value={form.line1} onChange={set('line1')} required placeholder="Street address" />
              </div>
              <div>
                <label htmlFor="city" className="form-label">City</label>
                <input id="city" className="input-field" value={form.city} onChange={set('city')} required />
              </div>
              <div>
                <label htmlFor="province" className="form-label">Province</label>
                <input id="province" className="input-field" value={form.province} onChange={set('province')} required />
              </div>
              <div>
                <label htmlFor="lat" className="form-label">Latitude</label>
                <input id="lat" type="number" step="any" className="input-field" value={form.lat} onChange={set('lat')} required />
              </div>
              <div>
                <label htmlFor="lng" className="form-label">Longitude</label>
                <input id="lng" type="number" step="any" className="input-field" value={form.lng} onChange={set('lng')} required />
              </div>
            </div>
          </div>
        </section>

        {/* Capacity & commission */}
        <section className="section-panel">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Capacity &amp; commission</h2>
            <p className="mt-0.5 text-xs text-muted">Operational limits and Lunara&apos;s platform fee on this branch.</p>
          </div>
          <div className="p-6">
            <div className="dc-form-grid">
              <div>
                <label htmlFor="maxActiveOrders" className="form-label">Max active orders</label>
                <input id="maxActiveOrders" type="number" min="1" className="input-field" value={form.maxActiveOrders} onChange={set('maxActiveOrders')} required />
              </div>
              <div>
                <label htmlFor="maxWeightCapacityKg" className="form-label">Max weight (kg)</label>
                <input id="maxWeightCapacityKg" type="number" min="1" className="input-field" value={form.maxWeightCapacityKg} onChange={set('maxWeightCapacityKg')} required />
              </div>
              <div>
                <label htmlFor="commissionRate" className="form-label">Commission rate (%)</label>
                <input id="commissionRate" type="number" min="0" max="50" step="0.5" className="input-field" value={form.commissionRate} onChange={set('commissionRate')} required />
                <p className="mt-1 text-xs text-muted">Platform fee taken from laundry subtotal. Default 20%.</p>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="alert-error" role="alert">{error}</div>
        ) : null}

        <div className="flex items-center justify-between">
          <Link href="/shops" className="btn-outline btn-sm">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create partner & branch'}
          </button>
        </div>
      </form>
    </div>
  );
}
