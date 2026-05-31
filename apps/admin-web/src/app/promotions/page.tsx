'use client';

import { useCallback, useState } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
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
      <PageHeader
        title="Promotions"
        description="Create and enable promo codes for customers."
        actions={
          <button type="button" onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? 'Cancel' : 'New promotion'}
          </button>
        }
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading promotions…" />
      </div>
      {actionError && <div className="alert-error mt-2">{actionError}</div>}

      {showForm && (
        <Card className="mt-6 max-w-md">
          <CardBody>
            <form onSubmit={create} className="space-y-3">
              <input
                className="input-field"
                placeholder="Code (e.g. SUMMER20)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
              <input
                className="input-field"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <div className="flex gap-2">
                <select
                  className="input-field w-auto"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed ₱</option>
                </select>
                <input
                  className="input-field flex-1"
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={saving} className="btn-primary w-full">
                Create
              </button>
            </form>
          </CardBody>
        </Card>
      )}

      <div className="mt-6 space-y-3">
        {(items ?? []).map((p) => (
          <div key={p._id} className="card card-body flex flex-wrap items-center justify-between gap-4 !py-5">
            <div>
              <p className="font-mono font-bold text-primary">{p.code}</p>
              <p className="font-medium text-slate-900">{p.title}</p>
              <p className="text-sm text-muted">
                {p.discountType === 'percent' ? `${p.discountValue}%` : `₱${p.discountValue}`} off
                {p.minOrderAmount > 0 ? ` · min ₱${p.minOrderAmount}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleActive(p)}
              className={p.isActive ? 'badge-accent px-4 py-2 text-sm' : 'badge-neutral px-4 py-2 text-sm'}
            >
              {p.isActive ? 'Active' : 'Inactive'}
            </button>
          </div>
        ))}
        {!loading && !error && (items ?? []).length === 0 && (
          <p className="text-sm text-muted">No promotions yet.</p>
        )}
      </div>
    </div>
  );
}
