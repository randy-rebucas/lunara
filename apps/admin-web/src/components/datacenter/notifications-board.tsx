'use client';

import { useState } from 'react';
import { adminFetch } from '../../lib/admin-api';

type Audience = 'all';

const audienceOptions: { value: Audience; label: string; description: string }[] = [
  { value: 'all', label: 'All users', description: 'Everyone with a registered push token' },
];

export function NotificationsBoard() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number } | null>(null);
  const [error, setError] = useState('');

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setError('');
    setResult(null);
    try {
      const data = await adminFetch<{ success: boolean; sent: number }>('/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), body: body.trim(), audience }),
      });
      setResult({ sent: data.sent });
      setTitle('');
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send notification');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <header className="mb-5">
        <div>
          <p className="dc-eyebrow">Growth</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Broadcast notifications
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
            Send a push notification to all users with a registered device. Use this for
            announcements, promotions, or service alerts.
          </p>
        </div>
      </header>

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-950/5 px-4 py-3">
          <span
            className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
            aria-hidden
          />
          <div>
            <p className="text-sm font-semibold text-slate-900">Notification sent</p>
            <p className="text-xs text-muted">
              Delivered to <strong>{result.sent}</strong> device{result.sent !== 1 ? 's' : ''}.
              {result.sent === 0
                ? ' No push tokens registered — users must have the mobile app installed.'
                : ''}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="dc-panel lg:col-span-2">
          <div className="dc-panel-header">
            <h2 className="text-sm font-semibold text-slate-900">Compose message</h2>
            <p className="text-xs text-muted">Title and body are required</p>
          </div>
          <form onSubmit={send} className="dc-panel-body">
            <div className="space-y-4">
              <div>
                <label htmlFor="notif-audience" className="form-label">
                  Audience
                </label>
                <select
                  id="notif-audience"
                  className="input-field"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as Audience)}
                >
                  {audienceOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted">
                  {audienceOptions.find((o) => o.value === audience)?.description}
                </p>
              </div>

              <div>
                <label htmlFor="notif-title" className="form-label">
                  Title
                  <span className="ml-1 font-normal text-muted">
                    ({title.length}/65 chars)
                  </span>
                </label>
                <input
                  id="notif-title"
                  className="input-field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={65}
                  placeholder="e.g. Special offer this weekend!"
                  required
                />
              </div>

              <div>
                <label htmlFor="notif-body" className="form-label">
                  Message
                  <span className="ml-1 font-normal text-muted">
                    ({body.length}/240 chars)
                  </span>
                </label>
                <textarea
                  id="notif-body"
                  className="input-field min-h-[100px] resize-y"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={240}
                  placeholder="e.g. Get 20% off your next laundry order. Use code WEEKEND20 at checkout."
                  required
                />
              </div>
            </div>

            <div className="dc-form-actions mt-4">
              <button
                type="submit"
                disabled={sending || !title.trim() || !body.trim()}
                className="btn-primary btn-sm"
              >
                {sending ? 'Sending…' : 'Send notification'}
              </button>
            </div>
          </form>
        </section>

        <section className="dc-panel self-start">
          <div className="dc-panel-header">
            <h2 className="text-sm font-semibold text-slate-900">Preview</h2>
            <p className="text-xs text-muted">How it appears on device</p>
          </div>
          <div className="dc-panel-body">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-1.5 flex items-center gap-1.5">
                <div className="h-5 w-5 rounded bg-primary/20" aria-hidden />
                <span className="text-xs font-medium text-slate-500">Lunara</span>
                <span className="ml-auto text-xs text-slate-400">now</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {title.trim() || 'Notification title'}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                {body.trim() || 'Your message will appear here.'}
              </p>
            </div>
            <p className="mt-3 text-xs text-muted">
              Push notifications require the customer or rider mobile app to be installed with
              notifications enabled.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
