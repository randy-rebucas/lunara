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

type PricingMode = 'flat_bag' | 'per_kg' | 'per_load' | 'per_piece';

interface ShopServicePrice {
  type: string;
  label: string;
  basePricePerKg: number;
  basePricePerLoad?: number;
  basePricePerPiece?: number;
  pricingUnit?: PricingMode;
  customerPricePerKg: number;
  isCustom?: boolean;
  customServiceId?: string;
}

interface ShopAddonPrice {
  slug: string;
  label: string;
  basePrice: number;
  basePricePerKg?: number;
  basePricePerLoad?: number;
  basePricePerPiece?: number;
  pricingUnit?: PricingMode;
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
];

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
};

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
  const [serviceLoadPrices, setServiceLoadPrices] = useState<Record<string, string>>({});
  const [servicePiecePrices, setServicePiecePrices] = useState<Record<string, string>>({});
  const [serviceUnits, setServiceUnits] = useState<Record<string, PricingMode>>({});
  const [addonPrices, setAddonPrices] = useState<Record<string, string>>({});
  const [addonKgPrices, setAddonKgPrices] = useState<Record<string, string>>({});
  const [addonLoadPrices, setAddonLoadPrices] = useState<Record<string, string>>({});
  const [addonPiecePrices, setAddonPiecePrices] = useState<Record<string, string>>({});
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
    pricePerKg: '',
  });
  const [addingService, setAddingService] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);

  const [newAddon, setNewAddon] = useState({ slug: '', label: '', description: '', price: '' });
  const [addingAddon, setAddingAddon] = useState(false);
  const [showAddonForm, setShowAddonForm] = useState(false);

  const [rowError, setRowError] = useState('');

  useEffect(() => {
    if (!pricing) return;
    setServicePrices(
      Object.fromEntries(pricing.services.map((s) => [s.type, String(s.basePricePerKg ?? '')])),
    );
    setServiceLoadPrices(
      Object.fromEntries(
        pricing.services.map((s) => [s.type, s.basePricePerLoad != null ? String(s.basePricePerLoad) : '']),
      ),
    );
    setServicePiecePrices(
      Object.fromEntries(
        pricing.services.map((s) => [s.type, s.basePricePerPiece != null ? String(s.basePricePerPiece) : '']),
      ),
    );
    setAddonPrices(
      Object.fromEntries(pricing.addons.map((a) => [a.slug, String(a.basePrice)])),
    );
    setAddonKgPrices(
      Object.fromEntries(
        pricing.addons.map((a) => [a.slug, a.basePricePerKg != null ? String(a.basePricePerKg) : '']),
      ),
    );
    setAddonLoadPrices(
      Object.fromEntries(
        pricing.addons.map((a) => [a.slug, a.basePricePerLoad != null ? String(a.basePricePerLoad) : '']),
      ),
    );
    setAddonPiecePrices(
      Object.fromEntries(
        pricing.addons.map((a) => [a.slug, a.basePricePerPiece != null ? String(a.basePricePerPiece) : '']),
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
                const perKg = servicePrices[s.type];
                const perLoad = serviceLoadPrices[s.type];
                const perPiece = servicePiecePrices[s.type];
                return {
                  serviceType: s.type,
                  basePricePerKg: perKg !== '' && perKg != null ? Number(perKg) : undefined,
                  basePricePerLoad: perLoad !== '' && perLoad != null ? Number(perLoad) : undefined,
                  basePricePerPiece: perPiece !== '' && perPiece != null ? Number(perPiece) : undefined,
                  pricingUnit: serviceUnits[s.type] ?? 'flat_bag',
                };
              }),
          }),
        }),
        partnerFetch(`/partner/branches/${selectedBranchId}/addon-pricing`, {
          method: 'PATCH',
          body: JSON.stringify({
            addonPricing: pricing.addons
              .filter((a) => !a.isCustom)
              .map((a) => {
                const perKg = addonKgPrices[a.slug];
                const perLoad = addonLoadPrices[a.slug];
                const perPiece = addonPiecePrices[a.slug];
                return {
                  addonSlug: a.slug,
                  basePrice: Number(addonPrices[a.slug] ?? a.basePrice),
                  basePricePerKg: perKg !== '' && perKg != null ? Number(perKg) : undefined,
                  basePricePerLoad: perLoad !== '' && perLoad != null ? Number(perLoad) : undefined,
                  basePricePerPiece: perPiece !== '' && perPiece != null ? Number(perPiece) : undefined,
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
      await partnerFetch(`/partner/branches/${selectedBranchId}/custom-services`, {
        method: 'POST',
        body: JSON.stringify({
          baseBookingType: newService.baseBookingType,
          label: newService.label.trim(),
          description: newService.description.trim(),
          pricePerKg: Number(newService.pricePerKg),
        }),
      });
      setNewService({ baseBookingType: BookingType.WASH_FOLD, label: '', description: '', pricePerKg: '' });
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
                    <label className="form-label">Your price / kg</label>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      className="input-field"
                      value={newService.pricePerKg}
                      onChange={(e) =>
                        setNewService((s) => ({ ...s, pricePerKg: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={addingService || !newService.label || !newService.pricePerKg}
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
                      return (
                        <tr key={key}>
                          <td className="font-medium text-slate-900">
                            {s.label} <span className="badge-accent ml-1 text-xs">Custom</span>
                          </td>
                          <td className="text-muted">Per kilo</td>
                          <td className="text-muted">{formatPeso(s.basePricePerKg)}</td>
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
                    const base =
                      unit === 'per_load'
                        ? Number(serviceLoadPrices[s.type] ?? 0)
                        : unit === 'per_piece'
                          ? Number(servicePiecePrices[s.type] ?? 0)
                          : Number(servicePrices[s.type] ?? 0);
                    const isHiddenLocal = hiddenServiceTypes.includes(s.type);
                    return (
                      <tr key={key}>
                        <td className="font-medium text-slate-900">{s.label}</td>
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
                          {unit === 'flat_bag' ? (
                            <span className="text-xs text-muted">
                              Platform-wide flat pricing — not partner-configurable
                            </span>
                          ) : unit === 'per_load' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted">₱</span>
                              <input
                                type="number"
                                min={0}
                                step="0.5"
                                className="input-field w-28"
                                value={serviceLoadPrices[s.type] ?? ''}
                                onChange={(e) =>
                                  setServiceLoadPrices((p) => ({ ...p, [s.type]: e.target.value }))
                                }
                              />
                            </div>
                          ) : unit === 'per_piece' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted">₱</span>
                              <input
                                type="number"
                                min={0}
                                step="0.5"
                                className="input-field w-28"
                                value={servicePiecePrices[s.type] ?? ''}
                                onChange={(e) =>
                                  setServicePiecePrices((p) => ({ ...p, [s.type]: e.target.value }))
                                }
                              />
                            </div>
                          ) : (
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
                          )}
                        </td>
                        <td className="text-muted">
                          {unit === 'flat_bag' ? '—' : formatPeso(base * MARKUP_MULTIPLIER)}
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
                    const unit = addonUnits[a.slug] ?? 'flat_bag';
                    const base =
                      unit === 'per_kg'
                        ? Number(addonKgPrices[a.slug] ?? 0)
                        : unit === 'per_load'
                          ? Number(addonLoadPrices[a.slug] ?? 0)
                          : unit === 'per_piece'
                            ? Number(addonPiecePrices[a.slug] ?? 0)
                            : Number(addonPrices[a.slug] ?? 0);
                    const isHiddenLocal = hiddenAddonSlugs.includes(a.slug);
                    return (
                      <tr key={key}>
                        <td className="font-medium text-slate-900">{a.label}</td>
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
                              value={
                                unit === 'per_kg'
                                  ? (addonKgPrices[a.slug] ?? '')
                                  : unit === 'per_load'
                                    ? (addonLoadPrices[a.slug] ?? '')
                                    : unit === 'per_piece'
                                      ? (addonPiecePrices[a.slug] ?? '')
                                      : (addonPrices[a.slug] ?? '')
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                if (unit === 'per_kg') setAddonKgPrices((p) => ({ ...p, [a.slug]: value }));
                                else if (unit === 'per_load')
                                  setAddonLoadPrices((p) => ({ ...p, [a.slug]: value }));
                                else if (unit === 'per_piece')
                                  setAddonPiecePrices((p) => ({ ...p, [a.slug]: value }));
                                else setAddonPrices((p) => ({ ...p, [a.slug]: value }));
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
