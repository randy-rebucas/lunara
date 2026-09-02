'use client';

import { useId, useRef, useState } from 'react';
import { CheckCircle2, Upload } from 'lucide-react';
import { FormLabel } from './input';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/jpg';
const ALLOWED_TYPES = ACCEPT.split(',');

interface DocumentUploadFieldProps {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}

export function DocumentUploadField({ label, file, onChange }: DocumentUploadFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;

    setError('');
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError('Use a JPEG, PNG, or WebP image.');
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError('Image must be 5 MB or smaller.');
      return;
    }
    onChange(selected);
  }

  return (
    <div
      className={`rounded-xl p-3 ring-1 transition ${
        file ? 'bg-accent/5 ring-accent/30' : 'bg-surface ring-border/50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <FormLabel htmlFor={inputId} className="mb-0">
          {label}
        </FormLabel>
        {file && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
            <CheckCircle2 className="h-3 w-3" aria-hidden />
            Uploaded
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-primary/40 hover:text-primary"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {file ? 'Change file' : 'Choose file'}
        </button>
        <span className="truncate text-sm text-muted">{file ? file.name : 'No file selected'}</span>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={onFileChange}
      />
      <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, or WebP · max 5 MB</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
