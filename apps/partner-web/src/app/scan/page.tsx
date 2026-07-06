'use client';

import jsQR from 'jsqr';
import { useCallback, useEffect, useRef, useState } from 'react';
import { UserRole } from '@lunara/types';
import { PageHeader } from '../../components/ui/page-header';
import { useProtectedPage } from '../../hooks/use-protected-page';
import { AuthLoading } from '../../components/auth-loading';
import { partnerFetch } from '../../lib/partner-api';

interface TagLookupResult {
  tag: { code: string; status: string };
  order: { id: string; shortCode: string; status: string; branchId?: string } | null;
  customer: { firstName: string; lastName: string; phone?: string } | null;
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
              </div>
            </>
          ) : (
            <p className="mt-2 text-slate-500">This tag isn&apos;t currently attached to any order.</p>
          )}
          <button type="button" className="btn-primary btn-sm mt-4 w-fit" onClick={scanAgain}>
            Scan another tag
          </button>
        </div>
      )}
    </div>
  );
}
