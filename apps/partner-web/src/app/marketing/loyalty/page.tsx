'use client';

import { useCallback } from 'react';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { StatCard } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import { useRequirePartner } from '../../../hooks/use-protected-page';
import { getBranchLoyaltyStats } from '../../../lib/partner-api';
import { usePartnerQuery } from '../../../lib/use-partner-query';
import { useShopPricing } from '../../../lib/use-shop-pricing';

export default function MarketingLoyaltyPage() {
  const { ready } = useRequirePartner();
  const {
    branches,
    branchesLoading,
    branchesError,
    reloadBranches,
    selectedBranchId,
    setSelectedBranchId,
  } = useShopPricing();

  const loadStats = useCallback(async () => {
    if (!selectedBranchId) return null;
    return getBranchLoyaltyStats(selectedBranchId);
  }, [selectedBranchId]);
  const { data: stats, loading: statsLoading, error: statsError, reload: reloadStats } = usePartnerQuery(
    loadStats,
    [selectedBranchId],
  );

  if (!ready) return <AuthLoading message="Loading loyalty…" />;

  return (
    <div>
      <PageHeader
        title="Loyalty"
        description="Lunara Rewards is a platform-wide program — customers earn points automatically on completed orders. Here's how it's performing at your shop."
      />

      <div className="mt-4">
        <DataPageStatus
          loading={branchesLoading}
          error={branchesError}
          loadingMessage="Loading shops…"
          onRetry={reloadBranches}
        />
      </div>

      {!branchesLoading && !branchesError && (branches ?? []).length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">No shops found for your account.</p>
        </div>
      )}

      {(branches ?? []).length > 1 && (
        <div className="mt-4">
          <label className="text-sm font-medium text-slate-900">Shop</label>
          <select
            className="input-field mt-1 w-full max-w-sm"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
          >
            {(branches ?? []).map((b) => (
              <option key={b._id} value={b._id}>
                {b.name} ({b.city})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-4">
        <DataPageStatus
          loading={statsLoading}
          error={statsError}
          loadingMessage="Loading loyalty stats…"
          onRetry={reloadStats}
        />
      </div>

      {stats && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Points earned at this shop" value={stats.totalPointsEarned} accent="accent" />
            <StatCard label="Orders that earned points" value={stats.ordersCounted} />
            <StatCard label="Customers earning here" value={stats.uniqueCustomers} accent="secondary" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="section-panel overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Top customers</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Points earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="text-center text-sm text-muted">
                          No points earned at this shop yet.
                        </td>
                      </tr>
                    ) : (
                      stats.topCustomers.map((c) => (
                        <tr key={c.userId}>
                          <td className="font-medium text-slate-900">{c.displayName}</td>
                          <td className="text-muted">{c.points}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="section-panel overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Points</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentActivity.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center text-sm text-muted">
                          No activity yet.
                        </td>
                      </tr>
                    ) : (
                      stats.recentActivity.map((a, i) => (
                        <tr key={i}>
                          <td className="font-medium text-slate-900">{a.customerName}</td>
                          <td className="text-muted">+{a.amount}</td>
                          <td className="text-muted">{new Date(a.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
