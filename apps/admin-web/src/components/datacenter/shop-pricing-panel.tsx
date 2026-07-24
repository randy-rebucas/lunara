'use client';

import { useEffect, useState } from 'react';
import { SHOP_PRICE_MARKUP_MULTIPLIER } from '@lunara/utils';
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
  basePricePerLoad?: number;
  basePricePerPiece?: number;
  pricingUnit?: string;
}

interface BranchAddonPrice {
  addonSlug: string;
  basePrice: number;
  basePricePerKg?: number;
  basePricePerLoad?: number;
  basePricePerPiece?: number;
  pricingUnit?: string;
}

const MARKUP_MULTIPLIER = SHOP_PRICE_MARKUP_MULTIPLIER;

// Mirrors BranchPricingMode (packages/types) — unset/'flat_bag' means a flat per-order price,
// not billed by kg/load/piece, so it gets no unit suffix at all.
const UNIT_SUFFIX: Record<string, string> = {
  per_kg: '/kg',
  per_load: '/load',
  per_piece: '/piece',
  flat_bag: '',
};

function unitSuffix(pricingUnit?: string): string {
  return UNIT_SUFFIX[pricingUnit ?? 'flat_bag'] ?? '';
}

/** Which rate field actually drives customer billing for this service/add-on's pricing unit —
 * per_load and per_piece each have their own base-rate field, distinct from the per-kg/flat one. */
function rateFieldFor(pricingUnit: string | undefined, kind: 'service' | 'addon'): 'basePricePerKg' | 'basePricePerLoad' | 'basePricePerPiece' | 'basePrice' {
  if (pricingUnit === 'per_load') return 'basePricePerLoad';
  if (pricingUnit === 'per_piece') return 'basePricePerPiece';
  if (pricingUnit === 'per_kg') return 'basePricePerKg';
  return kind === 'addon' ? 'basePrice' : 'basePricePerKg';
}

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
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadError('');

    async function loadCatalog() {
      try {
        const [serviceData, addonData] = await Promise.all([
          adminFetch<CatalogServiceOption[]>('/admin/services'),
          adminFetch<CatalogAddonOption[]>('/admin/addons'),
        ]);
        if (cancelled) return;

        setServices(serviceData);
        const seededPrices: Record<string, string> = {};
        for (const service of serviceData) {
          const override = initialPricing.find((p) => p.serviceType === service.type);
          const field = rateFieldFor(override?.pricingUnit, 'service') as
            | 'basePricePerKg'
            | 'basePricePerLoad'
            | 'basePricePerPiece';
          seededPrices[service.type] = String(override?.[field] ?? service.pricePerKg);
        }
        setPrices(seededPrices);

        setAddons(addonData);
        const seededAddonPrices: Record<string, string> = {};
        for (const addon of addonData) {
          const override = initialAddonPricing.find((p) => p.addonSlug === addon.slug);
          const field = rateFieldFor(override?.pricingUnit, 'addon');
          const rate = field === 'basePrice' ? override?.basePrice : override?.[field];
          seededAddonPrices[addon.slug] = String(rate ?? addon.price);
        }
        setAddonPrices(seededAddonPrices);
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : 'Failed to load pricing catalog');
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, loadAttempt]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await Promise.all([
        adminFetch(`/admin/branches/${branchId}/pricing`, {
          method: 'PATCH',
          body: JSON.stringify({
            // Each service bills off exactly one rate field depending on its pricingUnit
            // (per-kg/per-load/per-piece) — this panel edits whichever one is actually live for
            // that service and carries the other, inactive rate fields over unchanged, since
            // updateServicePricing replaces the whole array and would otherwise wipe out the
            // partner's per-service pricing-unit setup (partner-web's Services & pricing page).
            servicePricing: Object.entries(prices).map(([serviceType, value]) => {
              const existing = initialPricing.find((p) => p.serviceType === serviceType);
              const field = rateFieldFor(existing?.pricingUnit, 'service') as
                | 'basePricePerKg'
                | 'basePricePerLoad'
                | 'basePricePerPiece';
              const numValue = Number(value);
              return {
                serviceType,
                basePricePerKg: field === 'basePricePerKg' ? numValue : existing?.basePricePerKg,
                basePricePerLoad: field === 'basePricePerLoad' ? numValue : existing?.basePricePerLoad,
                basePricePerPiece: field === 'basePricePerPiece' ? numValue : existing?.basePricePerPiece,
                pricingUnit: existing?.pricingUnit,
              };
            }),
          }),
        }),
        adminFetch(`/admin/branches/${branchId}/addon-pricing`, {
          method: 'PATCH',
          body: JSON.stringify({
            addonPricing: Object.entries(addonPrices).map(([addonSlug, value]) => {
              const existing = initialAddonPricing.find((p) => p.addonSlug === addonSlug);
              const field = rateFieldFor(existing?.pricingUnit, 'addon');
              const numValue = Number(value);
              return {
                addonSlug,
                basePrice: field === 'basePrice' ? numValue : (existing?.basePrice ?? 0),
                basePricePerKg: field === 'basePricePerKg' ? numValue : existing?.basePricePerKg,
                basePricePerLoad: field === 'basePricePerLoad' ? numValue : existing?.basePricePerLoad,
                basePricePerPiece: field === 'basePricePerPiece' ? numValue : existing?.basePricePerPiece,
                pricingUnit: existing?.pricingUnit,
              };
            }),
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

  if (loadError) {
    return (
      <div className="pt-2">
        <div className="alert-error text-sm" role="alert">
          {loadError}
        </div>
        <button
          type="button"
          className="btn-outline btn-sm mt-2"
          onClick={() => setLoadAttempt((n) => n + 1)}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!services || !addons) {
    return <p className="pt-2 text-sm text-muted">Loading pricing…</p>;
  }

  return (
    <div className="pt-2">
      <p className="text-xs text-muted">
        This shop&apos;s own prices. Customers see them marked up ×{MARKUP_MULTIPLIER} for Lunara&apos;s cut.
      </p>
      <div className="mt-3 grid items-start gap-x-8 gap-y-5 xl:grid-cols-2">
        <div className="space-y-2">
          {services.map((service) => {
            const base = Number(prices[service.type] ?? 0);
            const suffix = unitSuffix(initialPricing.find((p) => p.serviceType === service.type)?.pricingUnit);
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
                  customer pays ₱{(base * MARKUP_MULTIPLIER).toFixed(2)}{suffix}
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
              const suffix = unitSuffix(initialAddonPricing.find((p) => p.addonSlug === addon.slug)?.pricingUnit);
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
                    customer pays ₱{(base * MARKUP_MULTIPLIER).toFixed(2)}{suffix}
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
