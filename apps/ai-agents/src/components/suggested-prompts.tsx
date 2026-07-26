import type { AiAgentPersona } from '@lunara/types';
import { AgentAvatar } from './agent-avatar';

export function SuggestedPrompts({
  agent,
  onPick,
}: {
  agent: AiAgentPersona;
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <AgentAvatar id={agent.id} name={agent.name} size="lg" />
      <div>
        <p className="text-lg font-semibold text-white">{agent.name}</p>
        <p className="text-sm text-muted-foreground">{agent.tagline}</p>
      </div>
      <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {agent.suggestedPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="card px-4 py-3 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:ring-primary/40"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
