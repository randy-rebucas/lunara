'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Settings, User } from 'lucide-react';
import brandIcon from '@lunara/brand/icon';
import type { AiAgentPersona } from '@lunara/types';
import { listAgents } from '../lib/ai-agents-api';
import { AgentCard } from '../components/agent-card';

export default function RosterPage() {
  const [agents, setAgents] = useState<AiAgentPersona[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listAgents()
      .then(setAgents)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load agents'));
  }, []);

  return (
    <div className="relative min-h-dvh bg-[#05070f]">
      <div
        className="pointer-events-none fixed inset-0 bg-cover bg-top opacity-25"
        style={{ backgroundImage: 'url(/images/backgrounds/bg-flow.png)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(5,7,15,0.5), rgba(5,7,15,0.95)), radial-gradient(50% 40% at 15% 0%, rgba(99,102,241,0.14), transparent), radial-gradient(45% 35% at 90% 90%, rgba(139,92,246,0.1), transparent)',
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
          <div className="flex items-center gap-2.5">
            <Image
              src={brandIcon}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-xl shadow-lg"
              aria-hidden
              priority
            />
            <div>
              <h1 className="text-lg font-bold text-white">Lunara AI Team</h1>
              <p className="text-sm text-muted-foreground">Pick a specialist to chat with</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/profile"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Profile"
            >
              <User className="h-4.5 w-4.5" aria-hidden />
            </Link>
            <Link
              href="/settings"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Settings"
            >
              <Settings className="h-4.5 w-4.5" aria-hidden />
            </Link>
          </div>
        </header>

        {error ? (
          <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/20">
            {error}
          </div>
        ) : null}

        {!agents && !error ? <p className="text-sm text-muted-foreground">Loading agents…</p> : null}

        {agents ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
