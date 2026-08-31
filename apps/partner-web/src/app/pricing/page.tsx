'use client';

import { useEffect, useState } from 'react';
import { BookingType } from '@lunara/types';
import { GARMENT_CATALOG, getGarmentCategories, SHOP_PRICE_MARKUP_MULTIPLIER } from '@lunara/utils';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { partnerFetch } from '../../lib/partner-api';
import type { PricingMode } from '../../lib/use-shop-pricing';
import { useShopPricing } from '../../lib/use-shop-pricing';

const MARKUP_MULTIPLIER = SHOP_PRICE_MARKUP_MULTIPLIER;

const PRICING_MODE_OPTIONS: { value: PricingMode; label: string }[] = [
  {
    value: 'flat_bag',
    label: 'Flat bag pricing',
  },
  { value: 'per_kg', label: 'Per kilo' },
  { value: 'per_load', label: 'Per load' },
  { value: 'per_piece', label: 'Per piece' },
  { value: 'per_pair', label: 'Per pair' },
  { value: 'per_item', label: 'Per item' },
  { value: 'fixed', label: 'Fixed price' },
];

/** Maps a pricing unit to the ShopServicePrice/ShopAddonPrice field it bills from. */
const RATE_FIELD_BY_MODE = {
  per_kg: 'basePricePerKg',
  per_load: 'basePricePerLoad',
  per_piece: 'basePricePerPiece',
  per_pair: 'basePricePerPair',
  per_item: 'basePricePerItem',
  fixed: 'fixedPrice',
} as const;

/** Custom services aren't flat-bag priced (see resolveCustomServicePricing on the API side, which
 * defaults an unset unit to per-kilo) — exclude that option when editing a custom service's unit. */
const CUSTOM_SERVICE_UNIT_OPTIONS = PRICING_MODE_OPTIONS.filter((opt) => opt.value !== 'flat_bag');

function formatPeso(n: number) {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  core_laundry: 'Core Laundry',
  garment_care: 'Garment Care',
  home_textiles: 'Home Textiles',
  footwear_leather: 'Footwear & Leather',
  wellness_sanitation: 'Wellness & Sanitation',
  specialty: 'Specialty',
};

const ADDON_CATEGORY_LABELS: Record<string, string> = {
  treatment: 'Treatment',
  protection: 'Protection',
  finishing: 'Finishing',
  speed: 'Speed',
  repair: 'Repair',
};

function serviceCategoryLabel(category?: string) {
  if (!category) return 'Custom';
  return SERVICE_CATEGORY_LABELS[category] ?? category;
}

function addonCategoryLabel(category?: string) {
  if (!category) return 'Custom';
  return ADDON_CATEGORY_LABELS[category] ?? category;
}

type PricingTab = 'services' | 'addons' | 'garments' | 'machine';

export default function PricingPage() {
  const { ready } = useRequirePartner();
  const {
    branches,
    branchesLoading,
    branchesError,
    reloadBranches,
    selectedBranchId,
    setSelectedBranchId,
    pricing,
    pricingLoading,
    pricingError,
    reloadPricing,
  } = useShopPricing();

  // Keyed by rate field name (basePricePerKg, basePricePerLoad, basePricePerPiece, basePricePerPair,
  // basePricePerItem, fixedPrice) -> serviceType -> string value. flat_bag has no editable rate.
  const [serviceRates, setServiceRates] = useState<Record<string, Record<string, string>>>({});
  const [serviceUnits, setServiceUnits] = useState<Record<string, PricingMode>>({});
  const [kgPerLoad, setKgPerLoad] = useState('8');
  const [addonPrices, setAddonPrices] = useState<Record<string, string>>({});
  const [addonRates, setAddonRates] = useState<Record<string, Record<string, string>>>({});
  const [addonUnits, setAddonUnits] = useState<Record<string, PricingMode>>({});
  const [addonIncludedQty, setAddonIncludedQty] = useState<Record<string, string>>({});
  const [garmentPrices, setGarmentPrices] = useState<Record<string, string>>({});
  const [collapsedGarmentCategories, setCollapsedGarmentCategories] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activeTab, setActiveTab] = useState<PricingTab>('services');

  useEffect(() => {
    if (activeTab === 'garments' && pricing?.hiddenServiceTypes.includes(BookingType.DRY_CLEANING)) {
      setActiveTab('services');
    }
  }, [activeTab, pricing]);

  useEffect(() => {
    if (!pricing) return;
    const rateFields = Object.values(RATE_FIELD_BY_MODE);
    setServiceRates(
      Object.fromEntries(
        rateFields.map((field) => [
          field,
          Object.fromEntries(
            pricing.services.map((s) => [s.type, s[field as keyof typeof s] != null ? String(s[field as keyof typeof s]) : '']),
          ),
        ]),
      ),
    );
    setServiceUnits(
      Object.fromEntries(pricing.services.map((s) => [s.type, s.pricingUnit ?? 'flat_bag'])),
    );
    setAddonPrices(
      Object.fromEntries(pricing.addons.map((a) => [a.slug, String(a.basePrice)])),
    );
    setAddonRates(
      Object.fromEntries(
        rateFields.map((field) => [
          field,
          Object.fromEntries(
            pricing.addons.map((a) => [a.slug, a[field as keyof typeof a] != null ? String(a[field as keyof typeof a]) : '']),
          ),
        ]),
      ),
    );
    setAddonUnits(
      Object.fromEntries(pricing.addons.map((a) => [a.slug, a.pricingUnit ?? 'flat_bag'])),
    );
    setAddonIncludedQty(
      Object.fromEntries(pricing.addons.map((a) => [a.slug, String(a.includedQuantity ?? 0)])),
    );
    setKgPerLoad(String(pricing.kgPerLoad));
    const catalog = pricing.garmentCatalog ?? GARMENT_CATALOG;
    setCollapsedGarmentCategories(new Set(getGarmentCategories(catalog)));
    setGarmentPrices(Object.fromEntries(catalog.map((g) => [g.id, String(g.price)])));
  }, [pricing]);

  async function save() {
    if (!selectedBranchId || !pricing) return;
    setSaving(true);
    setSaveError('');
    try {
      await Promise.all([
        partnerFetch(`/partner/branches/${selectedBranchId}/pricing`, {
          method: 'PATCH',
          body: JSON.stringify({
            servicePricing: pricing.services
              .filter((s) => !s.isCustom)
              .map((s) => {
                const rates = Object.fromEntries(
                  Object.entries(RATE_FIELD_BY_MODE).map(([, field]) => {
                    const raw = serviceRates[field]?.[s.type];
                    return [field, raw !== '' && raw != null ? Number(raw) : undefined];
                  }),
                );
                return {
                  serviceType: s.type,
                  ...rates,
                  pricingUnit: serviceUnits[s.type] ?? 'flat_bag',
                };
              }),
            kgPerLoad: kgPerLoad !== '' ? Number(kgPerLoad) : undefined,
          }),
        }),
        partnerFetch(`/partner/branches/${selectedBranchId}/addon-pricing`, {
          method: 'PATCH',
          body: JSON.stringify({
            addonPricing: pricing.addons
              .filter((a) => !a.isCustom && !a.isPercentOfService)
              .map((a) => {
                const rates = Object.fromEntries(
                  Object.entries(RATE_FIELD_BY_MODE).map(([, field]) => {
                    const raw = addonRates[field]?.[a.slug];
                    return [field, raw !== '' && raw != null ? Number(raw) : undefined];
                  }),
                );
                return {
                  addonSlug: a.slug,
                  basePrice: Number(addonPrices[a.slug] ?? a.basePrice),
                  ...rates,
                  pricingUnit: addonUnits[a.slug] ?? 'flat_bag',
                  applicableServiceTypes: a.applicableServiceTypes ?? [],
                  includedQuantity: Number(addonIncludedQty[a.slug] ?? 0),
                };
              }),
          }),
        }),
        partnerFetch(`/partner/branches/${selectedBranchId}/hidden-catalog`, {
          method: 'PATCH',
          body: JSON.stringify({
            garmentPricing: (pricing.garmentCatalog ?? GARMENT_CATALOG)
              .filter((g) => garmentPrices[g.id] !== '' && garmentPrices[g.id] != null)
              .map((g) => ({ garmentId: g.id, price: Number(garmentPrices[g.id]) })),
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

  function setGarmentPrice(garmentId: string, value: string) {
    setGarmentPrices((prev) => ({ ...prev, [garmentId]: value }));
  }

  function toggleCollapsedGarmentCategory(category: string) {
    setCollapsedGarmentCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  if (!ready) return <AuthLoading message="Loading pricing…" />;

  const offeredServices = (pricing?.services ?? []).filter(
    (s) => s.isCustom || !pricing!.hiddenServiceTypes.includes(s.type),
  );
  const offeredAddons = (pricing?.addons ?? []).filter(
    (a) => a.isCustom || a.isPercentOfService || !pricing!.hiddenAddonSlugs.includes(a.slug),
  );

  return (
    <div>
      <PageHeader
        title="Pricing"
        description="Set your own price per service and add-on. Customers pay your price plus Lunara's markup. Choose what you offer on the Services page."
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
          loading={pricingLoading}
          error={pricingError}
          loadingMessage="Loading pricing…"
          onRetry={reloadPricing}
        />
      </div>

      {pricing && (
        <>
          <div className="mt-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-slate-50 p-1">
            {(
              [
                { id: 'services', label: 'Services' },
                { id: 'addons', label: 'Add-ons' },
                ...(!pricing.hiddenServiceTypes.includes(BookingType.DRY_CLEANING)
                  ? [{ id: 'garments' as const, label: 'Dry cleaning garments' }]
                  : []),
                { id: 'machine', label: 'Machine load' },
              ] satisfies { id: PricingTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-1 ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-muted hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'machine' && (
            <div className="section-panel mt-4 overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Machine load capacity</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Used to estimate machine loads for per-load pricing (e.g. 7 or 8 kg per load).
                </p>
                <label className="mt-3 block max-w-[10rem]">
                  <span className="text-xs font-medium text-slate-700">Kg per machine load</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className="input-field mt-1 w-full"
                    value={kgPerLoad}
                    onChange={(e) => setKgPerLoad(e.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'services' && (
            <div className="section-panel mt-4 overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Services</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Set the billing unit and rate per service — mix per-kilo, per-load, per-piece, and
                  flat-bag freely. Add or hide services on the Services page.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Category</th>
                      <th>Unit</th>
                      <th>Your price</th>
                      <th>Customer pays</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offeredServices.map((s) => {
                      const key = s.customServiceId ?? s.type;
                      if (s.isCustom) {
                        const customUnit = s.pricingUnit ?? 'per_kg';
                        const customRateField = RATE_FIELD_BY_MODE[customUnit as keyof typeof RATE_FIELD_BY_MODE];
                        const customRate = customRateField
                          ? ((s[customRateField as keyof typeof s] as number | undefined) ?? 0)
                          : s.basePricePerKg;
                        return (
                          <tr key={key}>
                            <td className="font-medium text-slate-900">
                              {s.label} <span className="badge-accent ml-1 text-xs">Custom</span>
                            </td>
                            <td className="text-muted">
                              <span className="badge-neutral text-xs">{serviceCategoryLabel(s.category)}</span>
                            </td>
                            <td className="text-muted">
                              {CUSTOM_SERVICE_UNIT_OPTIONS.find((opt) => opt.value === customUnit)?.label ?? customUnit}
                            </td>
                            <td className="text-muted">{formatPeso(customRate)}</td>
                            <td className="text-muted">{formatPeso(s.customerPricePerKg)}</td>
                          </tr>
                        );
                      }
                      const unit = serviceUnits[s.type] ?? 'flat_bag';
                      const rateField = unit === 'flat_bag' ? undefined : RATE_FIELD_BY_MODE[unit];
                      const base = rateField ? Number(serviceRates[rateField]?.[s.type] ?? 0) : 0;
                      return (
                        <tr key={key}>
                          <td className="font-medium text-slate-900">{s.label}</td>
                          <td className="text-muted">
                            <span className="badge-neutral text-xs">{serviceCategoryLabel(s.category)}</span>
                          </td>
                          <td>
                            <select
                              className="input-field w-32"
                              value={unit}
                              onChange={(e) =>
                                setServiceUnits((p) => ({ ...p, [s.type]: e.target.value as PricingMode }))
                              }
                            >
                              {PRICING_MODE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {!rateField ? (
                              <span className="text-xs text-muted">
                                Platform-wide flat pricing — not partner-configurable
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted">₱</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.5"
                                  className="input-field w-28"
                                  value={serviceRates[rateField]?.[s.type] ?? ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setServiceRates((p) => ({
                                      ...p,
                                      [rateField]: { ...p[rateField], [s.type]: value },
                                    }));
                                  }}
                                />
                              </div>
                            )}
                          </td>
                          <td className="text-muted">
                            {!rateField ? '—' : formatPeso(base * MARKUP_MULTIPLIER)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'addons' && (
            <div className="section-panel mt-4 overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Add-ons</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Add or hide add-ons on the Services page. Custom add-on prices are set when you create
                  them there.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Add-on</th>
                      <th>Category</th>
                      <th>Unit</th>
                      <th>Your price</th>
                      <th>Customer pays</th>
                      <th>Included in package</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offeredAddons.map((a) => {
                      const key = a.customAddonId ?? a.slug;
                      if (a.isCustom) {
                        return (
                          <tr key={key}>
                            <td className="font-medium text-slate-900">
                              {a.label} <span className="badge-accent ml-1 text-xs">Custom</span>
                            </td>
                            <td className="text-muted">
                              <span className="badge-neutral text-xs">{addonCategoryLabel(a.category)}</span>
                            </td>
                            <td className="text-muted">Flat</td>
                            <td className="text-muted">{formatPeso(a.basePrice)}</td>
                            <td className="text-muted">{formatPeso(a.customerPrice)}</td>
                            <td className="text-muted">—</td>
                          </tr>
                        );
                      }
                      if (a.isPercentOfService) {
                        return (
                          <tr key={key}>
                            <td className="font-medium text-slate-900">{a.label}</td>
                            <td className="text-muted">
                              <span className="badge-neutral text-xs">{addonCategoryLabel(a.category)}</span>
                            </td>
                            <td className="text-muted">% of service</td>
                            <td className="text-muted">
                              +{a.basePrice}% <span className="text-xs">(not partner-configurable)</span>
                            </td>
                            <td className="text-muted">+{a.customerPrice}%</td>
                            <td className="text-muted">—</td>
                          </tr>
                        );
                      }
                      const unit = addonUnits[a.slug] ?? 'flat_bag';
                      const rateField = unit === 'flat_bag' ? undefined : RATE_FIELD_BY_MODE[unit];
                      const base = rateField
                        ? Number(addonRates[rateField]?.[a.slug] ?? 0)
                        : Number(addonPrices[a.slug] ?? 0);
                      return (
                        <tr key={key}>
                          <td className="font-medium text-slate-900">{a.label}</td>
                          <td className="text-muted">
                            <span className="badge-neutral text-xs">{addonCategoryLabel(a.category)}</span>
                          </td>
                          <td>
                            <select
                              className="input-field w-32"
                              value={unit}
                              onChange={(e) =>
                                setAddonUnits((p) => ({ ...p, [a.slug]: e.target.value as PricingMode }))
                              }
                            >
                              {PRICING_MODE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.value === 'flat_bag' ? 'Flat' : opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted">₱</span>
                              <input
                                type="number"
                                min={0}
                                step="0.5"
                                className="input-field w-28"
                                value={rateField ? (addonRates[rateField]?.[a.slug] ?? '') : (addonPrices[a.slug] ?? '')}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (rateField) {
                                    setAddonRates((p) => ({
                                      ...p,
                                      [rateField]: { ...p[rateField], [a.slug]: value },
                                    }));
                                  } else {
                                    setAddonPrices((p) => ({ ...p, [a.slug]: value }));
                                  }
                                }}
                              />
                            </div>
                          </td>
                          <td className="text-muted">{formatPeso(base * MARKUP_MULTIPLIER)}</td>
                          <td>
                            {a.allowsQuantity ? (
                              <input
                                type="number"
                                min={0}
                                max={a.maxQuantity ?? 5}
                                step={1}
                                className="input-field w-20"
                                value={addonIncludedQty[a.slug] ?? '0'}
                                onChange={(e) =>
                                  setAddonIncludedQty((p) => ({ ...p, [a.slug]: e.target.value }))
                                }
                                title="How many units of this add-on come free with the service — customers are only charged beyond this."
                              />
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'garments' && !pricing.hiddenServiceTypes.includes(BookingType.DRY_CLEANING) && (
            <div className="section-panel mt-4 overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Dry cleaning garments</h2>
                <p className="mt-1 text-xs text-muted">
                  Set your price per garment. Choose which garments you offer on the Services page.
                </p>
              </div>

              <div className="divide-y divide-border">
                {getGarmentCategories(pricing.garmentCatalog ?? GARMENT_CATALOG)
                  .map((category) => ({
                    category,
                    garments: (pricing.garmentCatalog ?? GARMENT_CATALOG).filter(
                      (g) => g.category === category && !pricing.hiddenGarmentItemIds.includes(g.id),
                    ),
                  }))
                  .filter(({ garments }) => garments.length > 0)
                  .map(({ category, garments }) => {
                    const collapsed = collapsedGarmentCategories.has(category);
                    return (
                      <div key={category} className="p-4">
                        <button
                          type="button"
                          className="text-sm font-medium text-slate-900"
                          onClick={() => toggleCollapsedGarmentCategory(category)}
                        >
                          {collapsed ? '▸' : '▾'} {category}{' '}
                          <span className="text-xs font-normal text-muted">({garments.length} offered)</span>
                        </button>
                        {!collapsed && (
                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {garments.map((g) => (
                              <div
                                key={g.id}
                                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted"
                              >
                                <span className="flex-1 text-slate-900">{g.label}</span>
                                <span>₱</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className="input-field w-20 py-1 text-xs"
                                  value={garmentPrices[g.id] ?? String(g.price)}
                                  onChange={(e) => setGarmentPrice(g.id, e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

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
