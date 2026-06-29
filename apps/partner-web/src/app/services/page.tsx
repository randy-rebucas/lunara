'use client';

import { useCallback } from 'react';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

interface ServiceItem {
  _id: string;
  type: string;
  label: string;
  description: string;
  pricePerKg: number;
  minWeightKg: number;
  isActive: boolean;
}

function formatPeso(n: number) {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

export default function ServicesPage() {
  const { ready } = useRequirePartner();

  const load = useCallback(async () => {
    return partnerFetch<ServiceItem[]>('/partner/services');
  }, []);

  const { data: services, loading, error } = usePartnerQuery(load, []);

  if (!ready) return <AuthLoading message="Loading services…" />;

  return (
    <div>
      <PageHeader
        title="Services & pricing"
        description="Active laundry services and their current rates. Pricing is set by Lunara."
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading services…" />
      </div>

      {!loading && !error && (services ?? []).length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">No active services found.</p>
        </div>
      )}

      {(services ?? []).length > 0 && (
        <div className="section-panel mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Type</th>
                  <th>Price per kg</th>
                  <th>Min. weight</th>
                </tr>
              </thead>
              <tbody>
                {(services ?? []).map((s) => (
                  <tr key={s._id}>
                    <td>
                      <p className="font-medium text-slate-900">{s.label}</p>
                      <p className="text-xs text-muted">{s.description}</p>
                    </td>
                    <td>
                      <span className="badge-neutral capitalize">{s.type.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="font-semibold text-slate-900">{formatPeso(s.pricePerKg)}</td>
                    <td className="text-muted">{s.minWeightKg} kg</td>
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
