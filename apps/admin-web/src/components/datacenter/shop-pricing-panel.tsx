'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../lib/admin-api';

interface CatalogServiceOption {
  type: string;
  label: string;
  pricePerKg: number;
}

interface CatalogAddonOption {
  slug: string;
  label: string;
  price: number;
}

interface BranchServicePrice {
  serviceType: string;
  basePricePerKg: number;
}

interface BranchAddonPrice {
  addonSlug: string;
  basePrice: number;
}

const MARKUP_MULTIPLIER = 1.3;

export function ShopPricingPanel({
  branchId,
  initialPricing,
  initialAddonPricing,
}: {
  branchId: string;
  initialPricing: BranchServicePrice[];
  initialAddonPricing: BranchAddonPrice[];
}) {
  const [services, setServices] = useState<CatalogServiceOption[] | null>(null);
  const [addons, setAddons] = useState<CatalogAddonOption[] | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [addonPrices, setAddonPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    adminFetch<CatalogServiceOption[]>('/admin/services')
      .then((data) => {
        if (cancelled) return;
        setServices(data);
        const seeded: Record<string, string> = {};
        for (const service of data) {
          const override = initialPricing.find((p) => p.serviceType === service.type);
          seeded[service.type] = String(override?.basePricePerKg ?? service.pricePerKg);
        }
        setPrices(seeded);
      })
      .catch(() => {});
    adminFetch<CatalogAddonOption[]>('/admin/addons')
      .then((data) => {
        if (cancelled) return;
        setAddons(data);
        const seeded: Record<string, string> = {};
        for (const addon of data) {
          const override = initialAddonPricing.find((p) => p.addonSlug === addon.slug);
          seeded[addon.slug] = String(override?.basePrice ?? addon.price);
        }
        setAddonPrices(seeded);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await Promise.all([
        adminFetch(`/admin/branches/${branchId}/pricing`, {
          method: 'PATCH',
          body: JSON.stringify({
            servicePricing: Object.entries(prices).map(([serviceType, value]) => ({
              serviceType,
              basePricePerKg: Number(value),
            })),
          }),
        }),
        adminFetch(`/admin/branches/${branchId}/addon-pricing`, {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save pricing');
    } finally {
      setSaving(false);
    }
  }

  if (!services || !addons) return null;

  return (
    <div className="pt-2">
      <p className="text-xs text-muted">
        This shop&apos;s own prices. Customers see them marked up ×{MARKUP_MULTIPLIER} for Lunara&apos;s cut.
      </p>
      <div className="mt-3 grid items-start gap-x-8 gap-y-5 xl:grid-cols-2">
        <div className="space-y-2">
          {services.map((service) => {
            const base = Number(prices[service.type] ?? 0);
            return (
              <div key={service.type} className="flex items-center gap-3">
                <span className="w-36 min-w-0 truncate text-sm text-slate-900" title={service.label}>
                  {service.label}
                </span>
                <span className="text-sm text-muted">₱</span>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  className="input-field w-24"
                  value={prices[service.type] ?? ''}
                  onChange={(e) =>
                    setPrices((p) => ({ ...p, [service.type]: e.target.value }))
                  }
                />
                <span className="whitespace-nowrap text-xs text-muted">
                  customer pays ₱{(base * MARKUP_MULTIPLIER).toFixed(2)}/kg
                </span>
              </div>
            );
          })}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-900">Add-on pricing</h4>
          <div className="mt-3 space-y-2">
            {addons.map((addon) => {
              const base = Number(addonPrices[addon.slug] ?? 0);
              return (
                <div key={addon.slug} className="flex items-center gap-3">
                  <span className="w-36 min-w-0 truncate text-sm text-slate-900" title={addon.label}>
                    {addon.label}
                  </span>
                  <span className="text-sm text-muted">₱</span>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    className="input-field w-24"
                    value={addonPrices[addon.slug] ?? ''}
                    onChange={(e) =>
                      setAddonPrices((p) => ({ ...p, [addon.slug]: e.target.value }))
                    }
                  />
                  <span className="whitespace-nowrap text-xs text-muted">
                    customer pays ₱{(base * MARKUP_MULTIPLIER).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? 'Saving…' : 'Save pricing'}
        </button>
        {saved ? <span className="badge-accent text-xs">Saved</span> : null}
      </div>
    </div>
  );
}
