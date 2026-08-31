'use client';

import { useEffect, useState } from 'react';
import { AuthLoading } from '../../components/auth-loading';
import { BranchAddressEditor } from '../../components/branch-address-editor';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { RightDrawer } from '../../components/ui/right-drawer';
import { useRequirePartner } from '../../hooks/use-protected-page';
import {
  createOwnBranch,
  listOwnBranches,
  updateOwnBranch,
  type PartnerBranch,
} from '../../lib/partner-api';

/** Manila-area default pin for a new branch, until the partner searches or drags it into place. */
const DEFAULT_LATITUDE = 14.5995;
const DEFAULT_LONGITUDE = 120.9842;

const EMPTY_FORM = {
  name: '',
  line1: '',
  city: '',
  province: '',
  latitude: DEFAULT_LATITUDE,
  longitude: DEFAULT_LONGITUDE,
};

export default function BranchesPage() {
  const { ready } = useRequirePartner();

  const [branches, setBranches] = useState<PartnerBranch[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rowError, setRowError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<PartnerBranch | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyBranchId, setBusyBranchId] = useState<string | null>(null);

  async function loadBranches() {
    setLoading(true);
    setError('');
    try {
      const data = await listOwnBranches();
      setBranches(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ready) void loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function openCreateForm() {
    setEditingBranch(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(branch: PartnerBranch) {
    setEditingBranch(branch);
    setForm({
      name: branch.name,
      line1: branch.line1,
      city: branch.city,
      province: branch.province,
      latitude: branch.latitude ?? DEFAULT_LATITUDE,
      longitude: branch.longitude ?? DEFAULT_LONGITUDE,
    });
    setShowForm(true);
  }

  async function saveBranch() {
    setRowError('');
    setSaving(true);
    try {
      const { latitude, longitude, ...rest } = form;
      const input = { ...rest, coordinates: [longitude, latitude] as [number, number] };
      if (editingBranch) {
        await updateOwnBranch(editingBranch._id, input);
      } else {
        await createOwnBranch(input);
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingBranch(null);
      await loadBranches();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(branch: PartnerBranch) {
    if (branch.isActive) {
      const confirmed = window.confirm(`Archive ${branch.name}? It will stop receiving new orders.`);
      if (!confirmed) return;
    }
    setRowError('');
    setBusyBranchId(branch._id);
    try {
      await updateOwnBranch(branch._id, { isActive: !branch.isActive });
      await loadBranches();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Failed to update branch');
    } finally {
      setBusyBranchId(null);
    }
  }

  if (!ready) return <AuthLoading message="Loading branches…" />;

  const formValid = form.name.trim() && form.line1.trim() && form.city.trim() && form.province.trim();

  return (
    <div>
      <PageHeader
        title="Branches"
        description="Manage every shop location under your account from one place."
        actions={
          <button type="button" className="btn-primary btn-sm" onClick={openCreateForm}>
            Add branch
          </button>
        }
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading branches…" onRetry={loadBranches} />
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

      {!loading && !error && (branches ?? []).length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">No branches yet. Add your first shop location above.</p>
        </div>
      )}

      {branches && branches.length > 0 && (
        <div className="section-panel mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Code</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b._id}>
                    <td className="font-medium text-slate-900">
                      {b.name}
                      {b.isMainShop && <span className="badge-accent ml-1 text-xs">Main shop</span>}
                    </td>
                    <td className="text-muted">{b.code}</td>
                    <td className="text-muted">
                      {b.line1}, {b.city}, {b.province}
                    </td>
                    <td>
                      <span className={b.isActive ? 'badge-neutral text-xs' : 'badge-accent text-xs'}>
                        {b.isActive ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button type="button" className="btn-outline btn-sm" onClick={() => openEditForm(b)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          disabled={busyBranchId === b._id}
                          onClick={() => void toggleActive(b)}
                        >
                          {b.isActive ? 'Archive' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RightDrawer
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingBranch ? 'Edit branch' : 'Add branch'}
      >
        <div className="grid gap-3">
          <div>
            <label className="form-label">Shop name</label>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Lunara Makati"
            />
          </div>

          <BranchAddressEditor
            value={form}
            onChange={(next) => setForm((f) => ({ ...f, ...next }))}
            resetKey={editingBranch?._id}
          />
        </div>
        <div className="mt-4">
          <button
            type="button"
            className="btn-primary btn-sm w-full"
            disabled={saving || !formValid}
            onClick={() => void saveBranch()}
          >
            {saving ? 'Saving…' : editingBranch ? 'Save changes' : 'Add branch'}
          </button>
        </div>
      </RightDrawer>
    </div>
  );
}
