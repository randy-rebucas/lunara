'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import type { PartnerBranchRider, PartnerStaffMember } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { StaffProfileModal } from '../../components/staff-profile-modal';
import { PageHeader } from '../../components/ui/page-header';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { listAssignedRiders, partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

interface BranchOption {
  _id: string;
  code: string;
  name: string;
  branchType: string;
  city: string;
}

function formatMemberSince(createdAt?: string) {
  if (!createdAt) return '—';
  return new Date(createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function StaffTeamPage() {
  const { ready } = useRequirePartner();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingStaff, setEditingStaff] = useState<PartnerStaffMember | null>(null);
  const [branchId, setBranchId] = useState('');
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [reassignError, setReassignError] = useState('');
  const [activeTab, setActiveTab] = useState<'staff' | 'riders'>('staff');

  const load = useCallback(async () => {
    return partnerFetch<PartnerStaffMember[]>('/partner/staff');
  }, []);

  const { data: staff, loading, error, reload } = usePartnerQuery(load, []);

  const loadBranches = useCallback(async () => {
    return partnerFetch<BranchOption[]>('/partner/branches');
  }, []);

  const { data: branches } = usePartnerQuery(loadBranches, []);
  const hasMultipleBranches = (branches?.length ?? 0) > 1;

  const loadRiders = useCallback(async () => {
    return listAssignedRiders();
  }, []);

  const {
    data: branchRiders,
    loading: ridersLoading,
    error: ridersError,
  } = usePartnerQuery(loadRiders, []);

  const stats = useMemo(() => {
    const members = staff ?? [];
    const activeJobs = members.reduce((sum, s) => sum + s.activeJobs, 0);
    const busy = members.filter((s) => s.activeJobs > 3).length;
    return { count: members.length, activeJobs, busy };
  }, [staff]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFormError('Email is required.');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }
    if (hasMultipleBranches && !branchId) {
      setFormError('Choose which branch this staff member belongs to.');
      return;
    }

    setSubmitting(true);
    try {
      await partnerFetch<PartnerStaffMember>('/partner/staff', {
        method: 'POST',
        body: JSON.stringify({
          email: trimmedEmail,
          phone: phone.trim() || undefined,
          displayName: displayName.trim() || undefined,
          password,
          branchId: branchId || undefined,
        }),
      });
      setFormSuccess(`Staff account created for ${trimmedEmail}. They can sign in on this portal.`);
      setEmail('');
      setPhone('');
      setDisplayName('');
      setPassword('');
      setBranchId('');
      setConfirmPassword('');
      setShowForm(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create staff account');
    } finally {
      setSubmitting(false);
    }
  }

  async function reassignBranch(staffId: string, targetBranchId: string) {
    setReassignError('');
    setReassigningId(staffId);
    try {
      await partnerFetch(`/partner/staff/${staffId}/branch`, {
        method: 'PATCH',
        body: JSON.stringify({ branchId: targetBranchId }),
      });
      await reload();
    } catch (err) {
      setReassignError(err instanceof Error ? err.message : 'Could not reassign branch');
    } finally {
      setReassigningId(null);
    }
  }

  if (!ready) return <AuthLoading message="Loading staff…" />;

  return (
    <div>
      <PageHeader
        title="Staff team"
        description="Add staff for your shop branch. Assign them to orders from incoming or the processing queue."
        actions={
          <>
            <button
              type="button"
              className={showForm ? 'btn-secondary' : 'btn-primary'}
              onClick={() => {
                setShowForm((v) => !v);
                setFormError('');
                setFormSuccess('');
              }}
            >
              {showForm ? 'Cancel' : 'Add staff'}
            </button>
            <Link href="/orders/incoming" className="btn-outline">
              Incoming orders →
            </Link>
          </>
        }
      />

      <div className="mt-6 flex gap-2 border-b border-border">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'staff'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('staff')}
        >
          Staff
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'riders'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('riders')}
        >
          Riders
        </button>
      </div>

      {activeTab === 'staff' && (
      <>
      {formSuccess && <div className="alert-success mt-4">{formSuccess}</div>}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="section-panel mt-6 space-y-4 p-6"
          autoComplete="off"
        >
          <h2 className="text-lg font-semibold text-slate-900">New staff account</h2>
          <p className="text-sm text-muted">
            Staff log in with email and password. They only see orders for your shop branch.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="staff-email" className="text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="staff-email"
                type="email"
                required
                autoComplete="off"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="staff@yourshop.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="staff-phone" className="text-sm font-medium text-slate-700">
                Phone <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="staff-phone"
                type="tel"
                autoComplete="off"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="+63917…"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="staff-name" className="text-sm font-medium text-slate-700">
              Display name <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="staff-name"
              type="text"
              autoComplete="off"
              maxLength={80}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="e.g. Juan Dela Cruz"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {hasMultipleBranches && (
            <div>
              <label htmlFor="staff-branch" className="text-sm font-medium text-slate-700">
                Branch
              </label>
              <select
                id="staff-branch"
                required
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="">Select a branch…</option>
                {(branches ?? []).map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="staff-password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="staff-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="staff-confirm" className="text-sm font-medium text-slate-700">
                Confirm password
              </label>
              <input
                id="staff-confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? 'Creating…' : 'Create staff account'}
          </button>
        </form>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-xs text-muted">Team members</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.count}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted">Active jobs (all staff)</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.activeJobs}</p>
        </div>
        <div className="stat-card-warning">
          <p className="text-xs text-muted">High workload (&gt;3 jobs)</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.busy}</p>
        </div>
      </div>

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading staff…" />
      </div>

      {reassignError && <div className="alert-error mt-2">{reassignError}</div>}

      <div className="section-panel mt-6 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Role</th>
              {hasMultipleBranches && <th>Branch</th>}
              <th>Phone</th>
              <th>Member since</th>
              <th>Active jobs</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(staff ?? []).map((s) => (
              <tr key={s._id}>
                <td className="font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {s.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.avatarUrl} alt={s.displayName ?? s.email} className="h-full w-full object-cover" />
                      ) : (
                        (s.displayName ?? s.email ?? '?')[0]?.toUpperCase()
                      )}
                    </div>
                    <span>{s.displayName ?? s.email ?? s._id}</span>
                  </div>
                </td>
                <td>
                  <span className="badge-neutral capitalize">{s.role ?? 'staff'}</span>
                </td>
                {hasMultipleBranches && (
                  <td>
                    <select
                      className="rounded-lg border px-2 py-1 text-xs"
                      value={s.branchId ?? ''}
                      disabled={reassigningId === s._id}
                      onChange={(e) => e.target.value && reassignBranch(s._id, e.target.value)}
                    >
                      {!s.branchId && <option value="">Unassigned</option>}
                      {(branches ?? []).map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                <td className="text-muted">{s.phone ?? '—'}</td>
                <td className="text-muted">{formatMemberSince(s.createdAt)}</td>
                <td>
                  <span className={s.activeJobs > 3 ? 'badge-warning' : 'badge-neutral'}>
                    {s.activeJobs}
                  </span>
                </td>
                <td>
                  <button type="button" className="btn-outline btn-sm" onClick={() => setEditingStaff(s)}>
                    Edit profile
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {!loading && !error && (staff ?? []).length === 0 && (
          <p className="p-6 text-sm text-muted">
            No staff yet. Use <strong>Add staff</strong> to create an account for your shop.
          </p>
        )}
      </div>
      </>
      )}

      {activeTab === 'riders' && (
        <div className="mt-6">
          <p className="text-sm text-muted">
            Riders are onboarded and assigned by Lunara admin. This shows who&apos;s currently assigned to
            your shop(s) for pickup and delivery.
          </p>

          <div className="mt-4">
            <DataPageStatus loading={ridersLoading} error={ridersError} loadingMessage="Loading riders…" />
          </div>

          <div className="section-panel mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Rider</th>
                    <th>Contact</th>
                    <th>Vehicle</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(branchRiders ?? []).map((br: PartnerBranchRider) => (
                    <tr key={br.branchId}>
                      <td className="font-medium text-slate-900">
                        {br.branchName} ({br.branchCode})
                      </td>
                      <td>
                        {br.rider ? (
                          [br.rider.firstName, br.rider.lastName].filter(Boolean).join(' ') ||
                          br.rider.email ||
                          br.rider._id
                        ) : (
                          <span className="text-muted">Unassigned</span>
                        )}
                      </td>
                      <td className="text-muted">
                        {br.rider ? [br.rider.email, br.rider.phone].filter(Boolean).join(' · ') || '—' : '—'}
                      </td>
                      <td className="text-muted">
                        {br.rider
                          ? [br.rider.vehicleType, br.rider.plateNumber].filter(Boolean).join(' · ') || '—'
                          : '—'}
                      </td>
                      <td>
                        {br.rider ? (
                          <span className={br.rider.isOnline ? 'badge-success' : 'badge-neutral'}>
                            {br.rider.isOnline ? (br.rider.shiftStatus ?? 'Online') : 'Offline'}
                          </span>
                        ) : (
                          <span className="badge-neutral">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!ridersLoading && !ridersError && (branchRiders ?? []).length === 0 && (
              <p className="p-6 text-sm text-muted">No branches to show riders for.</p>
            )}
          </div>
        </div>
      )}

      {editingStaff && (
        <StaffProfileModal
          staff={editingStaff}
          onClose={() => setEditingStaff(null)}
          onSaved={() => reload()}
        />
      )}
    </div>
  );
}
