'use client';

import Link from 'next/link';
import { useState } from 'react';
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
            className="min-h-[3rem] flex-1 touch-manipulation rounded-lg border px-4 py-3 text-base font-mono uppercase"
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
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>

      {searched && !error && (
        <div className="mt-6">
          {result ? (
            <div className="card card-body">
              <p className="text-lg font-semibold text-slate-900">
                {result.customerName || 'Customer'}
              </p>
              {result.customerPhone && (
                <p className="text-sm text-slate-500">{result.customerPhone}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {result.shelfSlot && (
                  <span className="badge-neutral font-mono uppercase">Shelf {result.shelfSlot}</span>
                )}
                <span className="badge-neutral capitalize">
                  {(result.currentStepLabel ?? result.status).replace(/_/g, ' ')}
                </span>
              </div>
              <Link
                href={`/orders/${result.orderId}`}
                className="btn-outline btn-sm mt-4 inline-flex w-fit"
              >
                Open order →
              </Link>
            </div>
          ) : (
            <div className="card card-body text-center text-slate-500">
              No order found for that shelf slot or tag code.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
