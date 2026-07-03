'use client';

import { useCallback, useEffect, useState } from 'react';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

interface BranchOption {
  _id: string;
  code: string;
  name: string;
  branchType: string;
  city: string;
}

interface ShopServicePrice {
  type: string;
  label: string;
  basePricePerKg: number;
  customerPricePerKg: number;
}

interface ShopAddonPrice {
  slug: string;
  label: string;
  basePrice: number;
  customerPrice: number;
}

interface ShopPricing {
  services: ShopServicePrice[];
  addons: ShopAddonPrice[];
}

const MARKUP_MULTIPLIER = 1.3;

function formatPeso(n: number) {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

export default function ServicesPage() {
  const { ready } = useRequirePartner();

  const loadBranches = useCallback(async () => {
    return partnerFetch<BranchOption[]>('/partner/branches');
  }, []);
  const { data: branches, loading: branchesLoading, error: branchesError } = usePartnerQuery(
    loadBranches,
    [],
  );

  const [selectedBranchId, setSelectedBranchId] = useState('');
  useEffect(() => {
    if (!selectedBranchId && branches && branches.length > 0) {
      setSelectedBranchId(branches[0]._id);
    }
  }, [branches, selectedBranchId]);

  const loadPricing = useCallback(async () => {
    if (!selectedBranchId) return null;
    return partnerFetch<ShopPricing>(`/partner/branches/${selectedBranchId}/pricing`);
  }, [selectedBranchId]);
  const {
    data: pricing,
    loading: pricingLoading,
    error: pricingError,
    reload: reloadPricing,
  } = usePartnerQuery(loadPricing, [selectedBranchId]);

  const [servicePrices, setServicePrices] = useState<Record<string, string>>({});
  const [addonPrices, setAddonPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!pricing) return;
    setServicePrices(
      Object.fromEntries(pricing.services.map((s) => [s.type, String(s.basePricePerKg)])),
    );
    setAddonPrices(
      Object.fromEntries(pricing.addons.map((a) => [a.slug, String(a.basePrice)])),
    );
  }, [pricing]);

  async function save() {
    if (!selectedBranchId) return;
    setSaving(true);
    setSaveError('');
    try {
      await Promise.all([
        partnerFetch(`/partner/branches/${selectedBranchId}/pricing`, {
          method: 'PATCH',
          body: JSON.stringify({
            servicePricing: Object.entries(servicePrices).map(([serviceType, value]) => ({
              serviceType,
              basePricePerKg: Number(value),
            })),
          }),
        }),
        partnerFetch(`/partner/branches/${selectedBranchId}/addon-pricing`, {
          method: 'PATCH',
          body: JSON.stringify({
            addonPricing: Object.entries(addonPrices).map(([addonSlug, value]) => ({
              addonSlug,
              basePrice: Number(value),
            })),
          }),
        }),
      ]);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      await reloadPricing();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save pricing');
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <AuthLoading message="Loading services…" />;

  return (
    <div>
      <PageHeader
        title="Services & pricing"
        description="Set your own price per service and add-on. Customers pay your price plus Lunara's markup."
      />

      <div className="mt-4">
        <DataPageStatus loading={branchesLoading} error={branchesError} loadingMessage="Loading shops…" />
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
        <DataPageStatus loading={pricingLoading} error={pricingError} loadingMessage="Loading pricing…" />
      </div>

      {pricing && (
        <>
          <div className="section-panel mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Your price / kg</th>
                    <th>Customer pays / kg</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.services.map((s) => {
                    const base = Number(servicePrices[s.type] ?? 0);
                    return (
                      <tr key={s.type}>
                        <td className="font-medium text-slate-900">{s.label}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted">₱</span>
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              className="input-field w-28"
                              value={servicePrices[s.type] ?? ''}
                              onChange={(e) =>
                                setServicePrices((p) => ({ ...p, [s.type]: e.target.value }))
                              }
                            />
                          </div>
                        </td>
                        <td className="text-muted">{formatPeso(base * MARKUP_MULTIPLIER)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="section-panel mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Add-on</th>
                    <th>Your price</th>
                    <th>Customer pays</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.addons.map((a) => {
                    const base = Number(addonPrices[a.slug] ?? 0);
                    return (
                      <tr key={a.slug}>
                        <td className="font-medium text-slate-900">{a.label}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted">₱</span>
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              className="input-field w-28"
                              value={addonPrices[a.slug] ?? ''}
                              onChange={(e) =>
                                setAddonPrices((p) => ({ ...p, [a.slug]: e.target.value }))
                              }
                            />
                          </div>
                        </td>
                        <td className="text-muted">{formatPeso(base * MARKUP_MULTIPLIER)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {saveError && <p className="mt-3 text-sm text-destructive">{saveError}</p>}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : 'Save pricing'}
            </button>
            {saved && <span className="badge-accent text-xs">Saved</span>}
          </div>
        </>
      )}
    </div>
  );
}
