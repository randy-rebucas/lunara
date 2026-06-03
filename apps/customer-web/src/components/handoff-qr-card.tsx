'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { useAuthContext } from '@lunara/hooks/auth-provider';

interface HandoffQrData {
  label: string;
  payload: string;
}

interface HandoffQrCardProps {
  orderId: string;
  context: 'pickup' | 'delivery';
}

export function HandoffQrCard({ orderId, context }: HandoffQrCardProps) {
  const { api } = useAuthContext();
  const [data, setData] = useState<HandoffQrData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<HandoffQrData>(
        `/orders/${orderId}/handoff-qr?context=${context}`,
      );
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [api, context, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="mt-6 flex justify-center rounded-xl border border-border/70 bg-surface p-8">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mt-6 rounded-xl border border-border/70 bg-surface p-6 text-center">
      <p className="font-semibold text-slate-900">{data.label}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {context === 'pickup'
          ? 'Show this code when your rider arrives for pickup.'
          : 'Show this code when your rider delivers your laundry.'}
      </p>
      <div className="mx-auto mt-6 inline-block rounded-lg bg-white p-4 ring-1 ring-border/60">
        <QRCode value={data.payload} size={200} />
      </div>
    </div>
  );
}
