'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import type { AiAgentsStats } from '@lunara/types';
import { getCurrentUser, getStats } from '../../lib/ai-agents-api';
import { AgentAvatar } from '../../components/agent-avatar';

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<AiAgentsStats | null>(null);
  const [error, setError] = useState('');
  const user = getCurrentUser();
  const allowed = user?.role === 'staff' || user?.role === 'admin';

  useEffect(() => {
    if (!allowed) return;
    getStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load stats'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  if (!allowed) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#05070f] px-6 text-center">
        <div>
          <p className="text-sm font-medium text-white">Staff/admin access only</p>
          <Link href="/" className="mt-2 inline-block text-sm text-indigo-300 hover:text-indigo-200">
            Back to team
          </Link>
        </div>
      </div>
    );
  }

  const maxConversations = Math.max(1, ...(stats?.perPersona.map((p) => p.conversations) ?? [0]));

  return (
    <div className="min-h-dvh bg-[#05070f] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-white"
            aria-label="Back to team"
          >
            <ArrowLeft className="h-4.5 w-4.5" aria-hidden />
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
              <BarChart3 className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div>
              <h1 className="text-lg font-bold text-white">AI Team Usage</h1>
              <p className="text-xs text-muted-foreground">
                Conversations, messages, and guest chat volume per agent
              </p>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/20">
            {error}
          </div>
        ) : null}

        {!stats && !error ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

        {stats ? (
          <>
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile label="Total conversations" value={stats.totalConversations} />
              <StatTile label="Total messages sent" value={stats.totalMessages} />
              <StatTile label="Guest messages (no login)" value={stats.totalGuestMessages} />
            </div>

            <div className="card divide-y divide-white/5 p-0">
              {stats.perPersona.map((p) => (
                <div key={p.agentId} className="flex items-center gap-4 px-5 py-4">
                  <AgentAvatar id={p.agentId} name={p.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-white">{p.name}</p>
                      <p className="shrink-0 text-xs text-muted-foreground">
                        {p.conversations} conversation{p.conversations === 1 ? '' : 's'} ·{' '}
                        {p.messages} message{p.messages === 1 ? '' : 's'}
                        {p.guestMessages > 0 ? ` · ${p.guestMessages} guest` : ''}
                      </p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                        style={{ width: `${(p.conversations / maxConversations) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Page views, visits, and visitor location are tracked via Google Analytics — see the GA4
              dashboard for that traffic-level data. This page covers in-app conversation/message volume
              only.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
