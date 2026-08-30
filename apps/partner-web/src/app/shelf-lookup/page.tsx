'use client';

import { useCallback, useState } from 'react';
import {
  UserRole,
  type PartnerShelf,
  type PartnerShelfItemSearchResult,
} from '@lunara/types';
import { PageHeader } from '../../components/ui/page-header';
import { DataPageStatus } from '../../components/data-page-status';
import { useProtectedPage } from '../../hooks/use-protected-page';
import { AuthLoading } from '../../components/auth-loading';
import { partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

export default function ShelfLookupPage() {
  const { ready } = useProtectedPage({ roles: [UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN] });

  // ── Search ──
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PartnerShelfItemSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // ── Shelves ──
  const loadShelves = useCallback(async () => partnerFetch<PartnerShelf[]>('/partner/shelves'), []);
  const { data: shelves, loading: shelvesLoading, error: shelvesError, reload } = usePartnerQuery(
    loadShelves,
    [],
  );

  const [newShelfName, setNewShelfName] = useState('');
  const [creatingShelf, setCreatingShelf] = useState(false);
  const [createError, setCreateError] = useState('');

  const [itemDrafts, setItemDrafts] = useState<Record<string, { name: string; quantity: string; note: string }>>(
    {},
  );
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [shelfActionError, setShelfActionError] = useState('');

  async function search() {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      return;
    }
    setSearching(true);
    setSearchError('');
    try {
      const data = await partnerFetch<PartnerShelfItemSearchResult[]>(
        `/partner/shelves/search?query=${encodeURIComponent(trimmed)}`,
      );
      setResults(data);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed');
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  async function createShelf() {
    const name = newShelfName.trim();
    if (!name) return;
    setCreatingShelf(true);
    setCreateError('');
    try {
      await partnerFetch('/partner/shelves', { method: 'POST', body: JSON.stringify({ name }) });
      setNewShelfName('');
      await reload();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Could not create shelf');
    } finally {
      setCreatingShelf(false);
    }
  }

  async function deleteShelf(shelfId: string, shelfName: string) {
    if (!window.confirm(`Delete shelf "${shelfName}" and everything on it? This cannot be undone.`)) return;
    setShelfActionError('');
    try {
      await partnerFetch(`/partner/shelves/${shelfId}`, { method: 'DELETE' });
      await reload();
    } catch (e) {
      setShelfActionError(e instanceof Error ? e.message : 'Could not delete shelf');
    }
  }

  function draftFor(shelfId: string) {
    return itemDrafts[shelfId] ?? { name: '', quantity: '1', note: '' };
  }

  function updateDraft(shelfId: string, patch: Partial<{ name: string; quantity: string; note: string }>) {
    setItemDrafts((prev) => ({ ...prev, [shelfId]: { ...draftFor(shelfId), ...patch } }));
  }

  async function addItem(shelfId: string) {
    const draft = draftFor(shelfId);
    const name = draft.name.trim();
    if (!name) return;
    setSavingItem(shelfId);
    setShelfActionError('');
    try {
      await partnerFetch(`/partner/shelves/${shelfId}/items`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          quantity: Number(draft.quantity) || 1,
          note: draft.note.trim() || undefined,
        }),
      });
      setItemDrafts((prev) => ({ ...prev, [shelfId]: { name: '', quantity: '1', note: '' } }));
      await reload();
    } catch (e) {
      setShelfActionError(e instanceof Error ? e.message : 'Could not add item');
    } finally {
      setSavingItem(null);
    }
  }

  async function removeItem(shelfId: string, itemId: string) {
    setShelfActionError('');
    try {
      await partnerFetch(`/partner/shelves/${shelfId}/items/${itemId}`, { method: 'DELETE' });
      await reload();
    } catch (e) {
      setShelfActionError(e instanceof Error ? e.message : 'Could not remove item');
    }
  }

  if (!ready) return <AuthLoading message="Loading…" />;

  return (
    <div>
      <PageHeader
        title="Find on shelf"
        description="Search items across your shelves, or create a shelf and add items to it."
      />

      <div className="card card-body mt-6 !py-5">
        <div className="flex flex-wrap gap-3">
          <input
            autoFocus
            className="input-field min-h-[3rem] flex-1 touch-manipulation text-base"
            placeholder="Search for an item by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void search();
            }}
          />
          <button
            type="button"
            disabled={searching || !query.trim()}
            className="btn-primary min-h-[3rem] touch-manipulation px-5 text-base disabled:opacity-50"
            onClick={search}
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
        {searchError && <div className="alert-error mt-3">{searchError}</div>}

        {results && (
          <div className="mt-4">
            {results.length === 0 ? (
              <p className="text-sm text-muted">No items matched &ldquo;{query.trim()}&rdquo;.</p>
            ) : (
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
                {results.map((r) => (
                  <li key={r.itemId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{r.name}</p>
                      {r.note && <p className="text-sm text-muted">{r.note}</p>}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted">Qty {r.quantity}</span>
                      <span className="badge-neutral">{r.shelfName}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Shelves</h2>
      </div>

      <div className="card card-body mt-3 !py-4">
        <div className="flex flex-wrap gap-3">
          <input
            className="input-field min-h-[2.75rem] flex-1 sm:flex-none sm:w-64"
            placeholder="New shelf name, e.g. Rack A"
            value={newShelfName}
            onChange={(e) => setNewShelfName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void createShelf();
            }}
          />
          <button
            type="button"
            disabled={creatingShelf || !newShelfName.trim()}
            className="btn-primary min-h-[2.75rem] disabled:opacity-50"
            onClick={createShelf}
          >
            {creatingShelf ? 'Creating…' : 'Create shelf'}
          </button>
        </div>
        {createError && <div className="alert-error mt-3">{createError}</div>}
      </div>

      <div className="mt-4">
        <DataPageStatus loading={shelvesLoading} error={shelvesError} loadingMessage="Loading shelves…" />
      </div>

      {shelfActionError && <div className="alert-error mt-3">{shelfActionError}</div>}

      {!shelvesLoading && !shelvesError && (shelves ?? []).length === 0 && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-semibold text-slate-900">No shelves yet</p>
          <p className="mt-1 text-sm text-muted">Create your first shelf above to start adding items.</p>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {(shelves ?? []).map((shelf) => {
          const draft = draftFor(shelf._id);
          return (
            <section key={shelf._id} className="section-panel">
              <div className="section-panel-header flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-900">{shelf.name}</h3>
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={() => void deleteShelf(shelf._id, shelf.name)}
                >
                  Delete shelf
                </button>
              </div>
              <div className="card-body pt-4">
                {shelf.items.length === 0 ? (
                  <p className="text-sm text-muted">No items on this shelf yet.</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {shelf.items.map((item) => (
                      <li key={item._id} className="flex items-center justify-between gap-2 py-2.5">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">
                            {item.name}
                            {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                          </p>
                          {item.note && <p className="text-sm text-muted">{item.note}</p>}
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => void removeItem(shelf._id, item._id)}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
                  <input
                    className="input-field min-h-[2.5rem] flex-1"
                    placeholder="Item name"
                    value={draft.name}
                    onChange={(e) => updateDraft(shelf._id, { name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void addItem(shelf._id);
                    }}
                  />
                  <input
                    type="number"
                    min={1}
                    className="input-field min-h-[2.5rem] w-20"
                    value={draft.quantity}
                    onChange={(e) => updateDraft(shelf._id, { quantity: e.target.value })}
                  />
                  <input
                    className="input-field min-h-[2.5rem] flex-1"
                    placeholder="Note (optional)"
                    value={draft.note}
                    onChange={(e) => updateDraft(shelf._id, { note: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void addItem(shelf._id);
                    }}
                  />
                  <button
                    type="button"
                    disabled={savingItem === shelf._id || !draft.name.trim()}
                    className="btn-primary min-h-[2.5rem] disabled:opacity-50"
                    onClick={() => void addItem(shelf._id)}
                  >
                    Add item
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
