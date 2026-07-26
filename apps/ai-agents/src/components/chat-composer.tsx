'use client';

import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { getPrefs } from '../lib/prefs';

export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  disabled?: boolean;
}) {
  const [sendOnEnter, setSendOnEnter] = useState(true);

  useEffect(() => {
    setSendOnEnter(getPrefs().sendOnEnter);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1 border-t border-border p-4">
      <div className="flex items-end gap-2">
        <textarea
          className="input-field max-h-40 min-h-[44px] flex-1 resize-none"
          rows={1}
          placeholder="Message this agent…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            const shouldSend = sendOnEnter ? !e.shiftKey : e.metaKey || e.ctrlKey;
            if (shouldSend) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          disabled={disabled}
        />
        <button type="submit" disabled={disabled || !value.trim()} className="btn-primary h-11 w-11 shrink-0 p-0">
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <p className="px-1 text-[11px] text-muted-foreground">
        {sendOnEnter ? 'Enter to send · Shift+Enter for a new line' : 'Ctrl/Cmd+Enter to send · Enter for a new line'}
      </p>
    </form>
  );
}
