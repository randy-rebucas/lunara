'use client';

import { useState } from 'react';
import { appConfig } from '@lunara/config';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';

interface ScheduleSupportAddress {
  _id: string;
  label: string;
  line1: string;
  city: string;
  province: string;
  postalCode: string;
}

interface ScheduleSupportPromptProps {
  address?: ScheduleSupportAddress | null;
  reason?: string;
}

export function ScheduleSupportPrompt({ address, reason }: ScheduleSupportPromptProps) {
  const { api } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!address) return null;

  async function submitRequest() {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post<{ subject: string }>('/support/area-requests', {
        addressId: address!._id,
        message: message.trim() || undefined,
      });
      setOpen(false);
      setMessage('');
      setSuccess(
        `Request sent. Our team will review pickup for your area (${res.data.subject ?? 'ticket created'}).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send request');
    } finally {
      setSubmitting(false);
    }
  }

  function emailSupport() {
    const subject = encodeURIComponent(`Pickup not available — ${address!.city}`);
    const body = encodeURIComponent(
      [
        'Hi Lunara support,',
        '',
        'I could not schedule a pickup for my address:',
        `${address!.line1}, ${address!.city}, ${address!.province} ${address!.postalCode}`,
        reason ? `\nApp message: ${reason}` : '',
        message.trim() ? `\nMy note: ${message.trim()}` : '',
        '',
        'Please let me know when pickup is available in my area.',
      ].join('\n'),
    );
    window.location.href = `mailto:support@${appConfig.name.toLowerCase()}.com?subject=${subject}&body=${body}`;
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50 p-4 text-sm">
      <p className="font-medium text-amber-900">Pickup not available yet</p>
      <p className="mt-1 text-amber-800">
        {reason ?? 'No pickup slots are available for this address yet.'} Request coverage and we
        will follow up.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          Request area coverage
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={emailSupport}>
          Email support
        </Button>
      </div>
      {success && <p className="mt-2 text-xs font-medium text-emerald-700">{success}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4">
          <div
            className="absolute inset-0"
            aria-hidden
            onClick={() => !submitting && setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-[var(--shadow-elevated)]">
            <h3 className="text-lg font-semibold text-slate-900">Request pickup in your area</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {address.label} · {address.line1}, {address.city}
            </p>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Note (optional)
              <textarea
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Preferred pickup times, building access, etc."
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={submitting} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={submitting} onClick={() => void submitRequest()}>
                {submitting ? 'Sending…' : 'Send request'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
