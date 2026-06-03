'use client';

import { useEffect, useState } from 'react';
import { fetchAuthenticatedMediaUrl } from '../lib/partner-api';

export function AuthenticatedImage({
  publicPath,
  alt,
  className,
}: {
  publicPath: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    fetchAuthenticatedMediaUrl(publicPath)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [publicPath]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-muted ${className ?? ''}`}
      >
        Unable to load image
      </div>
    );
  }

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-muted ${className ?? ''}`}
      >
        Loading…
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}
