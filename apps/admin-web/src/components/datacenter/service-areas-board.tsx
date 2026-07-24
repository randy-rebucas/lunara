'use client';

import { useCallback, useMemo, useState } from 'react';
import { BookingType } from '@lunara/types';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';

const BOOKING_TYPES = Object.values(BookingType);

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

interface ServiceAreaRow {
  _id: string;
  label: string;
  cities: string[];
  provinces: string[];
  postalPrefixes: string[];
  services: string[];
  isActive: boolean;
  sortOrder: number;
}

interface ServiceAreaFormState {
  label: string;
  cities: string;
  provinces: string;
  postalPrefixes: string;
  services: string[];
  isActive: boolean;
  sortOrder: string;
}

const EMPTY_FORM: ServiceAreaFormState = {
  label: '',
  cities: '',
  provinces: '',
  postalPrefixes: '',
  services: [],
  isActive: true,
  sortOrder: '0',
};

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function areaToForm(area: ServiceAreaRow): ServiceAreaFormState {
  return {
    label: area.label,
    cities: area.cities.join(', '),
    provinces: area.provinces.join(', '),
    postalPrefixes: area.postalPrefixes.join(', '),
    services: area.services,
    isActive: area.isActive,
    sortOrder: String(area.sortOrder),
  };
}

function formToPayload(form: ServiceAreaFormState) {
  return {
    label: form.label.trim(),
    cities: splitCsv(form.cities),
    provinces: splitCsv(form.provinces),
    postalPrefixes: splitCsv(form.postalPrefixes),
    services: form.services,
    isActive: form.isActive,
    sortOrder: Number(form.sortOrder) || 0,
  };
}

function ServiceCheckboxes({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {BOOKING_TYPES.map((type) => {
        const checked = selected.includes(type);
        return (
          <label key={type} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) =>
                onChange(
                  e.target.checked ? [...selected, type] : selected.filter((t) => t !== type),
                )
              }
            />
            {BOOKING_TYPE_LABELS[type] ?? type}
          </label>
        );
      })}
    </div>
  );
}

export function ServiceAreasBoard() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceAreaFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState<ServiceAreaFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(() => adminFetch<ServiceAreaRow[]>('/admin/service-areas'), []);
  const { data: items, loading, error, reload } = useAdminQuery(load, []);
  const areas = useMemo(() => items ?? [], [items]);

  function openEdit(area: ServiceAreaRow) {
    setEditingId(area._id);
    setForm(areaToForm(area));
    setActionError('');
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setActionError('');
    try {
      await adminFetch(`/admin/service-areas/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(formToPayload(form)),
      });
      setEditingId(null);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update service area');
    } finally {
      setSaving(false);
    }
  }

  async function createArea(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setActionError('');
    try {
      await adminFetch('/admin/service-areas', {
        method: 'POST',
        body: JSON.stringify(formToPayload(newForm)),
      });
      setNewForm(EMPTY_FORM);
      setCreating(false);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create service area');
    } finally {
      setSaving(false);
    }
  }

  async function deleteArea(area: ServiceAreaRow) {
    if (!window.confirm(`Delete "${area.label}"? Addresses in this area will stop matching immediately.`)) {
      return;
    }
    setActionError('');
    try {
      await adminFetch(`/admin/service-areas/${area._id}`, { method: 'DELETE' });
      if (editingId === area._id) setEditingId(null);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete service area');
    }
  }

  async function toggleActive(area: ServiceAreaRow) {
    setActionError('');
    try {
      await adminFetch(`/admin/service-areas/${area._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !area.isActive }),
      });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update service area');
    }
  }

  return (
    <div>
      <header className="mb-5">
        <p className="dc-eyebrow">Network</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Service areas
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
          Coverage areas and which booking types customers can select in each. An address is
          matched by city, province, or postal code prefix — the first active area that matches
          wins. Leaving a service list empty allows every booking type in that area.
        </p>
      </header>

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}
      {actionError ? (
        <div className="alert-error mb-4" role="alert">
          {actionError}
        </div>
      ) : null}

      {loading && !items ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            aria-hidden
          />
          Loading service areas…
        </div>
      ) : null}

      {items ? (
        <div className="space-y-3">
          <section className="dc-panel">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Coverage areas</h2>
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => setCreating((v) => !v)}
              >
                {creating ? 'Cancel' : 'Add area'}
              </button>
            </div>

            {areas.length === 0 ? (
              <div className="dc-panel-empty">
                <p className="font-medium text-slate-900">No service areas yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[1100px]">
                  <thead>
                    <tr>
                      <th scope="col">Priority</th>
                      <th scope="col">Label</th>
                      <th scope="col">Cities</th>
                      <th scope="col">Provinces</th>
                      <th scope="col">Postal prefixes</th>
                      <th scope="col">Allowed services</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {areas.map((area) => (
                      <tr key={area._id} className={!area.isActive ? 'opacity-75' : ''}>
                        <td className="text-xs text-muted">{area.sortOrder}</td>
                        <td className="font-medium text-slate-900">{area.label}</td>
                        <td className="max-w-[12rem] truncate text-xs text-muted" title={area.cities.join(', ')}>
                          {area.cities.join(', ') || '—'}
                        </td>
                        <td className="max-w-[10rem] truncate text-xs text-muted" title={area.provinces.join(', ')}>
                          {area.provinces.join(', ') || '—'}
                        </td>
                        <td className="max-w-[8rem] truncate text-xs text-muted" title={area.postalPrefixes.join(', ')}>
                          {area.postalPrefixes.join(', ') || '—'}
                        </td>
                        <td className="max-w-[14rem] text-xs text-muted">
                          {area.services.length === 0
                            ? 'All services'
                            : area.services.map((s) => BOOKING_TYPE_LABELS[s] ?? s).join(', ')}
                        </td>
                        <td>
                          <span className={area.isActive ? 'badge-accent' : 'badge-neutral'}>
                            {area.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="space-x-3 whitespace-nowrap">
                          <button
                            type="button"
                            className="link-primary text-xs font-medium"
                            onClick={() => openEdit(area)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="link-primary text-xs font-medium"
                            onClick={() => void toggleActive(area)}
                          >
                            {area.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            className="link-primary text-xs font-medium text-destructive"
                            onClick={() => void deleteArea(area)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {creating ? (
            <section className="dc-panel">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">New service area</h2>
              </div>
              <form onSubmit={createArea} className="dc-panel-body">
                <ServiceAreaFields form={newForm} setForm={setNewForm} idPrefix="new" />
                <div className="dc-form-actions mt-4">
                  <button type="submit" disabled={saving} className="btn-primary btn-sm">
                    {saving ? 'Creating…' : 'Create area'}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {editingId ? (
            <section className="dc-panel" id="service-area-edit">
              <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Edit service area</h2>
                <button
                  type="button"
                  className="link-primary text-xs font-medium"
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </button>
              </div>
              <form onSubmit={saveEdit} className="dc-panel-body">
                <ServiceAreaFields form={form} setForm={setForm} idPrefix="edit" />
                <div className="dc-form-actions mt-4">
                  <button type="submit" disabled={saving} className="btn-primary btn-sm">
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ServiceAreaFields({
  form,
  setForm,
  idPrefix,
}: {
  form: ServiceAreaFormState;
  setForm: (updater: (f: ServiceAreaFormState) => ServiceAreaFormState) => void;
  idPrefix: string;
}) {
  return (
    <div className="dc-form-grid">
      <div>
        <label htmlFor={`${idPrefix}-label`} className="form-label">
          Label
        </label>
        <input
          id={`${idPrefix}-label`}
          className="input-field"
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          required
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-sort`} className="form-label">
          Sort order
        </label>
        <input
          id={`${idPrefix}-sort`}
          className="input-field"
          type="number"
          value={form.sortOrder}
          onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-cities`} className="form-label">
          Cities <span className="font-normal text-muted">(comma-separated)</span>
        </label>
        <input
          id={`${idPrefix}-cities`}
          className="input-field"
          value={form.cities}
          onChange={(e) => setForm((f) => ({ ...f, cities: e.target.value }))}
          placeholder="Manila, Makati, Quezon City"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-provinces`} className="form-label">
          Provinces <span className="font-normal text-muted">(comma-separated)</span>
        </label>
        <input
          id={`${idPrefix}-provinces`}
          className="input-field"
          value={form.provinces}
          onChange={(e) => setForm((f) => ({ ...f, provinces: e.target.value }))}
          placeholder="Metro Manila, NCR"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-postal`} className="form-label">
          Postal prefixes <span className="font-normal text-muted">(comma-separated)</span>
        </label>
        <input
          id={`${idPrefix}-postal`}
          className="input-field"
          value={form.postalPrefixes}
          onChange={(e) => setForm((f) => ({ ...f, postalPrefixes: e.target.value }))}
          placeholder="10, 11, 12"
        />
      </div>
      <div className="sm:col-span-2">
        <span className="form-label">Allowed services</span>
        <p className="mb-2 text-xs text-muted">Leave all unchecked to allow every booking type.</p>
        <ServiceCheckboxes
          selected={form.services}
          onChange={(services) => setForm((f) => ({ ...f, services }))}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          Active
        </label>
      </div>
    </div>
  );
}
