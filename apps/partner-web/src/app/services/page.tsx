'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookingType } from '@lunara/types';
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
  isCustom?: boolean;
  customServiceId?: string;
}

interface ShopAddonPrice {
  slug: string;
  label: string;
  basePrice: number;
  customerPrice: number;
  isCustom?: boolean;
  customAddonId?: string;
}

interface ShopPricing {
  services: ShopServicePrice[];
  addons: ShopAddonPrice[];
  hiddenServiceTypes: string[];
  hiddenAddonSlugs: string[];
}

const MARKUP_MULTIPLIER = 1.3;

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
  const [addonPrices, setAddonPrices] = useState<Record<string, string>>({});
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
      Object.fromEntries(pricing.services.map((s) => [s.type, String(s.basePricePerKg)])),
    );
    setAddonPrices(
      Object.fromEntries(pricing.addons.map((a) => [a.slug, String(a.basePrice)])),
    );
    setHiddenServiceTypes(pricing.hiddenServiceTypes);
    setHiddenAddonSlugs(pricing.hiddenAddonSlugs);
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
              .map((s) => ({
                serviceType: s.type,
                basePricePerKg: Number(servicePrices[s.type] ?? s.basePricePerKg),
              })),
          }),
        }),
        partnerFetch(`/partner/branches/${selectedBranchId}/addon-pricing`, {
          method: 'PATCH',
          body: JSON.stringify({
            addonPricing: pricing.addons
              .filter((a) => !a.isCustom)
              .map((a) => ({
                addonSlug: a.slug,
                basePrice: Number(addonPrices[a.slug] ?? a.basePrice),
              })),
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
                    <th>Your price / kg</th>
                    <th>Customer pays / kg</th>
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
                    const base = Number(servicePrices[s.type] ?? 0);
                    const isHiddenLocal = hiddenServiceTypes.includes(s.type);
                    return (
                      <tr key={key}>
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
                    const base = Number(addonPrices[a.slug] ?? 0);
                    const isHiddenLocal = hiddenAddonSlugs.includes(a.slug);
                    return (
                      <tr key={key}>
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
