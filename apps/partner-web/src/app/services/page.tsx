'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookingType } from '@lunara/types';
import { SHOP_PRICE_MARKUP_MULTIPLIER } from '@lunara/utils';
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

type PricingMode = 'flat_bag' | 'per_kg' | 'per_load' | 'per_piece' | 'per_pair' | 'per_item' | 'fixed';

interface ShopServicePrice {
  type: string;
  label: string;
  category?: string;
  basePricePerKg: number;
  basePricePerLoad?: number;
  basePricePerPiece?: number;
  basePricePerPair?: number;
  basePricePerItem?: number;
  fixedPrice?: number;
  pricingUnit?: PricingMode;
  customerPricePerKg: number;
  isCustom?: boolean;
  customServiceId?: string;
}

interface ShopAddonPrice {
  slug: string;
  label: string;
  category?: string;
  basePrice: number;
  basePricePerKg?: number;
  basePricePerLoad?: number;
  basePricePerPiece?: number;
  basePricePerPair?: number;
  basePricePerItem?: number;
  fixedPrice?: number;
  pricingUnit?: PricingMode;
  /** Global-catalog-only — not partner-configurable, unlike pricingUnit. */
  isPercentOfService?: boolean;
  customerPrice: number;
  isCustom?: boolean;
  customAddonId?: string;
}

interface ShopPricing {
  pricingMode: PricingMode;
  services: ShopServicePrice[];
  addons: ShopAddonPrice[];
  hiddenServiceTypes: string[];
  hiddenAddonSlugs: string[];
}

const MARKUP_MULTIPLIER = SHOP_PRICE_MARKUP_MULTIPLIER;

const PRICING_MODE_OPTIONS: { value: PricingMode; label: string; description: string }[] = [
  {
    value: 'flat_bag',
    label: 'Flat bag pricing',
    description: 'Platform-wide flat price by bag size — not partner-configurable.',
  },
  {
    value: 'per_kg',
    label: 'Per kilo',
    description: 'You set a price per kg. Customers get an estimate; final price is confirmed once you weigh the laundry.',
  },
  {
    value: 'per_load',
    label: 'Per load',
    description: 'You set a price per machine load. Customers get an estimate; final price is confirmed once you weigh the laundry.',
  },
  {
    value: 'per_piece',
    label: 'Per piece',
    description: 'You set a price per item/piece. Customers get an estimate; final price is confirmed once you count the pieces.',
  },
  {
    value: 'per_pair',
    label: 'Per pair',
    description: 'You set a price per pair (e.g. shoes). Customers get an estimate; final price is confirmed once you count the pairs.',
  },
  {
    value: 'per_item',
    label: 'Per item',
    description: 'You set a price per item. Customers get an estimate; final price is confirmed once you count the items.',
  },
  {
    value: 'fixed',
    label: 'Fixed price',
    description: 'One flat price regardless of quantity — the customer sees this exact price, no estimate.',
  },
];

/** Maps a pricing unit to the ShopServicePrice/ShopAddonPrice field it bills from. */
const RATE_FIELD_BY_MODE = {
  per_kg: 'basePricePerKg',
  per_load: 'basePricePerLoad',
  per_piece: 'basePricePerPiece',
  per_pair: 'basePricePerPair',
  per_item: 'basePricePerItem',
  fixed: 'fixedPrice',
} as const satisfies Partial<Record<PricingMode, keyof ShopServicePrice & keyof ShopAddonPrice>>;

/** Custom services aren't flat-bag priced (see resolveCustomServicePricing on the API side, which
 * defaults an unset unit to per-kilo) — exclude that option from the "add custom service" form. */
const NEW_SERVICE_UNIT_OPTIONS = PRICING_MODE_OPTIONS.filter((opt) => opt.value !== 'flat_bag');

/** Custom services use the legacy `pricePerKg` field name for their per-kg rate (see
 * create-branch-custom-service.dto.ts), unlike branch service/addon pricing's `basePricePerKg`. */
const CUSTOM_SERVICE_RATE_FIELD_BY_MODE = {
  ...RATE_FIELD_BY_MODE,
  per_kg: 'pricePerKg',
} as const;

const BOOKING_TYPE_LABELS: Record<string, string> = {
  [BookingType.WASH_FOLD]: 'Wash & Fold',
  [BookingType.WASH_DRY]: 'Wash & Dry',
  [BookingType.WASH_DRY_FOLD]: 'Wash, Dry & Fold',
  [BookingType.WASH_DRY_FOLD_IRON]: 'Wash, Dry, Fold & Iron',
  [BookingType.DRY_CLEANING]: 'Dry Cleaning',
  [BookingType.COMFORTERS]: 'Comforters',
  [BookingType.CURTAINS]: 'Curtains',
  [BookingType.SHOES]: 'Shoes',
  [BookingType.UNIFORMS]: 'Uniforms',
  [BookingType.IRONING]: 'Ironing / Press Only',
  [BookingType.RUGS]: 'Rugs & Carpets',
  [BookingType.UPHOLSTERY]: 'Upholstery',
  [BookingType.BAGS]: 'Bags',
  [BookingType.LEATHER]: 'Leather Care',
  [BookingType.ALTERATION]: 'Alteration & Repair',
  [BookingType.PREMIUM_WASH_FOLD]: 'Premium Wash & Fold',
  [BookingType.BABY_CLOTHES_WASH]: 'Baby Clothes Wash',
  [BookingType.DELICATES_WASH]: 'Delicates Wash',
  [BookingType.COLOR_SEPARATION_WASH]: 'Color Separation',
  [BookingType.WHITE_GARMENTS_WASH]: 'White Garments Only',
  [BookingType.HAND_WASH]: 'Hand Wash',
  [BookingType.MACHINE_WASH]: 'Machine Wash',
  [BookingType.ECO_FRIENDLY_WASH]: 'Eco-Friendly Wash',
  [BookingType.HYPOALLERGENIC_WASH]: 'Hypoallergenic Wash',
};

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

  // Keyed by rate field name (basePricePerKg, basePricePerLoad, basePricePerPiece, basePricePerPair,
  // basePricePerItem, fixedPrice) -> serviceType -> string value. flat_bag has no editable rate.
  const [serviceRates, setServiceRates] = useState<Record<string, Record<string, string>>>({});
  const [serviceUnits, setServiceUnits] = useState<Record<string, PricingMode>>({});
  const [addonPrices, setAddonPrices] = useState<Record<string, string>>({});
  const [addonRates, setAddonRates] = useState<Record<string, Record<string, string>>>({});
  const [addonUnits, setAddonUnits] = useState<Record<string, PricingMode>>({});
  const [hiddenServiceTypes, setHiddenServiceTypes] = useState<string[]>([]);
  const [hiddenAddonSlugs, setHiddenAddonSlugs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [newService, setNewService] = useState({
    baseBookingType: BookingType.WASH_FOLD as string,
    label: '',
    description: '',
    pricingUnit: 'per_kg' as PricingMode,
    rate: '',
  });
  const [addingService, setAddingService] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);

  const [newAddon, setNewAddon] = useState({ slug: '', label: '', description: '', price: '' });
  const [addingAddon, setAddingAddon] = useState(false);
  const [showAddonForm, setShowAddonForm] = useState(false);

  const [rowError, setRowError] = useState('');

  useEffect(() => {
    if (!pricing) return;
    const rateFields = Object.values(RATE_FIELD_BY_MODE);
    setServiceRates(
      Object.fromEntries(
        rateFields.map((field) => [
          field,
          Object.fromEntries(
            pricing.services.map((s) => [s.type, s[field] != null ? String(s[field]) : '']),
          ),
        ]),
      ),
    );
    setAddonPrices(
      Object.fromEntries(pricing.addons.map((a) => [a.slug, String(a.basePrice)])),
    );
    setAddonRates(
      Object.fromEntries(
        rateFields.map((field) => [
          field,
          Object.fromEntries(
            pricing.addons.map((a) => [a.slug, a[field] != null ? String(a[field]) : '']),
          ),
        ]),
      ),
    );
    setAddonUnits(
      Object.fromEntries(pricing.addons.map((a) => [a.slug, a.pricingUnit ?? 'flat_bag'])),
    );
    setHiddenServiceTypes(pricing.hiddenServiceTypes);
    setHiddenAddonSlugs(pricing.hiddenAddonSlugs);
    setServiceUnits(
      Object.fromEntries(pricing.services.map((s) => [s.type, s.pricingUnit ?? 'flat_bag'])),
    );
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
                };
              }),
          }),
        }),
        partnerFetch(`/partner/branches/${selectedBranchId}/hidden-catalog`, {
          method: 'PATCH',
          body: JSON.stringify({ hiddenServiceTypes, hiddenAddonSlugs }),
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

  function toggleHiddenService(type: string, hide: boolean) {
    setHiddenServiceTypes((prev) =>
      hide ? [...prev, type] : prev.filter((t) => t !== type),
    );
  }

  function toggleHiddenAddon(slug: string, hide: boolean) {
    setHiddenAddonSlugs((prev) =>
      hide ? [...prev, slug] : prev.filter((s) => s !== slug),
    );
  }

  async function createService() {
    setRowError('');
    setAddingService(true);
    try {
      const rateField =
        CUSTOM_SERVICE_RATE_FIELD_BY_MODE[
          newService.pricingUnit as keyof typeof CUSTOM_SERVICE_RATE_FIELD_BY_MODE
        ] ?? 'pricePerKg';
      await partnerFetch(`/partner/branches/${selectedBranchId}/custom-services`, {
        method: 'POST',
        body: JSON.stringify({
          baseBookingType: newService.baseBookingType,
          label: newService.label.trim(),
          description: newService.description.trim(),
          pricingUnit: newService.pricingUnit,
          [rateField]: Number(newService.rate),
        }),
      });
      setNewService({
        baseBookingType: BookingType.WASH_FOLD,
        label: '',
        description: '',
        pricingUnit: 'per_kg',
        rate: '',
      });
      setShowServiceForm(false);
      await reloadPricing();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Failed to create service');
    } finally {
      setAddingService(false);
    }
  }

  async function deleteService(customServiceId: string) {
    if (!window.confirm('Delete this custom service? This cannot be undone.')) return;
    setRowError('');
    try {
      await partnerFetch(`/partner/branches/${selectedBranchId}/custom-services/${customServiceId}`, {
        method: 'DELETE',
      });
      await reloadPricing();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Failed to delete service');
    }
  }

  async function createAddon() {
    setRowError('');
    setAddingAddon(true);
    try {
      await partnerFetch(`/partner/branches/${selectedBranchId}/custom-addons`, {
        method: 'POST',
        body: JSON.stringify({
          slug: newAddon.slug.trim().toLowerCase(),
          label: newAddon.label.trim(),
          description: newAddon.description.trim(),
          price: Number(newAddon.price),
        }),
      });
      setNewAddon({ slug: '', label: '', description: '', price: '' });
      setShowAddonForm(false);
      await reloadPricing();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Failed to create add-on');
    } finally {
      setAddingAddon(false);
    }
  }

  async function deleteAddon(customAddonId: string) {
    if (!window.confirm('Delete this custom add-on? This cannot be undone.')) return;
    setRowError('');
    try {
      await partnerFetch(`/partner/branches/${selectedBranchId}/custom-addons/${customAddonId}`, {
        method: 'DELETE',
      });
      await reloadPricing();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Failed to delete add-on');
    }
  }

  if (!ready) return <AuthLoading message="Loading services…" />;

  return (
    <div>
      <PageHeader
        title="Services & pricing"
        description="Set your own price per service and add-on, hide what you don't offer, or add your own custom items. Customers pay your price plus Lunara's markup."
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

      {rowError && <p className="mt-3 text-sm text-destructive">{rowError}</p>}

      {pricing && (
        <>
          <div className="section-panel mt-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Services</h2>
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => setShowServiceForm((v) => !v)}
              >
                {showServiceForm ? 'Cancel' : 'Add custom service'}
              </button>
            </div>

            <p className="border-b border-border bg-surface-subtle px-4 py-2 text-xs text-muted">
              Set the billing unit per service — mix per-kilo, per-load, per-piece, and flat-bag freely across your services.
            </p>

            {showServiceForm && (
              <div className="border-b border-border bg-surface-subtle p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="form-label">Anchor to existing service type</label>
                    <select
                      className="input-field"
                      value={newService.baseBookingType}
                      onChange={(e) =>
                        setNewService((s) => ({ ...s, baseBookingType: e.target.value }))
                      }
                    >
                      {Object.values(BookingType).map((t) => (
                        <option key={t} value={t}>
                          {BOOKING_TYPE_LABELS[t] ?? t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Your label</label>
                    <input
                      className="input-field"
                      value={newService.label}
                      onChange={(e) => setNewService((s) => ({ ...s, label: e.target.value }))}
                      placeholder="e.g. Express Comforter Wash"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label">Description</label>
                    <input
                      className="input-field"
                      value={newService.description}
                      onChange={(e) =>
                        setNewService((s) => ({ ...s, description: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="form-label">Billing unit</label>
                    <select
                      className="input-field"
                      value={newService.pricingUnit}
                      onChange={(e) =>
                        setNewService((s) => ({ ...s, pricingUnit: e.target.value as PricingMode }))
                      }
                    >
                      {NEW_SERVICE_UNIT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Your price</label>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      className="input-field"
                      value={newService.rate}
                      onChange={(e) => setNewService((s) => ({ ...s, rate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={addingService || !newService.label || !newService.rate}
                    onClick={() => void createService()}
                  >
                    {addingService ? 'Adding…' : 'Add service'}
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th>Your price</th>
                    <th>Customer pays</th>
                    <th>Offer</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.services.map((s) => {
                    const key = s.customServiceId ?? s.type;
                    if (s.isCustom) {
                      const customUnit = s.pricingUnit ?? 'per_kg';
                      const customRateField = RATE_FIELD_BY_MODE[customUnit as keyof typeof RATE_FIELD_BY_MODE];
                      const customRate = customRateField ? (s[customRateField] ?? 0) : s.basePricePerKg;
                      return (
                        <tr key={key}>
                          <td className="font-medium text-slate-900">
                            {s.label} <span className="badge-accent ml-1 text-xs">Custom</span>
                          </td>
                          <td className="text-muted">
                            <span className="badge-neutral text-xs">{serviceCategoryLabel(s.category)}</span>
                          </td>
                          <td className="text-muted">
                            {PRICING_MODE_OPTIONS.find((opt) => opt.value === customUnit)?.label ?? customUnit}
                          </td>
                          <td className="text-muted">{formatPeso(customRate)}</td>
                          <td className="text-muted">{formatPeso(s.customerPricePerKg)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn-outline btn-sm"
                              onClick={() => void deleteService(s.customServiceId!)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    }
                    const unit = serviceUnits[s.type] ?? 'flat_bag';
                    const rateField = unit === 'flat_bag' ? undefined : RATE_FIELD_BY_MODE[unit];
                    const base = rateField ? Number(serviceRates[rateField]?.[s.type] ?? 0) : 0;
                    const isHiddenLocal = hiddenServiceTypes.includes(s.type);
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
                        <td>
                          <label className="flex items-center gap-2 text-xs text-muted">
                            <input
                              type="checkbox"
                              checked={!isHiddenLocal}
                              onChange={(e) => toggleHiddenService(s.type, !e.target.checked)}
                            />
                            {isHiddenLocal ? 'Hidden' : 'Offered'}
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="section-panel mt-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Add-ons</h2>
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => setShowAddonForm((v) => !v)}
              >
                {showAddonForm ? 'Cancel' : 'Add custom add-on'}
              </button>
            </div>

            {showAddonForm && (
              <div className="border-b border-border bg-surface-subtle p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="form-label">Slug (lowercase, hyphens)</label>
                    <input
                      className="input-field"
                      value={newAddon.slug}
                      onChange={(e) => setNewAddon((a) => ({ ...a, slug: e.target.value }))}
                      placeholder="e.g. fabric-softener"
                    />
                  </div>
                  <div>
                    <label className="form-label">Label</label>
                    <input
                      className="input-field"
                      value={newAddon.label}
                      onChange={(e) => setNewAddon((a) => ({ ...a, label: e.target.value }))}
                      placeholder="e.g. Fabric Softener"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label">Description</label>
                    <input
                      className="input-field"
                      value={newAddon.description}
                      onChange={(e) => setNewAddon((a) => ({ ...a, description: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Your price</label>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      className="input-field"
                      value={newAddon.price}
                      onChange={(e) => setNewAddon((a) => ({ ...a, price: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={addingAddon || !newAddon.slug || !newAddon.label || !newAddon.price}
                    onClick={() => void createAddon()}
                  >
                    {addingAddon ? 'Adding…' : 'Add add-on'}
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Add-on</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th>Your price</th>
                    <th>Customer pays</th>
                    <th>Offer</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.addons.map((a) => {
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
                          <td>
                            <button
                              type="button"
                              className="btn-outline btn-sm"
                              onClick={() => void deleteAddon(a.customAddonId!)}
                            >
                              Delete
                            </button>
                          </td>
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
                          <td>
                            <label className="flex items-center gap-2 text-xs text-muted">
                              <input
                                type="checkbox"
                                checked={!hiddenAddonSlugs.includes(a.slug)}
                                onChange={(e) => toggleHiddenAddon(a.slug, !e.target.checked)}
                              />
                              {hiddenAddonSlugs.includes(a.slug) ? 'Hidden' : 'Offered'}
                            </label>
                          </td>
                        </tr>
                      );
                    }
                    const unit = addonUnits[a.slug] ?? 'flat_bag';
                    const rateField = unit === 'flat_bag' ? undefined : RATE_FIELD_BY_MODE[unit];
                    const base = rateField
                      ? Number(addonRates[rateField]?.[a.slug] ?? 0)
                      : Number(addonPrices[a.slug] ?? 0);
                    const isHiddenLocal = hiddenAddonSlugs.includes(a.slug);
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
                          <label className="flex items-center gap-2 text-xs text-muted">
                            <input
                              type="checkbox"
                              checked={!isHiddenLocal}
                              onChange={(e) => toggleHiddenAddon(a.slug, !e.target.checked)}
                            />
                            {isHiddenLocal ? 'Hidden' : 'Offered'}
                          </label>
                        </td>
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
