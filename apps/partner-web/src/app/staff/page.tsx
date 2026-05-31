'use client';

import Link from 'next/link';
import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { isPartnerRole, partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

interface StaffMember {
  _id: string;
  email?: string;
  phone?: string;
  activeJobs: number;
}

export default function AssignStaffPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isPartnerRole()) router.replace('/orders');
  }, [router]);

  const load = useCallback(async () => {
    if (!isPartnerRole()) return [] as StaffMember[];
    return partnerFetch<StaffMember[]>('/partner/staff');
  }, []);

  const { data: staff, loading, error } = usePartnerQuery(load, []);

  if (!isPartnerRole()) return null;

  return (
    <div>
      <PageHeader
        title="Assign staff"
        description="View team workload. Open an incoming order to assign a staff member."
        actions={
          <Link href="/orders/incoming" className="btn-primary">
            View incoming orders →
          </Link>
        }
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading staff…" />
      </div>

      <div className="section-panel mt-8 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Phone</th>
              <th>Active jobs</th>
            </tr>
          </thead>
          <tbody>
            {(staff ?? []).map((s) => (
              <tr key={s._id}>
                <td className="text-slate-900">{s.email ?? s._id}</td>
                <td className="text-muted">{s.phone ?? '—'}</td>
                <td>
                  <span className={s.activeJobs > 3 ? 'badge-warning' : 'badge-neutral'}>{s.activeJobs}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !error && (staff ?? []).length === 0 && (
          <p className="p-6 text-sm text-muted">No staff accounts. Run API seed.</p>
        )}
      </div>
    </div>
  );
}
