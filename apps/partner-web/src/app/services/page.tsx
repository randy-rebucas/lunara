'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { BookingType } from '@lunara/types';
import { GARMENT_CATALOG, getGarmentCategories, SHOP_PRICE_MARKUP_MULTIPLIER } from '@lunara/utils';
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
  applicableServiceTypes?: string[];
  allowsQuantity?: boolean;
  maxQuantity?: number;
  /** Units of this add-on bundled free into the service — only quantity beyond this is billed. */
  includedQuantity?: number;
}

interface ShopGarmentItem {
  id: string;
  category: string;
  label: string;
  price: number;
}

interface ShopPricing {
  pricingMode: PricingMode;
  kgPerLoad: number;
  services: ShopServicePrice[];
  addons: ShopAddonPrice[];
  garmentCatalog: ShopGarmentItem[];
  hiddenServiceTypes: string[];
  hiddenAddonSlugs: string[];
  hiddenGarmentItemIds: string[];
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

type PricingTab = 'services' | 'addons' | 'garments' | 'machine';

export default function ServicesPage() {
  const { ready } = useRequirePartner();

  const loadBranches = useCallback(async () => {
    return partnerFetch<BranchOption[]>('/partner/branches');
  }, []);
  const {
    data: branches,
    loading: branchesLoading,
    error: branchesError,
    reload: reloadBranches,
  } = usePartnerQuery(loadBranches, []);

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
  const [kgPerLoad, setKgPerLoad] = useState('8');
  const [addonPrices, setAddonPrices] = useState<Record<string, string>>({});
  const [addonRates, setAddonRates] = useState<Record<string, Record<string, string>>>({});
  const [addonUnits, setAddonUnits] = useState<Record<string, PricingMode>>({});
  const [addonServiceTypes, setAddonServiceTypes] = useState<Record<string, string[]>>({});
  const [addonIncludedQty, setAddonIncludedQty] = useState<Record<string, string>>({});
  const [hiddenServiceTypes, setHiddenServiceTypes] = useState<string[]>([]);
  const [hiddenAddonSlugs, setHiddenAddonSlugs] = useState<string[]>([]);
  const [hiddenGarmentItemIds, setHiddenGarmentItemIds] = useState<string[]>([]);
  const [garmentPrices, setGarmentPrices] = useState<Record<string, string>>({});
  const [collapsedGarmentCategories, setCollapsedGarmentCategories] = useState<Set<string>>(new Set());
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

  const [newAddon, setNewAddon] = useState({
    slug: '',
    label: '',
    description: '',
    price: '',
    applicableServiceTypes: [] as string[],
    allowsQuantity: false,
    maxQuantity: '5',
  });
  const [addingAddon, setAddingAddon] = useState(false);
  const [showAddonForm, setShowAddonForm] = useState(false);

  const [rowError, setRowError] = useState('');
  const [expandedAddonsFor, setExpandedAddonsFor] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PricingTab>('services');

  useEffect(() => {
    if (activeTab === 'garments' && hiddenServiceTypes.includes(BookingType.DRY_CLEANING)) {
      setActiveTab('services');
    }
  }, [activeTab, hiddenServiceTypes]);

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
    setAddonServiceTypes(
      Object.fromEntries(pricing.addons.map((a) => [a.slug, a.applicableServiceTypes ?? []])),
    );
    setAddonIncludedQty(
      Object.fromEntries(pricing.addons.map((a) => [a.slug, String(a.includedQuantity ?? 0)])),
    );
    setKgPerLoad(String(pricing.kgPerLoad));
    setHiddenServiceTypes(pricing.hiddenServiceTypes);
    setHiddenAddonSlugs(pricing.hiddenAddonSlugs);
    const catalog = pricing.garmentCatalog ?? GARMENT_CATALOG;
    setHiddenGarmentItemIds(pricing.hiddenGarmentItemIds);
    setCollapsedGarmentCategories(new Set(getGarmentCategories(catalog)));
    setGarmentPrices(Object.fromEntries(catalog.map((g) => [g.id, String(g.price)])));
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
                  applicableServiceTypes: addonServiceTypes[a.slug] ?? [],
                  includedQuantity: Number(addonIncludedQty[a.slug] ?? 0),
                };
              }),
          }),
        }),
        partnerFetch(`/partner/branches/${selectedBranchId}/hidden-catalog`, {
          method: 'PATCH',
          body: JSON.stringify({
            hiddenServiceTypes,
            hiddenAddonSlugs,
            hiddenGarmentItemIds,
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

  function toggleHiddenGarment(garmentId: string, hide: boolean) {
    setHiddenGarmentItemIds((prev) =>
      hide ? [...prev, garmentId] : prev.filter((id) => id !== garmentId),
    );
  }

  function setGarmentPrice(garmentId: string, value: string) {
    setGarmentPrices((prev) => ({ ...prev, [garmentId]: value }));
  }

  function toggleGarmentCategory(garmentIds: string[], offerAll: boolean) {
    setHiddenGarmentItemIds((prev) =>
      offerAll
        ? prev.filter((id) => !garmentIds.includes(id))
        : [...new Set([...prev, ...garmentIds])],
    );
  }

  function toggleCollapsedGarmentCategory(category: string) {
    setCollapsedGarmentCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
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
          applicableServiceTypes: newAddon.applicableServiceTypes,
          allowsQuantity: newAddon.allowsQuantity,
          maxQuantity: newAddon.allowsQuantity ? Number(newAddon.maxQuantity) || 5 : undefined,
        }),
      });
      setNewAddon({
        slug: '',
        label: '',
        description: '',
        price: '',
        applicableServiceTypes: [],
        allowsQuantity: false,
        maxQuantity: '5',
      });
      setShowAddonForm(false);
      await reloadPricing();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Failed to create add-on');
    } finally {
      setAddingAddon(false);
    }
  }

  async function toggleAddonForService(addon: ShopAddonPrice, serviceType: string, offer: boolean) {
    if (!addon.customAddonId) return;
    const current = addon.applicableServiceTypes ?? [];
    const next = offer ? [...current, serviceType] : current.filter((t) => t !== serviceType);
    setRowError('');
    try {
      await partnerFetch(`/partner/branches/${selectedBranchId}/custom-addons/${addon.customAddonId}`, {
        method: 'PATCH',
        body: JSON.stringify({ applicableServiceTypes: next }),
      });
      await reloadPricing();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Failed to update add-on');
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

      {rowError && (
        <div className="alert-error mt-3 flex flex-wrap items-center justify-between gap-3">
          <span>{rowError}</span>
          <button
            type="button"
            onClick={() => setRowError('')}
            className="shrink-0 text-sm font-medium underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {pricing && (
        <>
          <div className="mt-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-slate-50 p-1">
            {(
              [
                { id: 'services', label: 'Services' },
                { id: 'addons', label: 'Add-ons' },
                ...(!hiddenServiceTypes.includes(BookingType.DRY_CLEANING)
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
                    <th>Add-ons</th>
                    <th>Offer</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.services.map((s) => {
                    const key = s.customServiceId ?? s.type;
                    const offerableAddons = pricing.addons.filter((a) => !a.isPercentOfService);
                    const addonsCell = (
                      <td>
                        {offerableAddons.length > 0 ? (
                          <button
                            type="button"
                            className="btn-outline btn-sm"
                            onClick={() => setExpandedAddonsFor(key)}
                          >
                            Add-ons
                          </button>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    );
                    if (s.isCustom) {
                      const customUnit = s.pricingUnit ?? 'per_kg';
                      const customRateField = RATE_FIELD_BY_MODE[customUnit as keyof typeof RATE_FIELD_BY_MODE];
                      const customRate = customRateField ? (s[customRateField] ?? 0) : s.basePricePerKg;
                      return (
                        <Fragment key={key}>
                          <tr>
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
                            {addonsCell}
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
                        </Fragment>
                      );
                    }
                    const unit = serviceUnits[s.type] ?? 'flat_bag';
                    const rateField = unit === 'flat_bag' ? undefined : RATE_FIELD_BY_MODE[unit];
                    const base = rateField ? Number(serviceRates[rateField]?.[s.type] ?? 0) : 0;
                    const isHiddenLocal = hiddenServiceTypes.includes(s.type);
                    return (
                      <Fragment key={key}>
                        <tr>
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
                        {addonsCell}
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
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {expandedAddonsFor && (() => {
            const modalService = pricing.services.find(
              (s) => (s.customServiceId ?? s.type) === expandedAddonsFor,
            );
            const offerableAddons = pricing.addons.filter((a) => !a.isPercentOfService);
            if (!modalService) return null;
            return (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                onClick={() => setExpandedAddonsFor(null)}
              >
                <div
                  className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold text-slate-900">
                    Add-ons for {modalService.label}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    Custom add-ons save instantly. Standard add-ons need &quot;Save pricing&quot; below.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    {offerableAddons.map((a) => {
                      const key2 = a.customAddonId ?? a.slug;
                      const offered = a.isCustom
                        ? !!a.applicableServiceTypes?.includes(modalService.type)
                        : !!addonServiceTypes[a.slug]?.includes(modalService.type);
                      return (
                        <div
                          key={key2}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                        >
                          <label className="flex items-center gap-2 text-sm text-slate-900">
                            <input
                              type="checkbox"
                              checked={offered}
                              onChange={(e) =>
                                a.isCustom
                                  ? void toggleAddonForService(a, modalService.type, e.target.checked)
                                  : setAddonServiceTypes((prev) => {
                                      const current = prev[a.slug] ?? [];
                                      const next = e.target.checked
                                        ? [...current, modalService.type]
                                        : current.filter((t) => t !== modalService.type);
                                      return { ...prev, [a.slug]: next };
                                    })
                              }
                            />
                            {a.label}
                            {!a.isCustom && <span className="text-muted">*</span>}
                          </label>
                          {!a.isCustom &&
                          offered &&
                          ['flat_bag', 'fixed', 'per_piece', 'per_pair', 'per_item'].includes(
                            addonUnits[a.slug] ?? a.pricingUnit ?? 'flat_bag',
                          ) ? (
                            <label className="flex items-center gap-1.5 text-xs text-muted">
                              Included qty
                              <input
                                type="number"
                                min={0}
                                max={a.allowsQuantity ? (a.maxQuantity ?? 5) : 1}
                                step={1}
                                className="input-field w-16"
                                value={addonIncludedQty[a.slug] ?? '0'}
                                onChange={(e) =>
                                  setAddonIncludedQty((p) => ({ ...p, [a.slug]: e.target.value }))
                                }
                                title="How many units of this add-on come free with the service — customers are only charged beyond this."
                              />
                            </label>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {saveError && <p className="mt-3 text-sm text-destructive">{saveError}</p>}
                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={saving}
                      onClick={() =>
                        void save().then(() => setExpandedAddonsFor(null))
                      }
                    >
                      {saving ? 'Saving…' : 'Done'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === 'addons' && (
          <div className="section-panel mt-4 overflow-hidden">
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
                  <div className="sm:col-span-2">
                    <label className="form-label">
                      Only offer with{' '}
                      <span className="font-normal text-muted">(pick at least one service)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[...new Map(pricing.services.map((s) => [s.type, s])).values()].map((s) => {
                        const type = s.type;
                        const checked = newAddon.applicableServiceTypes.includes(type);
                        return (
                          <label
                            key={type}
                            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setNewAddon((a) => ({
                                  ...a,
                                  applicableServiceTypes: e.target.checked
                                    ? [...a.applicableServiceTypes, type]
                                    : a.applicableServiceTypes.filter((t) => t !== type),
                                }))
                              }
                            />
                            {BOOKING_TYPE_LABELS[type] ?? s.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={newAddon.allowsQuantity}
                        onChange={(e) =>
                          setNewAddon((a) => ({ ...a, allowsQuantity: e.target.checked }))
                        }
                      />
                      Let customers pick a quantity
                    </label>
                    {newAddon.allowsQuantity && (
                      <label className="flex items-center gap-1.5 text-xs text-muted">
                        Max
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className="input-field w-16"
                          value={newAddon.maxQuantity}
                          onChange={(e) =>
                            setNewAddon((a) => ({ ...a, maxQuantity: e.target.value }))
                          }
                        />
                      </label>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={
                      addingAddon ||
                      !newAddon.slug ||
                      !newAddon.label ||
                      !newAddon.price ||
                      newAddon.applicableServiceTypes.length === 0
                    }
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
                    <th>Included in package</th>
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
                            {!!a.applicableServiceTypes?.length && (
                              <span className="mt-1 block text-xs font-normal text-muted">
                                Only with:{' '}
                                {a.applicableServiceTypes
                                  .map((t) => BOOKING_TYPE_LABELS[t] ?? t)
                                  .join(', ')}
                              </span>
                            )}
                          </td>
                          <td className="text-muted">
                            <span className="badge-neutral text-xs">{addonCategoryLabel(a.category)}</span>
                          </td>
                          <td className="text-muted">Flat</td>
                          <td className="text-muted">{formatPeso(a.basePrice)}</td>
                          <td className="text-muted">{formatPeso(a.customerPrice)}</td>
                          <td className="text-muted">—</td>
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
                          <td className="text-muted">—</td>
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
          )}

          {activeTab === 'garments' && !hiddenServiceTypes.includes(BookingType.DRY_CLEANING) && (
            <div className="section-panel mt-4 overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Dry cleaning garments</h2>
                <p className="mt-1 text-xs text-muted">
                  Choose which garment types you actually dry clean. Customers booking Dry Cleaning at
                  your shop will only be able to select garments you offer here.
                </p>
              </div>

              <div className="divide-y divide-border">
                {getGarmentCategories(pricing.garmentCatalog ?? GARMENT_CATALOG).map((category) => {
                  const garments = (pricing.garmentCatalog ?? GARMENT_CATALOG).filter(
                    (g) => g.category === category,
                  );
                  const garmentIds = garments.map((g) => g.id);
                  const offeredCount = garmentIds.filter((id) => !hiddenGarmentItemIds.includes(id)).length;
                  const collapsed = collapsedGarmentCategories.has(category);
                  return (
                    <div key={category} className="p-4">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          className="text-sm font-medium text-slate-900"
                          onClick={() => toggleCollapsedGarmentCategory(category)}
                        >
                          {collapsed ? '▸' : '▾'} {category}{' '}
                          <span className="text-xs font-normal text-muted">
                            ({offeredCount}/{garmentIds.length} offered)
                          </span>
                        </button>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-outline btn-sm"
                            onClick={() => toggleGarmentCategory(garmentIds, true)}
                          >
                            Offer all
                          </button>
                          <button
                            type="button"
                            className="btn-outline btn-sm"
                            onClick={() => toggleGarmentCategory(garmentIds, false)}
                          >
                            Hide all
                          </button>
                        </div>
                      </div>
                      {!collapsed && (
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {garments.map((g) => {
                            const isHiddenLocal = hiddenGarmentItemIds.includes(g.id);
                            return (
                              <div
                                key={g.id}
                                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted"
                              >
                                <label className="flex flex-1 items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={!isHiddenLocal}
                                    onChange={(e) => toggleHiddenGarment(g.id, !e.target.checked)}
                                  />
                                  <span className="flex-1 text-slate-900">{g.label}</span>
                                </label>
                                <span>₱</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  disabled={isHiddenLocal}
                                  className="input-field w-20 py-1 text-xs disabled:opacity-50"
                                  value={garmentPrices[g.id] ?? String(g.price)}
                                  onChange={(e) => setGarmentPrice(g.id, e.target.value)}
                                />
                              </div>
                            );
                          })}
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
