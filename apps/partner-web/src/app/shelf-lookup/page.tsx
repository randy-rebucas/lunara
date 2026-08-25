'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { UserRole, type PartnerShelfLookupResult } from '@lunara/types';
import { PageHeader } from '../../components/ui/page-header';
import { useProtectedPage } from '../../hooks/use-protected-page';
import { AuthLoading } from '../../components/auth-loading';
import { partnerFetch } from '../../lib/partner-api';

export default function ShelfLookupPage() {
  const { ready } = useProtectedPage({ roles: [UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN] });
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<PartnerShelfLookupResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [slotInput, setSlotInput] = useState('');
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotError, setSlotError] = useState('');

  useEffect(() => {
    setSlotInput(result?.shelfSlot ?? '');
    setSlotError('');
  }, [result]);

  async function search() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      const data = await partnerFetch<PartnerShelfLookupResult | null>(
        `/partner/orders/shelf-lookup?query=${encodeURIComponent(trimmed)}`,
      );
      setResult(data);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function saveSlot() {
    if (!result || !slotInput.trim()) return;
    setSlotSaving(true);
    setSlotError('');
    try {
      await partnerFetch(`/partner/orders/${result.orderId}/processing/shelf`, {
        method: 'PATCH',
        body: JSON.stringify({ shelfSlot: slotInput.trim() }),
      });
      setResult((prev) => (prev ? { ...prev, shelfSlot: slotInput.trim() } : prev));
    } catch (e) {
      setSlotError(e instanceof Error ? e.message : 'Could not save shelf slot');
    } finally {
      setSlotSaving(false);
    }
  }

  async function clearSlot() {
    if (!result?.shelfSlot) return;
    setSlotSaving(true);
    setSlotError('');
    try {
      await partnerFetch(`/partner/orders/${result.orderId}/processing/shelf`, { method: 'DELETE' });
      setResult((prev) => (prev ? { ...prev, shelfSlot: undefined } : prev));
      setSlotInput('');
    } catch (e) {
      setSlotError(e instanceof Error ? e.message : 'Could not clear shelf slot');
    } finally {
      setSlotSaving(false);
    }
  }

  if (!ready) return <AuthLoading message="Loading…" />;

  return (
    <div>
      <PageHeader
        title="Find on shelf"
        description="Scan or type the shelf slot or tag code on a bag to trace the owner instantly."
      />

      <div className="card card-body mt-6 !py-5">
        <div className="flex flex-wrap gap-3">
          <input
            autoFocus
            className="input-field min-h-[3rem] flex-1 touch-manipulation text-base font-mono uppercase"
            placeholder="Shelf slot or tag code, e.g. A-12"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void search();
            }}
          />
          <button
            type="button"
            disabled={loading || !query.trim()}
            className="btn-primary min-h-[3rem] touch-manipulation px-5 text-base disabled:opacity-50"
            onClick={search}
          >
            {loading ? 'Searching…' : 'Find'}
          </button>
        </div>
        {error && <div className="alert-error mt-3">{error}</div>}
      </div>

      {searched && !error && (
        <div className="mt-6">
          {result ? (
            <div className="card card-body">
              <p className="text-lg font-semibold text-slate-900">
                {result.customerName || 'Customer'}
              </p>
              {result.customerPhone && (
                <p className="text-sm text-muted">{result.customerPhone}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {result.shelfSlot && (
                  <span className="badge-neutral font-mono uppercase">Shelf {result.shelfSlot}</span>
                )}
                <span className="badge-neutral capitalize">
                  {(result.currentStepLabel ?? result.status).replace(/_/g, ' ')}
                </span>
              </div>

              <div className="mt-4 border-t border-border/60 pt-4">
                <label className="form-label" htmlFor="shelf-slot-input">
                  {result.shelfSlot ? 'Reassign shelf slot' : 'Assign shelf slot'}
                </label>
                <div className="flex flex-wrap gap-3">
                  <input
                    id="shelf-slot-input"
                    className="input-field min-h-[2.75rem] flex-1 font-mono uppercase sm:flex-none sm:w-40"
                    placeholder="e.g. A-12"
                    value={slotInput}
                    onChange={(e) => setSlotInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveSlot();
                    }}
                  />
                  <button
                    type="button"
                    disabled={slotSaving || !slotInput.trim() || slotInput.trim() === result.shelfSlot}
                    className="btn-primary min-h-[2.75rem] disabled:opacity-50"
                    onClick={() => void saveSlot()}
                  >
                    {slotSaving ? 'Saving…' : 'Save'}
                  </button>
                  {result.shelfSlot && (
                    <button
                      type="button"
                      disabled={slotSaving}
                      className="btn-outline min-h-[2.75rem] disabled:opacity-50"
                      onClick={() => void clearSlot()}
                    >
                      Clear slot
                    </button>
                  )}
                </div>
                {slotError && <div className="alert-error mt-3">{slotError}</div>}
              </div>

              <Link
                href={`/orders/${result.orderId}`}
                className="btn-outline btn-sm mt-4 inline-flex w-fit"
              >
                Open order →
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface p-8 text-center">
              <p className="font-semibold text-slate-900">No order found</p>
              <p className="mt-1 text-sm text-muted">
                Double-check the shelf slot or tag code and try again.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
