'use client';

import { useCallback, useRef, useState } from 'react';
import { adminFetch, adminUpload } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';
import { PageHeader } from '../ui/page-header';
import { Card, CardBody } from '../ui/card';

interface Banner {
  _id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  sortOrder: number;
}

function formatValidity(b: Banner) {
  if (!b.startsAt && !b.endsAt) return 'No expiry';
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${b.startsAt ? fmt(b.startsAt) : 'Now'} – ${b.endsAt ? fmt(b.endsAt) : 'Open'}`;
}

export function BannersBoard() {
  const load = useCallback(() => adminFetch<Banner[]>('/admin/banners'), []);
  const { data, loading, error, reload } = useAdminQuery(load, []);
  const banners = data ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const [replacingForId, setReplacingForId] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!imageFile) {
      setActionError('Choose an image to upload');
      return;
    }
    setSaving(true);
    setActionError('');
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('title', title.trim());
      if (linkUrl.trim()) formData.append('linkUrl', linkUrl.trim());
      if (startsAt) formData.append('startsAt', new Date(startsAt).toISOString());
      if (endsAt) formData.append('endsAt', new Date(endsAt).toISOString());

      await adminUpload('/admin/banners', formData);
      setTitle('');
      setLinkUrl('');
      setStartsAt('');
      setEndsAt('');
      setImageFile(null);
      setShowCreate(false);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create banner');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(b: Banner) {
    setActioningId(b._id);
    try {
      await adminFetch(`/admin/banners/${b._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !b.isActive }),
      });
      await reload();
    } finally {
      setActioningId(null);
    }
  }

  function startReplaceImage(bannerId: string) {
    setReplacingForId(bannerId);
    replaceImageInputRef.current?.click();
  }

  async function handleReplaceImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !replacingForId) return;
    setActioningId(replacingForId);
    try {
      const formData = new FormData();
      formData.append('image', file);
      await adminUpload(`/admin/banners/${replacingForId}/image`, formData);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update image');
    } finally {
      setActioningId(null);
      setReplacingForId(null);
    }
  }

  async function remove(b: Banner) {
    if (!window.confirm(`Delete banner "${b.title}"?`)) return;
    setActioningId(b._id);
    try {
      await adminFetch(`/admin/banners/${b._id}`, { method: 'DELETE' });
      await reload();
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div>
      <input
        ref={replaceImageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleReplaceImageSelected}
      />

      <PageHeader
        title="Banners"
        description="Active banners shown in the customer apps, in the order below."
        actions={
          <button type="button" className="btn-primary btn-sm" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? 'Cancel' : 'New banner'}
          </button>
        }
      />

      {showCreate && (
        <Card className="mb-6">
          <CardBody>
            <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Title
                <input
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  minLength={3}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-1 w-full text-sm"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  required
                />
                <span className="mt-1 block text-xs text-muted">
                  Upload a real image file — external hotlinked URLs (e.g. Facebook/Instagram CDN
                  links) usually get blocked by the browser and won&apos;t render.
                </span>
              </label>
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Link URL (optional)
                <input
                  type="url"
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Starts (optional)
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Ends (optional)
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </label>
              {actionError && <p className="text-sm text-red-600 sm:col-span-2">{actionError}</p>}
              <div className="sm:col-span-2">
                <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                  {saving ? 'Uploading…' : 'Create banner'}
                </button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && banners.length === 0 && (
        <Card>
          <CardBody className="text-center text-sm text-muted">No banners yet.</CardBody>
        </Card>
      )}

      <div className="list-stack">
        {banners.map((b) => (
          <Card key={b._id}>
            <CardBody className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.imageUrl}
                alt={b.title}
                className="h-16 w-28 shrink-0 rounded-lg object-cover ring-1 ring-border"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{b.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatValidity(b)}</p>
                {b.linkUrl && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{b.linkUrl}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  b.isActive ? 'bg-accent/15 text-accent-dark' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {b.isActive ? 'Active' : 'Inactive'}
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={actioningId === b._id}
                  onClick={() => startReplaceImage(b._id)}
                >
                  {actioningId === b._id ? 'Working…' : 'Replace image'}
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={actioningId === b._id}
                  onClick={() => toggleActive(b)}
                >
                  {b.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={actioningId === b._id}
                  onClick={() => remove(b)}
                >
                  Delete
                </button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
