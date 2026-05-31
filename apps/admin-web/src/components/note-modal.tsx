'use client';

import { useEffect, useId, useRef } from 'react';

export function NoteModal({
  open,
  title,
  description,
  placeholder,
  confirmLabel,
  cancelLabel = 'Cancel',
  required = false,
  value,
  onChange,
  onConfirm,
  onCancel,
  busy = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const titleId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="card-elevated relative z-10 w-full max-w-md"
      >
        <div className="card-body space-y-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <label htmlFor={`${titleId}-note`} className="form-label">
            Note
          </label>
          <textarea
            ref={textareaRef}
            id={`${titleId}-note`}
            className="input-field min-h-24 w-full"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={onCancel} disabled={busy}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={onConfirm}
              disabled={busy || (required && !value.trim())}
            >
              {busy ? 'Saving…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
