'use client';

import { useCallback, useState } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';

interface Promotion {
  _id: string;
  code: string;
  title: string;
  description?: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  isActive: boolean;
}

export default function PromotionsPage() {
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(() => adminFetch<Promotion[]>('/admin/promotions'), []);
  const { data: items, loading, error, reload } = useAdminQuery(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setActionError('');
    try {
      await adminFetch('/admin/promotions', {
        method: 'POST',
        body: JSON.stringify({
          code,
          title,
          discountType,
          discountValue: Number(discountValue),
          minOrderAmount: 0,
          isActive: true,
        }),
      });
      setShowForm(false);
      setCode('');
      setTitle('');
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to create promotion');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Promotion) {
    setActionError('');
    try {
      await adminFetch(`/admin/promotions/${p._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update promotion');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Manage promotions</h2>
          <p className="mt-1 text-sm text-slate-500">Create and enable promo codes for customers.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
        >
          {showForm ? 'Cancel' : 'New promotion'}
        </button>
      </div>

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading promotions…" />
      </div>
      {actionError && <p className="mt-2 text-sm text-red-500">{actionError}</p>}

      {showForm && (
        <form onSubmit={create} className="mt-6 max-w-md space-y-3 rounded-xl border bg-white p-6 shadow-sm">
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Code (e.g. SUMMER20)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <select
              className="rounded border px-3 py-2 text-sm"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
            >
              <option value="percent">Percent</option>
              <option value="fixed">Fixed ₱</option>
            </select>
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm text-white disabled:opacity-50"
          >
            Create
          </button>
        </form>
      )}

      <div className="mt-6 space-y-3">
        {(items ?? []).map((p) => (
          <div
            key={p._id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-5 shadow-sm"
          >
            <div>
              <p className="font-mono font-bold text-indigo-600">{p.code}</p>
              <p className="font-medium">{p.title}</p>
              <p className="text-sm text-slate-500">
                {p.discountType === 'percent' ? `${p.discountValue}%` : `₱${p.discountValue}`} off
                {p.minOrderAmount > 0 ? ` · min ₱${p.minOrderAmount}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleActive(p)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                p.isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {p.isActive ? 'Active' : 'Inactive'}
            </button>
          </div>
        ))}
        {!loading && !error && (items ?? []).length === 0 && (
          <p className="text-slate-500">No promotions yet.</p>
        )}
      </div>
    </div>
  );
}
