'use client';

import Link from 'next/link';
import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DataPageStatus } from '../../components/data-page-status';
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
      <h2 className="text-2xl font-bold">Assign staff</h2>
      <p className="mt-1 text-sm text-slate-500">
        View team workload. Open an incoming order to assign a staff member.
      </p>

      <Link
        href="/orders/incoming"
        className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
      >
        View incoming orders →
      </Link>

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading staff…" />
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium">Staff</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Active jobs</th>
            </tr>
          </thead>
          <tbody>
            {(staff ?? []).map((s) => (
              <tr key={s._id} className="border-b last:border-0">
                <td className="px-4 py-3">{s.email ?? s._id}</td>
                <td className="px-4 py-3 text-slate-500">{s.phone ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      s.activeJobs > 3 ? 'font-medium text-amber-600' : 'text-slate-700'
                    }
                  >
                    {s.activeJobs}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !error && (staff ?? []).length === 0 && (
          <p className="p-6 text-slate-500">No staff accounts. Run API seed.</p>
        )}
      </div>
    </div>
  );
}
