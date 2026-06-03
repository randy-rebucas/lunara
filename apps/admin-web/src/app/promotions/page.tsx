'use client';

import { useCallback, useState } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { EmptyState } from '../../components/empty-state';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { adminFetch } from '../../lib/admin-api';
import { formatPeso } from '../../lib/format-peso';
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
          code: code.trim().toUpperCase(),
          title: title.trim(),
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

  const activeCount = (items ?? []).filter((p) => p.isActive).length;

  return (
    <div>
      <PageHeader
        title="Promotions"
        description={
          loading
            ? 'Loading promo codes…'
            : `${activeCount} active · ${(items ?? []).length} total`
        }
        actions={
          <button type="button" onClick={() => setShowForm(!showForm)} className="btn-primary btn-sm">
            {showForm ? 'Cancel' : 'New promotion'}
          </button>
        }
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading promotions…" />
      {actionError ? (
        <div className="alert-error mt-4" role="alert">
          {actionError}
        </div>
      ) : null}

      {showForm && (
        <Card className="mt-6 max-w-md">
          <CardBody>
            <form onSubmit={create} className="space-y-4">
              <div>
                <label htmlFor="promo-code" className="form-label">
                  Code
                </label>
                <input
                  id="promo-code"
                  className="input-field font-mono uppercase"
                  placeholder="SUMMER20"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="promo-title" className="form-label">
                  Title
                </label>
                <input
                  id="promo-title"
                  className="input-field"
                  placeholder="Summer discount"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <div className="min-w-[8rem]">
                  <label htmlFor="promo-type" className="form-label">
                    Type
                  </label>
                  <select
                    id="promo-type"
                    className="input-field"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                  >
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label htmlFor="promo-value" className="form-label">
                    Value
                  </label>
                  <input
                    id="promo-value"
                    className="input-field"
                    type="number"
                    min={0}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? 'Creating…' : 'Create promotion'}
              </button>
            </form>
          </CardBody>
        </Card>
      )}

      {!loading && !error && (
        <div className="mt-6 space-y-3">
          {(items ?? []).length === 0 ? (
            <EmptyState
              title="No promotions yet"
              description="Create a code for customers to apply at checkout."
            />
          ) : (
            (items ?? []).map((p) => (
              <div
                key={p._id}
                className="card card-body flex flex-wrap items-center justify-between gap-4 !py-5"
              >
                <div>
                  <p className="font-mono font-bold text-primary">{p.code}</p>
                  <p className="font-medium text-slate-900">{p.title}</p>
                  <p className="text-sm text-muted">
                    {p.discountType === 'percent'
                      ? `${p.discountValue}% off`
                      : `${formatPeso(p.discountValue)} off`}
                    {p.minOrderAmount > 0 ? ` · min ${formatPeso(p.minOrderAmount)}` : ''}
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
            ))
          )}
        </div>
      )}
    </div>
  );
}
