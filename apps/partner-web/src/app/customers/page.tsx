'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { exportCsv } from '../../lib/export-csv';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

interface CustomerRow {
  customerId: string;
  name: string;
  phone?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string;
}

function formatPeso(n: number) {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CustomersPage() {
  const { ready } = useRequirePartner();

  const load = useCallback(async () => {
    return partnerFetch<CustomerRow[]>('/partner/customers');
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
        <div className="section-panel mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Orders</th>
                  <th>Total spent</th>
                  <th>Last order</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(customers ?? []).map((c) => (
                  <tr key={c.customerId}>
                    <td className="font-medium text-slate-900">{c.name.trim() || '—'}</td>
                    <td className="text-muted">{c.phone ?? '—'}</td>
                    <td>
                      <span className="badge-neutral">{c.totalOrders}</span>
                    </td>
                    <td className="font-medium">{formatPeso(c.totalSpent)}</td>
                    <td className="text-muted">{formatDate(c.lastOrderAt)}</td>
                    <td>
                      <Link
                        href={`/orders/history?customer=${c.customerId}`}
                        className="text-xs text-primary hover:underline"
                      >
                        View orders →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
