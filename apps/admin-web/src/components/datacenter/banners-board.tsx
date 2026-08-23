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

type SortKey = 'order' | 'title' | 'status' | 'startsAt';

function sortBanners(banners: Banner[], sortKey: SortKey): Banner[] {
  const sorted = [...banners];
  switch (sortKey) {
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'status':
      sorted.sort((a, b) => Number(b.isActive) - Number(a.isActive));
      break;
    case 'startsAt':
      sorted.sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
      break;
    case 'order':
    default:
      sorted.sort((a, b) => a.sortOrder - b.sortOrder);
      break;
  }
  return sorted;
}

export function BannersBoard() {
  const load = useCallback(() => adminFetch<Banner[]>('/admin/banners'), []);
  const { data, loading, error, reload } = useAdminQuery(load, []);
  const [sortKey, setSortKey] = useState<SortKey>('order');
  const banners = sortBanners(data ?? [], sortKey);

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
      // New banners default to sortOrder 0 on the backend if omitted, which would
      // place them at the top of the manual order (mixed in with any other banner
      // still sitting at 0) instead of at the end. Append it explicitly.
      const nextSortOrder = (data ?? []).reduce((max, b) => Math.max(max, b.sortOrder), -1) + 1;
      formData.append('sortOrder', String(nextSortOrder));

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
    setActionError('');
    try {
      await adminFetch(`/admin/banners/${b._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !b.isActive }),
      });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update banner');
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

  async function move(b: Banner, direction: -1 | 1) {
    const ordered = sortBanners(data ?? [], 'order');
    const index = ordered.findIndex((x) => x._id === b._id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    const [moved] = ordered.splice(index, 1);
    ordered.splice(targetIndex, 0, moved);

    // Banners can share the same sortOrder (e.g. all default to 0), so a plain
    // swap of two equal values is a no-op. Re-normalize the whole list to
    // sequential positions instead so every move produces a visible change.
    setActioningId(b._id);
    setActionError('');
    try {
      const patches = ordered
        .map((item, i) => ({ item, i }))
        .filter((pair) => pair.item.sortOrder !== pair.i);
      await Promise.all(
        patches.map((pair) =>
          adminFetch(`/admin/banners/${pair.item._id}`, {
            method: 'PATCH',
            body: JSON.stringify({ sortOrder: pair.i }),
          }),
        ),
      );
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reorder banners');
    } finally {
      setActioningId(null);
    }
  }

  async function remove(b: Banner) {
    if (!window.confirm(`Delete banner "${b.title}"?`)) return;
    setActioningId(b._id);
    setActionError('');
    try {
      await adminFetch(`/admin/banners/${b._id}`, { method: 'DELETE' });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete banner');
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
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              Sort by
              <select
                className="rounded-lg border border-border px-2 py-1.5 text-sm"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="order">Manual order</option>
                <option value="title">Title</option>
                <option value="status">Status</option>
                <option value="startsAt">Start date</option>
              </select>
            </label>
            <button type="button" className="btn-primary btn-sm" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? 'Cancel' : 'New banner'}
            </button>
          </div>
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

      {actionError && !showCreate && (
        <div className="alert-error mb-4" role="alert">
          {actionError}
        </div>
      )}

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && banners.length === 0 && (
        <Card>
          <CardBody className="text-center text-sm text-muted">No banners yet.</CardBody>
        </Card>
      )}

      <div className="flex flex-col gap-4">
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
                {sortKey === 'order' && (
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      aria-label="Move up"
                      className="btn-outline btn-sm px-2 py-0.5 leading-none disabled:opacity-30"
                      disabled={actioningId === b._id || banners[0]?._id === b._id}
                      onClick={() => move(b, -1)}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      className="btn-outline btn-sm px-2 py-0.5 leading-none disabled:opacity-30"
                      disabled={actioningId === b._id || banners[banners.length - 1]?._id === b._id}
                      onClick={() => move(b, 1)}
                    >
                      ▼
                    </button>
                  </div>
                )}
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
