'use client';

import { useId, useRef, useState } from 'react';
import { resolveMediaUrl } from '@lunara/utils';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/jpg';

interface ProfileAvatarUploadProps {
  name: string;
  avatarUrl?: string | null;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
}

export function ProfileAvatarUpload({
  name,
  avatarUrl,
  uploading,
  onUpload,
}: ProfileAvatarUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const imageUrl = previewUrl ?? resolveMediaUrl(avatarUrl, process.env.NEXT_PUBLIC_API_URL);
  const initial = name.charAt(0).toUpperCase();
  const busy = uploading;

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    if (!ACCEPT.split(',').includes(file.type)) {
      setError('Use a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be 5 MB or smaller.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    try {
      await onUpload(file);
      setPreviewUrl(null);
    } catch (err) {
      setPreviewUrl(null);
      setError(err instanceof Error ? err.message : 'Could not upload photo');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="group relative disabled:opacity-60"
        aria-label="Change profile photo"
      >
        <div className="relative h-20 w-20 overflow-hidden rounded-full bg-primary/10 ring-2 ring-primary/20 transition group-hover:ring-primary/40">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary">
              {initial}
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            </span>
          )}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-white shadow-sm ring-2 ring-surface">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </span>
      </button>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={onFileChange}
      />
      <p className="mt-3 text-sm font-medium text-primary">
        {busy ? 'Uploading…' : 'Change photo'}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">JPEG, PNG, or WebP · max 5 MB</p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
