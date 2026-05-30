'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuthContext } from '@lunara/hooks/auth-provider';

interface AppNotification {
  _id: string;
  title: string;
  body: string;
  read: boolean;
  data?: { type?: string; orderId?: string };
  createdAt: string;
}

export function ReviewNotifications({ limit = 5 }: { limit?: number }) {
  const { api, isAuthenticated } = useAuthContext();
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .get<AppNotification[]>(`/notifications/me?limit=${limit}`)
      .then((res) => setItems(res.data.filter((n) => n.data?.type === 'review_request' && !n.read)))
      .catch(() => setItems([]));
  }, [api, isAuthenticated, limit]);

  if (items.length === 0) return null;

  return (
    <section className="mt-8 rounded-xl border border-secondary/30 bg-cyan-50/50 p-5">
      <h2 className="text-sm font-semibold text-slate-800">Notifications</h2>
      <ul className="mt-3 space-y-3">
        {items.map((n) => (
          <li key={n._id}>
            <p className="font-medium text-slate-800">{n.title}</p>
            <p className="text-sm text-slate-600">{n.body}</p>
            {n.data?.orderId && (
              <Link
                href={`/orders/${n.data.orderId}/review`}
                className="mt-2 inline-block text-sm font-medium text-primary"
              >
                Leave a review →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
