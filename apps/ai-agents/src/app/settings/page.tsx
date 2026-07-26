'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, LogOut } from 'lucide-react';
import { getPrefs, setPrefs } from '../../lib/prefs';
import { logout } from '../../lib/ai-agents-api';

export default function SettingsPage() {
  const [sendOnEnter, setSendOnEnter] = useState(true);

  useEffect(() => {
    setSendOnEnter(getPrefs().sendOnEnter);
  }, []);

  function toggleSendOnEnter() {
    const next = !sendOnEnter;
    setSendOnEnter(next);
    setPrefs({ sendOnEnter: next });
  }

  return (
    <div className="min-h-dvh bg-surface-muted">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to team
        </Link>

        <h1 className="mb-6 text-lg font-bold text-white">Settings</h1>

        <div className="card p-6">
          <p className="mb-1 text-sm font-semibold text-white">Chat</p>
          <p className="mb-4 text-xs text-muted-foreground">Preferences are stored on this device only.</p>

          <label className="flex items-center justify-between gap-4 py-2">
            <span>
              <span className="block text-sm text-slate-100">Send with Enter</span>
              <span className="block text-xs text-muted-foreground">
                {sendOnEnter
                  ? 'Enter sends your message; Shift+Enter adds a new line.'
                  : 'Enter adds a new line; Ctrl/Cmd+Enter sends your message.'}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={sendOnEnter}
              onClick={toggleSendOnEnter}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                sendOnEnter ? 'bg-primary' : 'bg-white/15'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  sendOnEnter ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
        </div>

        <div className="card mt-4 p-6">
          <p className="mb-1 text-sm font-semibold text-white">Account</p>
          <p className="mb-4 text-xs text-muted-foreground">
            Signing out clears your session on this device.
          </p>
          <button
            type="button"
            onClick={() => logout().then(() => window.location.assign('/login'))}
            className="btn-outline gap-2"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
