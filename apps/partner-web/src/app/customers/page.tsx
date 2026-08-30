'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PartnerCustomerDetail, PartnerCustomerSummary } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { exportCsv } from '../../lib/export-csv';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

interface CustomerOrder {
  _id: string;
  status: string;
  totalAmount?: number;
  paymentMethod?: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  customer_pickup: 'Picked up',
};

function formatPeso(n: number) {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CustomersPage() {
  const { ready } = useRequirePartner();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    return partnerFetch<PartnerCustomerSummary[]>('/partner/customers');
  }, []);

  const { data: customers, loading, error } = usePartnerQuery(load, []);

  if (!ready) return <AuthLoading message="Loading customers…" />;

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Customers who have completed orders with your shop."
        actions={
          <button
            type="button"
            className="btn-outline btn-sm"
            disabled={!customers?.length}
            onClick={() => {
              if (!customers) return;
              exportCsv(
                'customers.csv',
                ['Name', 'Phone', 'Orders', 'Total Spent (₱)', 'Last Order'],
                customers.map((c) => [
                  c.name.trim() || c.customerId,
                  c.phone ?? '',
                  c.totalOrders,
                  c.totalSpent,
                  formatDate(c.lastOrderAt),
                ]),
              );
            }}
          >
            Export CSV
          </button>
        }
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading customers…" />
      </div>

      {!loading && !error && (customers ?? []).length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-semibold text-slate-900">No customers yet</p>
          <p className="mt-1 text-sm text-muted">Completed orders will appear here grouped by customer.</p>
        </div>
      )}

      {(customers ?? []).length > 0 && (
        <div
          className={`mt-6 grid gap-4 ${
            selectedId ? 'lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start' : ''
          }`}
        >
          <div className="section-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    {!selectedId && <th>Phone</th>}
                    <th>Orders</th>
                    <th>Total spent</th>
                    <th>Last order</th>
                  </tr>
                </thead>
                <tbody>
                  {(customers ?? []).map((c) => (
                    <tr
                      key={c.customerId}
                      onClick={() => setSelectedId(c.customerId)}
                      className={`cursor-pointer origin-left transition-[transform,background-color] duration-150 ease-out hover:bg-slate-50 ${
                        selectedId === c.customerId ? 'scale-[1.015] bg-primary/5' : ''
                      }`}
                    >
                      <td className="font-medium text-slate-900">{c.name.trim() || '—'}</td>
                      {!selectedId && <td className="text-muted">{c.phone ?? '—'}</td>}
                      <td>
                        <span className="badge-neutral">{c.totalOrders}</span>
                      </td>
                      <td className="font-medium">{formatPeso(c.totalSpent)}</td>
                      <td className="text-muted">{formatDate(c.lastOrderAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedId && (
            <div className="lg:sticky lg:top-4">
              <CustomerDetailPanel customerId={selectedId} onClose={() => setSelectedId(null)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CustomerDetailPanel({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const loadDetail = useCallback(async () => {
    return partnerFetch<PartnerCustomerDetail>(`/partner/customers/${customerId}`);
  }, [customerId]);

  const { data: detail, loading, error, reload, setData } = usePartnerQuery(loadDetail, [customerId]);

  const loadOrders = useCallback(async () => {
    return partnerFetch<CustomerOrder[]>(`/partner/orders/history?customerId=${customerId}`);
  }, [customerId]);

  const { data: orders, loading: ordersLoading, error: ordersError } = usePartnerQuery(loadOrders, [customerId]);

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (detail) {
      setFirstName(detail.firstName);
      setLastName(detail.lastName);
      setPhone(detail.phone ?? '');
    }
    setEditing(false);
  }, [detail]);

  async function save() {
    setSaving(true);
    setSaveError('');
    try {
      const updated = await partnerFetch<PartnerCustomerDetail>(`/partner/customers/${customerId}`, {
        method: 'PATCH',
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() }),
      });
      setData(updated);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-panel">
      <div className="section-panel-header flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">Customer details</h3>
        <button type="button" className="text-sm text-muted hover:underline" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="card-body">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading customer…" />

        {detail && !loading && !error && (
          <div className="space-y-4">
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted">First name</label>
                  <input
                    className="input-field mt-1 min-h-[2.5rem] w-full"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted">Last name</label>
                  <input
                    className="input-field mt-1 min-h-[2.5rem] w-full"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted">Phone</label>
                  <input
                    className="input-field mt-1 min-h-[2.5rem] w-full"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                {saveError && <div className="alert-error">{saveError}</div>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving || !firstName.trim() || !lastName.trim()}
                    className="btn-primary min-h-[2.5rem] flex-1 disabled:opacity-50"
                    onClick={save}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    className="btn-outline min-h-[2.5rem]"
                    onClick={() => reload()}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{detail.name || '—'}</p>
                    <p className="text-sm text-muted">{detail.phone ?? 'No phone on file'}</p>
                    {detail.email && <p className="text-sm text-muted">{detail.email}</p>}
                  </div>
                  <button
                    type="button"
                    className="btn-outline btn-sm shrink-0"
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-4">
                  <div>
                    <p className="text-xs text-muted">Total orders</p>
                    <p className="font-semibold text-slate-900">{detail.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Total spent</p>
                    <p className="font-semibold text-slate-900">{formatPeso(detail.totalSpent)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Last order</p>
                    <p className="font-semibold text-slate-900">{formatDate(detail.lastOrderAt)}</p>
                  </div>
                  {detail.customerSince && (
                    <div>
                      <p className="text-xs text-muted">Customer since</p>
                      <p className="font-semibold text-slate-900">{formatDate(detail.customerSince)}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="border-t border-border/60 pt-4">
              <h4 className="text-sm font-semibold text-slate-900">Order history</h4>
              <div className="mt-2">
                <DataPageStatus loading={ordersLoading} error={ordersError} loadingMessage="Loading orders…" />
              </div>
              {!ordersLoading && !ordersError && (orders ?? []).length === 0 && (
                <p className="mt-2 text-sm text-muted">No orders yet.</p>
              )}
              {(orders ?? []).length > 0 && (
                <ul className="mt-2 divide-y divide-border/60">
                  {(orders ?? []).map((o) => (
                    <li key={o._id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">
                          {STATUS_LABELS[o.status] ?? o.status}
                        </p>
                        <p className="text-xs text-muted">{formatDate(o.createdAt)}</p>
                      </div>
                      <p className="font-medium text-slate-900">
                        {o.totalAmount != null ? formatPeso(o.totalAmount) : '—'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
