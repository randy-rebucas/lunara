'use client';

import { useRef, useState } from 'react';
import { uploadProcessingPhoto } from '../lib/partner-api';
import { AuthenticatedImage } from './authenticated-image';

interface ProcessingPhotoUploadProps {
  orderId: string;
  value: string;
  onChange: (photoUrl: string) => void;
  disabled?: boolean;
}

export function ProcessingPhotoUpload({
  orderId,
  value,
  onChange,
  disabled,
}: ProcessingPhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const photoUrl = await uploadProcessingPhoto(orderId, file);
      onChange(photoUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="mt-4">
      <label className="text-sm font-medium text-slate-700">Progress photo</label>
      <p className="text-xs text-slate-500">Capture or upload a photo for this processing stage.</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="mt-2 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary"
        disabled={disabled || uploading}
        onChange={handleFileChange}
      />
      {uploading && <p className="mt-2 text-xs text-muted">Uploading photo…</p>}
      {uploadError && <p className="mt-2 text-xs text-red-500">{uploadError}</p>}
      {value ? (
        <div className="mt-3">
          <AuthenticatedImage
            publicPath={value}
            alt="Processing stage preview"
            className="max-h-48 rounded-lg border border-border/60 object-cover"
          />
        </div>
      ) : null}
    </div>
  );
}
