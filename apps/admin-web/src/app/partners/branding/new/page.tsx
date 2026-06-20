'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '../../../../lib/admin-api';

interface PartnerBrandRecord {
  _id: string;
}

export default function NewPartnerBrandPage() {
  const router = useRouter();
  const [form, setForm] = useState({ ownerEmail: '', legalName: '', slug: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const partner = await adminFetch<PartnerBrandRecord>('/admin/partners', {
        method: 'POST',
        body: JSON.stringify({
          ownerEmail: form.ownerEmail.trim(),
          legalName: form.legalName.trim(),
          slug: form.slug.trim(),
        }),
      });
      router.push(`/partners/branding/${partner._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create partner brand');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/partners/branding" className="text-xs text-muted hover:text-primary">
          ← Branding
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">New partner brand</h1>
        <p className="mt-1 text-sm text-muted">
          Links a brand config to an existing partner account. The partner must already have a
          login (created via Shops → Create partner) before you can set up their white-label app.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="section-panel">
          <div className="p-6">
            <div className="dc-form-grid">
              <div className="sm:col-span-2">
                <label htmlFor="ownerEmail" className="form-label">Partner account email</label>
                <input
                  id="ownerEmail"
                  type="email"
                  className="input-field"
                  value={form.ownerEmail}
                  onChange={set('ownerEmail')}
                  required
                  placeholder="partner@example.com"
                />
                <p className="mt-1 text-xs text-muted">
                  Must match an existing user with the partner role.
                </p>
              </div>
              <div>
                <label htmlFor="legalName" className="form-label">Legal / display name</label>
                <input
                  id="legalName"
                  className="input-field"
                  value={form.legalName}
                  onChange={set('legalName')}
                  required
                  placeholder="e.g. Partner Laundry Co."
                />
              </div>
              <div>
                <label htmlFor="slug" className="form-label">Slug</label>
                <input
                  id="slug"
                  className="input-field"
                  value={form.slug}
                  onChange={set('slug')}
                  required
                  placeholder="e.g. partner-laundry"
                />
              </div>
            </div>
          </div>
        </div>

        {error ? <div className="alert-error mt-4" role="alert">{error}</div> : null}

        <div className="mt-6 flex items-center justify-between">
          <Link href="/partners/branding" className="btn-outline btn-sm">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create brand'}
          </button>
        </div>
      </form>
    </div>
  );
}
