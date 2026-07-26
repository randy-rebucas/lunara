import Link from 'next/link';
import type { AiAgentPersona } from '@lunara/types';
import { AgentAvatar } from './agent-avatar';

export function AgentCard({ agent }: { agent: AiAgentPersona }) {
  return (
    <Link
      href={`/chat/${agent.id}`}
      className="card flex flex-col gap-3 p-5 ring-1 ring-border transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] hover:ring-primary/40"
    >
      <AgentAvatar id={agent.id} name={agent.name} size="lg" />
      <div>
        <p className="text-base font-semibold text-white">{agent.name}</p>
        <p className="text-sm font-medium text-indigo-300">{agent.role}</p>
      </div>
      <p className="text-sm text-muted-foreground">{agent.tagline}</p>
    </Link>
  );
}
