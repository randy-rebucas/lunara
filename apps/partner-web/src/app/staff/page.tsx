'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import type { PartnerStaffMember } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    return partnerFetch<PartnerStaffMember[]>('/partner/staff');
  }, []);

  const { data: staff, loading, error, reload } = usePartnerQuery(load, []);

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

    setSubmitting(true);
    try {
      await partnerFetch<PartnerStaffMember>('/partner/staff', {
        method: 'POST',
        body: JSON.stringify({
          email: trimmedEmail,
          phone: phone.trim() || undefined,
          password,
        }),
      });
      setFormSuccess(`Staff account created for ${trimmedEmail}. They can sign in on this portal.`);
      setEmail('');
      setPhone('');
      setPassword('');
      setConfirmPassword('');
      setShowForm(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create staff account');
    } finally {
      setSubmitting(false);
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

      <div className="section-panel mt-6 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Phone</th>
              <th>Member since</th>
              <th>Active jobs</th>
            </tr>
          </thead>
          <tbody>
            {(staff ?? []).map((s) => (
              <tr key={s._id}>
                <td className="font-medium text-slate-900">{s.email ?? s._id}</td>
                <td className="text-muted">{s.phone ?? '—'}</td>
                <td className="text-muted">{formatMemberSince(s.createdAt)}</td>
                <td>
                  <span className={s.activeJobs > 3 ? 'badge-warning' : 'badge-neutral'}>
                    {s.activeJobs}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !error && (staff ?? []).length === 0 && (
          <p className="p-6 text-sm text-muted">
            No staff yet. Use <strong>Add staff</strong> to create an account for your shop.
          </p>
        )}
      </div>
    </div>
  );
}
