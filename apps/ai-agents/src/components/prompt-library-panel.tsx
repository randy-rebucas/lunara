'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { AiPromptLibraryGroup } from '@lunara/types';
import { getGuestPromptLibrary, getPromptLibrary } from '../lib/ai-agents-api';

export function PromptLibraryPanel({
  agentId,
  agentName,
  guest = false,
  onClose,
  onPick,
}: {
  agentId: string;
  agentName: string;
  /** Fetch the logged-out prompt set (no auth token attached) instead of the authenticated one. */
  guest?: boolean;
  onClose: () => void;
  onPick: (prompt: string) => void;
}) {
  const [groups, setGroups] = useState<AiPromptLibraryGroup[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (guest ? getGuestPromptLibrary(agentId) : getPromptLibrary(agentId))
      .then((data) => {
        if (!cancelled) setGroups(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load prompt library');
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, guest]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-sm flex-col overflow-hidden bg-surface shadow-[var(--shadow-elevated)] ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-white">Prompt library</p>
            <p className="text-xs text-muted-foreground">{agentName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {!groups && !error ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
          {groups?.map((group) => (
            <div key={group.category}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.category}
              </p>
              <div className="space-y-1.5">
                {group.prompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onPick(prompt)}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/5"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
