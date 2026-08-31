'use client';

import { Fragment, useState } from 'react';
import { BookingType } from '@lunara/types';
import { GARMENT_CATALOG, getGarmentCategories } from '@lunara/utils';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { RightDrawer } from '../../components/ui/right-drawer';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { partnerFetch } from '../../lib/partner-api';
import type { PricingMode, ShopAddonPrice } from '../../lib/use-shop-pricing';
import { useShopPricing } from '../../lib/use-shop-pricing';

const PRICING_MODE_OPTIONS: { value: PricingMode; label: string }[] = [
  { value: 'per_kg', label: 'Per kilo' },
  { value: 'per_load', label: 'Per load' },
  { value: 'per_piece', label: 'Per piece' },
  { value: 'per_pair', label: 'Per pair' },
  { value: 'per_item', label: 'Per item' },
  { value: 'fixed', label: 'Fixed price' },
];

/** Custom services use the legacy `pricePerKg` field name for their per-kg rate (see
 * create-branch-custom-service.dto.ts), unlike branch service/addon pricing's `basePricePerKg`. */
const CUSTOM_SERVICE_RATE_FIELD_BY_MODE: Partial<Record<PricingMode, string>> = {
  per_kg: 'pricePerKg',
  per_load: 'basePricePerLoad',
  per_piece: 'basePricePerPiece',
  per_pair: 'basePricePerPair',
  per_item: 'basePricePerItem',
  fixed: 'fixedPrice',
};

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

type CatalogTab = 'services' | 'addons' | 'garments';

export default function ServicesPage() {
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

  const [hiddenBusy, setHiddenBusy] = useState(false);
  const [rowError, setRowError] = useState('');
  const [activeTab, setActiveTab] = useState<CatalogTab>('services');
  const [expandedAddonsFor, setExpandedAddonsFor] = useState<string | null>(null);
  const [collapsedGarmentCategories, setCollapsedGarmentCategories] = useState<Set<string>>(new Set());

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

  async function toggleHiddenService(type: string, hide: boolean) {
    if (!selectedBranchId || !pricing) return;
    const next = hide
      ? [...pricing.hiddenServiceTypes, type]
      : pricing.hiddenServiceTypes.filter((t) => t !== type);
    setHiddenBusy(true);
    setRowError('');
    try {
      await partnerFetch(`/partner/branches/${selectedBranchId}/hidden-catalog`, {
        method: 'PATCH',
        body: JSON.stringify({ hiddenServiceTypes: next }),
      });
      await reloadPricing();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Failed to update service');
    } finally {
      setHiddenBusy(false);
    }
  }

  async function toggleHiddenAddon(slug: string, hide: boolean) {
    if (!selectedBranchId || !pricing) return;
    const next = hide
      ? [...pricing.hiddenAddonSlugs, slug]
      : pricing.hiddenAddonSlugs.filter((s) => s !== slug);
    setHiddenBusy(true);
    setRowError('');
    try {
      await partnerFetch(`/partner/branches/${selectedBranchId}/hidden-catalog`, {
        method: 'PATCH',
        body: JSON.stringify({ hiddenAddonSlugs: next }),
      });
      await reloadPricing();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Failed to update add-on');
    } finally {
      setHiddenBusy(false);
    }
  }

  async function toggleHiddenGarment(garmentId: string, hide: boolean) {
    if (!selectedBranchId || !pricing) return;
    const next = hide
      ? [...pricing.hiddenGarmentItemIds, garmentId]
      : pricing.hiddenGarmentItemIds.filter((id) => id !== garmentId);
    setHiddenBusy(true);
    setRowError('');
    try {
      await partnerFetch(`/partner/branches/${selectedBranchId}/hidden-catalog`, {
        method: 'PATCH',
        body: JSON.stringify({ hiddenGarmentItemIds: next }),
      });
      await reloadPricing();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Failed to update garment');
    } finally {
      setHiddenBusy(false);
    }
  }

  async function toggleGarmentCategory(garmentIds: string[], offerAll: boolean) {
    if (!selectedBranchId || !pricing) return;
    const next = offerAll
      ? pricing.hiddenGarmentItemIds.filter((id) => !garmentIds.includes(id))
      : [...new Set([...pricing.hiddenGarmentItemIds, ...garmentIds])];
    setHiddenBusy(true);
    setRowError('');
    try {
      await partnerFetch(`/partner/branches/${selectedBranchId}/hidden-catalog`, {
        method: 'PATCH',
        body: JSON.stringify({ hiddenGarmentItemIds: next }),
      });
      await reloadPricing();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Failed to update garments');
    } finally {
      setHiddenBusy(false);
    }
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
      const field = CUSTOM_SERVICE_RATE_FIELD_BY_MODE[newService.pricingUnit] ?? 'pricePerKg';
      await partnerFetch(`/partner/branches/${selectedBranchId}/custom-services`, {
        method: 'POST',
        body: JSON.stringify({
          baseBookingType: newService.baseBookingType,
          label: newService.label.trim(),
          description: newService.description.trim(),
          pricingUnit: newService.pricingUnit,
          [field]: Number(newService.rate),
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

  async function toggleAddonForService(addon: ShopAddonPrice, serviceType: string, offer: boolean) {
    setRowError('');
    const current = addon.applicableServiceTypes ?? [];
    const next = offer ? [...current, serviceType] : current.filter((t) => t !== serviceType);
    try {
      if (addon.customAddonId) {
        await partnerFetch(`/partner/branches/${selectedBranchId}/custom-addons/${addon.customAddonId}`, {
          method: 'PATCH',
          body: JSON.stringify({ applicableServiceTypes: next }),
        });
      } else {
        await partnerFetch(`/partner/branches/${selectedBranchId}/addon-pricing`, {
          method: 'PATCH',
          body: JSON.stringify({
            addonPricing: [
              {
                addonSlug: addon.slug,
                basePrice: addon.basePrice,
                basePricePerKg: addon.basePricePerKg,
                basePricePerLoad: addon.basePricePerLoad,
                basePricePerPiece: addon.basePricePerPiece,
                basePricePerPair: addon.basePricePerPair,
                basePricePerItem: addon.basePricePerItem,
                fixedPrice: addon.fixedPrice,
                pricingUnit: addon.pricingUnit ?? 'flat_bag',
                applicableServiceTypes: next,
                includedQuantity: addon.includedQuantity ?? 0,
              },
            ],
          }),
        });
      }
      await reloadPricing();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Failed to update add-on');
    }
  }

  async function updateAddonIncludedQty(addon: ShopAddonPrice, includedQuantity: number) {
    if (!addon.customAddonId) {
      setRowError('');
      try {
        await partnerFetch(`/partner/branches/${selectedBranchId}/addon-pricing`, {
          method: 'PATCH',
          body: JSON.stringify({
            addonPricing: [
              {
                addonSlug: addon.slug,
                basePrice: addon.basePrice,
                basePricePerKg: addon.basePricePerKg,
                basePricePerLoad: addon.basePricePerLoad,
                basePricePerPiece: addon.basePricePerPiece,
                basePricePerPair: addon.basePricePerPair,
                basePricePerItem: addon.basePricePerItem,
                fixedPrice: addon.fixedPrice,
                pricingUnit: addon.pricingUnit ?? 'flat_bag',
                applicableServiceTypes: addon.applicableServiceTypes ?? [],
                includedQuantity,
              },
            ],
          }),
        });
        await reloadPricing();
      } catch (e) {
        setRowError(e instanceof Error ? e.message : 'Failed to update add-on');
      }
    }
  }

  if (!ready) return <AuthLoading message="Loading services…" />;

  return (
    <div>
      <PageHeader
        title="Services"
        description="Choose which services, add-ons, and garments you offer. Set prices for them on the Pricing page."
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
          loadingMessage="Loading services…"
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
                ...(!pricing.hiddenServiceTypes.includes(BookingType.DRY_CLEANING)
                  ? [{ id: 'garments' as const, label: 'Dry cleaning garments' }]
                  : []),
              ] satisfies { id: CatalogTab; label: string }[]
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

          {activeTab === 'services' && (
            <div className="section-panel mt-4 overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Services</h2>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => setShowServiceForm(true)}
                >
                  Add custom service
                </button>
              </div>

              <RightDrawer
                open={showServiceForm}
                onClose={() => setShowServiceForm(false)}
                title="Add custom service"
              >
                <div className="grid gap-3">
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
                  <div>
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
                      {PRICING_MODE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Starting price</label>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      className="input-field"
                      value={newService.rate}
                      onChange={(e) => setNewService((s) => ({ ...s, rate: e.target.value }))}
                    />
                    <p className="mt-1 text-xs text-muted">You can fine-tune this later on the Pricing page.</p>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    className="btn-primary btn-sm w-full"
                    disabled={addingService || !newService.label || !newService.rate}
                    onClick={() => void createService()}
                  >
                    {addingService ? 'Adding…' : 'Add service'}
                  </button>
                </div>
              </RightDrawer>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Category</th>
                      <th>Add-ons</th>
                      <th>Offer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricing.services.map((s) => {
                      const key = s.customServiceId ?? s.type;
                      const offerableAddons = pricing.addons.filter((a) => !a.isPercentOfService);
                      const isHiddenLocal = pricing.hiddenServiceTypes.includes(s.type);
                      return (
                        <Fragment key={key}>
                          <tr>
                            <td className="font-medium text-slate-900">
                              {s.label}
                              {s.isCustom && <span className="badge-accent ml-1 text-xs">Custom</span>}
                            </td>
                            <td className="text-muted">
                              <span className="badge-neutral text-xs">{serviceCategoryLabel(s.category)}</span>
                            </td>
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
                            <td>
                              {s.isCustom ? (
                                <button
                                  type="button"
                                  className="btn-outline btn-sm"
                                  onClick={() => void deleteService(s.customServiceId!)}
                                >
                                  Delete
                                </button>
                              ) : (
                                <label className="flex items-center gap-2 text-xs text-muted">
                                  <input
                                    type="checkbox"
                                    disabled={hiddenBusy}
                                    checked={!isHiddenLocal}
                                    onChange={(e) => void toggleHiddenService(s.type, !e.target.checked)}
                                  />
                                  {isHiddenLocal ? 'Hidden' : 'Offered'}
                                </label>
                              )}
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
                  <p className="mt-1 text-xs text-muted">Changes save instantly.</p>
                  <div className="mt-4 flex flex-col gap-2">
                    {offerableAddons.map((a) => {
                      const key2 = a.customAddonId ?? a.slug;
                      const offered = !!a.applicableServiceTypes?.includes(modalService.type);
                      const showIncludedQty =
                        !a.isCustom &&
                        offered &&
                        ['flat_bag', 'fixed', 'per_piece', 'per_pair', 'per_item'].includes(
                          a.pricingUnit ?? 'flat_bag',
                        );
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
                                void toggleAddonForService(a, modalService.type, e.target.checked)
                              }
                            />
                            {a.label}
                          </label>
                          {showIncludedQty && (
                            <label className="flex items-center gap-1.5 text-xs text-muted">
                              Included qty
                              <input
                                type="number"
                                min={0}
                                max={a.maxQuantity ?? 5}
                                step={1}
                                className="input-field w-16"
                                defaultValue={a.includedQuantity ?? 0}
                                onBlur={(e) => void updateAddonIncludedQty(a, Number(e.target.value) || 0)}
                                title="How many units of this add-on come free with the service — customers are only charged beyond this."
                              />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setExpandedAddonsFor(null)}
                    >
                      Done
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
                  onClick={() => setShowAddonForm(true)}
                >
                  Add custom add-on
                </button>
              </div>

              <RightDrawer
                open={showAddonForm}
                onClose={() => setShowAddonForm(false)}
                title="Add custom add-on"
              >
                <div className="grid gap-3">
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
                  <div>
                    <label className="form-label">Description</label>
                    <input
                      className="input-field"
                      value={newAddon.description}
                      onChange={(e) => setNewAddon((a) => ({ ...a, description: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Starting price</label>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      className="input-field"
                      value={newAddon.price}
                      onChange={(e) => setNewAddon((a) => ({ ...a, price: e.target.value }))}
                    />
                    <p className="mt-1 text-xs text-muted">You can fine-tune this later on the Pricing page.</p>
                  </div>
                  <div>
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
                  <div className="flex items-center gap-3">
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
                <div className="mt-4">
                  <button
                    type="button"
                    className="btn-primary btn-sm w-full"
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
              </RightDrawer>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Add-on</th>
                      <th>Category</th>
                      <th>Offer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricing.addons.map((a) => {
                      const key = a.customAddonId ?? a.slug;
                      const isHiddenLocal = pricing.hiddenAddonSlugs.includes(a.slug);
                      return (
                        <tr key={key}>
                          <td className="font-medium text-slate-900">
                            {a.label}
                            {a.isCustom && <span className="badge-accent ml-1 text-xs">Custom</span>}
                            {a.isPercentOfService && (
                              <span className="mt-1 block text-xs font-normal text-muted">
                                Percent-of-service add-on, not partner-configurable pricing.
                              </span>
                            )}
                          </td>
                          <td className="text-muted">
                            <span className="badge-neutral text-xs">{addonCategoryLabel(a.category)}</span>
                          </td>
                          <td>
                            {a.isCustom ? (
                              <button
                                type="button"
                                className="btn-outline btn-sm"
                                onClick={() => void deleteAddon(a.customAddonId!)}
                              >
                                Delete
                              </button>
                            ) : (
                              <label className="flex items-center gap-2 text-xs text-muted">
                                <input
                                  type="checkbox"
                                  disabled={hiddenBusy}
                                  checked={!isHiddenLocal}
                                  onChange={(e) => void toggleHiddenAddon(a.slug, !e.target.checked)}
                                />
                                {isHiddenLocal ? 'Hidden' : 'Offered'}
                              </label>
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
                  Choose which garment types you actually dry clean. Customers booking Dry Cleaning at
                  your shop will only be able to select garments you offer here. Set prices for them on
                  the Pricing page.
                </p>
              </div>

              <div className="divide-y divide-border">
                {getGarmentCategories(pricing.garmentCatalog ?? GARMENT_CATALOG).map((category) => {
                  const garments = (pricing.garmentCatalog ?? GARMENT_CATALOG).filter(
                    (g) => g.category === category,
                  );
                  const garmentIds = garments.map((g) => g.id);
                  const offeredCount = garmentIds.filter(
                    (id) => !pricing.hiddenGarmentItemIds.includes(id),
                  ).length;
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
                            disabled={hiddenBusy}
                            onClick={() => void toggleGarmentCategory(garmentIds, true)}
                          >
                            Offer all
                          </button>
                          <button
                            type="button"
                            className="btn-outline btn-sm"
                            disabled={hiddenBusy}
                            onClick={() => void toggleGarmentCategory(garmentIds, false)}
                          >
                            Hide all
                          </button>
                        </div>
                      </div>
                      {!collapsed && (
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {garments.map((g) => {
                            const isHiddenLocal = pricing.hiddenGarmentItemIds.includes(g.id);
                            return (
                              <label
                                key={g.id}
                                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted"
                              >
                                <input
                                  type="checkbox"
                                  disabled={hiddenBusy}
                                  checked={!isHiddenLocal}
                                  onChange={(e) => void toggleHiddenGarment(g.id, !e.target.checked)}
                                />
                                <span className="flex-1 text-slate-900">{g.label}</span>
                              </label>
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
        </>
      )}
    </div>
  );
}
