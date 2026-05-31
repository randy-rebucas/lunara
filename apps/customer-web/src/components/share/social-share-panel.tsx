'use client';

import { useState } from 'react';
import {
  buildSocialShareUrl,
  formatShareText,
  SOCIAL_SHARE_OPTIONS,
  type SharePayload,
  type SocialPlatform,
} from '@lunara/utils';

const PLATFORM_STYLES: Record<SocialPlatform, string> = {
  whatsapp: 'bg-[#25D366] text-white hover:opacity-90',
  facebook: 'bg-[#1877F2] text-white hover:opacity-90',
  x: 'bg-slate-900 text-white hover:opacity-90',
};

interface SocialSharePanelProps {
  payload: SharePayload;
  compact?: boolean;
  className?: string;
}

export function SocialSharePanel({ payload, compact = false, className = '' }: SocialSharePanelProps) {
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState('');

  async function handleNativeShare() {
    setShareError('');
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: payload.title,
          text: payload.message,
          url: payload.url,
        });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    await copyLink();
  }

  async function copyLink() {
    setShareError('');
    try {
      await navigator.clipboard.writeText(formatShareText(payload));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareError('Could not copy link');
    }
  }

  function openSocial(platform: SocialPlatform) {
    window.open(buildSocialShareUrl(platform, payload), '_blank', 'noopener,noreferrer');
  }

  return (
    <div className={className}>
      <div className={`flex flex-wrap gap-2 ${compact ? '' : 'gap-3'}`}>
        {SOCIAL_SHARE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => openSocial(option.id)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${PLATFORM_STYLES[option.id]}`}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          onClick={handleNativeShare}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/5"
        >
          {copied ? 'Copied!' : 'Share / copy'}
        </button>
      </div>
      {shareError ? <p className="mt-2 text-xs text-red-600">{shareError}</p> : null}
    </div>
  );
}
