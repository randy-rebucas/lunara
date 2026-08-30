'use client';

import jsQR from 'jsqr';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { UserRole, type PartnerShelf } from '@lunara/types';
import { PageHeader } from '../../components/ui/page-header';
import { useProtectedPage } from '../../hooks/use-protected-page';
import { AuthLoading } from '../../components/auth-loading';
import { partnerFetch } from '../../lib/partner-api';

interface TagLookupResult {
  tag: { code: string; status: string };
  order: {
    id: string;
    shortCode: string;
    status: string;
    branchId?: string;
    bookingType?: string;
    shelfSlot?: string;
    items?: { serviceType: string; quantity: number; notes?: string }[];
  } | null;
  customer: { firstName: string; lastName: string; phone?: string } | null;
}

function AddToShelfPanel({ result, onClose }: { result: TagLookupResult; onClose: () => void }) {
  const [shelves, setShelves] = useState<PartnerShelf[] | null>(null);
  const [shelvesError, setShelvesError] = useState('');
  const [selectedShelfId, setSelectedShelfId] = useState('');
  const [newShelfName, setNewShelfName] = useState('');
  const [itemName, setItemName] = useState(
    result.order?.bookingType ? result.order.bookingType.replace(/_/g, ' ') : 'Laundry bag',
  );
  const [note, setNote] = useState(`Tag ${result.tag.code}${result.order ? ` · Order ${result.order.shortCode}` : ''}`);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    partnerFetch<PartnerShelf[]>('/partner/shelves')
      .then((data) => {
        setShelves(data);
        if (data.length > 0) setSelectedShelfId(data[0]._id);
      })
      .catch((e) => setShelvesError(e instanceof Error ? e.message : 'Failed to load shelves'));
  }, []);

  async function save() {
    if (!itemName.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      let shelfId = selectedShelfId;
      if (!shelfId) {
        if (!newShelfName.trim()) throw new Error('Pick a shelf or name a new one');
        const created = await partnerFetch<PartnerShelf>('/partner/shelves', {
          method: 'POST',
          body: JSON.stringify({ name: newShelfName.trim() }),
        });
        shelfId = created._id;
      }
      await partnerFetch(`/partner/shelves/${shelfId}/items`, {
        method: 'POST',
        body: JSON.stringify({ name: itemName.trim(), note: note.trim() || undefined }),
      });
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not add to shelf');
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="mt-4 rounded-lg border border-accent/30 bg-green-50 p-4 text-sm text-accent">
        Added to shelf.
        <button type="button" className="btn-outline btn-sm ml-3" onClick={onClose}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-border/60 bg-surface p-4">
      <p className="text-sm font-semibold text-slate-900">Add to shelf</p>

      {shelvesError && <p className="mt-2 text-sm text-red-500">{shelvesError}</p>}

      <label className="form-label mt-3" htmlFor="scan-item-name">
        Item name
      </label>
      <input
        id="scan-item-name"
        className="input-field"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
      />

      <label className="form-label mt-3" htmlFor="scan-shelf-select">
        Shelf
      </label>
      <select
        id="scan-shelf-select"
        className="input-field"
        value={selectedShelfId}
        onChange={(e) => setSelectedShelfId(e.target.value)}
      >
        {(shelves ?? []).map((s) => (
          <option key={s._id} value={s._id}>
            {s.name}
          </option>
        ))}
        <option value="">+ New shelf…</option>
      </select>

      {!selectedShelfId && (
        <input
          className="input-field mt-2"
          placeholder="New shelf name"
          value={newShelfName}
          onChange={(e) => setNewShelfName(e.target.value)}
        />
      )}

      <label className="form-label mt-3" htmlFor="scan-item-note">
        Note <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <input
        id="scan-item-note"
        className="input-field"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {saveError && <p className="mt-2 text-sm text-red-500">{saveError}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={saving || !itemName.trim()}
          className="btn-primary btn-sm disabled:opacity-50"
          onClick={save}
        >
          {saving ? 'Saving…' : 'Save to shelf'}
        </button>
        <button type="button" className="btn-outline btn-sm" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ScanTagPage() {
  const { ready } = useProtectedPage({ roles: [UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN] });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scanningRef = useRef(false);

  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState<TagLookupResult | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [addingToShelf, setAddingToShelf] = useState(false);

  const lookup = useCallback(async (code: string) => {
    setLoading(true);
    setLookupError('');
    try {
      const data = await partnerFetch<TagLookupResult>(`/laundry-tags/lookup?code=${encodeURIComponent(code)}`);
      setResult(data);
    } catch (e) {
      setResult(null);
      setLookupError(e instanceof Error ? e.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const tickRef = useRef<() => void>(() => {});
  useEffect(() => {
    tickRef.current = () => {
      if (!scanningRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            setPaused(true);
            void lookup(code.data);
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(() => tickRef.current());
    };
  }, [lookup]);

  useEffect(() => {
    if (!ready || paused) return;
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        scanningRef.current = true;
        rafRef.current = requestAnimationFrame(() => tickRef.current());
      } catch {
        setCameraError('Camera access is required to scan tags. Please allow camera permission.');
      }
    }

    void start();

    return () => {
      cancelled = true;
      scanningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [ready, paused]);

  function scanAgain() {
    setResult(null);
    setLookupError('');
    setAddingToShelf(false);
    setPaused(false);
  }

  if (!ready) return <AuthLoading message="Loading…" />;

  return (
    <div>
      <PageHeader
        title="Scan tag"
        description="Point the camera at a laundry tag's QR code to see which order and customer it belongs to."
      />

      {!paused && (
        <div className="card card-body mt-6 !py-4">
          {cameraError ? (
            <p className="text-sm text-red-500">{cameraError}</p>
          ) : (
            <div className="relative mx-auto max-w-md overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} className="w-full" muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}
        </div>
      )}

      {loading && <p className="mt-4 text-sm text-slate-500">Looking up tag…</p>}

      {lookupError && !loading && (
        <div className="card card-body mt-6 text-center">
          <p className="text-sm text-red-500">{lookupError}</p>
          <button type="button" className="btn-outline btn-sm mt-4 w-fit self-center" onClick={scanAgain}>
            Scan again
          </button>
        </div>
      )}

      {result && !loading && (
        <div className="card card-body mt-6">
          <p className="font-mono text-sm uppercase text-slate-500">{result.tag.code}</p>
          {result.order && result.customer ? (
            <>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {result.customer.firstName} {result.customer.lastName}
              </p>
              {result.customer.phone && <p className="text-sm text-slate-500">{result.customer.phone}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="badge-neutral font-mono uppercase">Order {result.order.shortCode}</span>
                <span className="badge-neutral capitalize">{result.order.status.replace(/_/g, ' ')}</span>
                {result.order.shelfSlot && (
                  <span className="badge-neutral font-mono uppercase">Shelf {result.order.shelfSlot}</span>
                )}
              </div>

              {result.order.items && result.order.items.length > 0 && (
                <div className="mt-4 border-t border-border/60 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Items in this order
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                    {result.order.items.map((item, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span className="capitalize">{item.serviceType.replace(/_/g, ' ')}</span>
                        {item.quantity > 1 && <span className="text-muted">× {item.quantity}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/orders/${result.order.id}`} className="btn-outline btn-sm">
                  View details →
                </Link>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => setAddingToShelf(true)}
                  disabled={addingToShelf}
                >
                  Add to shelf
                </button>
              </div>

              {addingToShelf && (
                <AddToShelfPanel result={result} onClose={() => setAddingToShelf(false)} />
              )}
            </>
          ) : (
            <>
              <p className="mt-2 text-slate-500">This tag isn&apos;t currently attached to any order.</p>
              <div className="mt-4">
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => setAddingToShelf(true)}
                  disabled={addingToShelf}
                >
                  Add to shelf
                </button>
              </div>
              {addingToShelf && (
                <AddToShelfPanel result={result} onClose={() => setAddingToShelf(false)} />
              )}
            </>
          )}
          <button type="button" className="btn-outline btn-sm mt-4 w-fit" onClick={scanAgain}>
            Scan another tag
          </button>
        </div>
      )}
    </div>
  );
}
