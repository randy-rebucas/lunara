'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { BookOpen, Menu } from 'lucide-react';
import type { AiAgentPersona, AiChatMessage, AiConversationSummary } from '@lunara/types';
import { getMessages, listAgents, listConversations, sendMessage } from '../../../lib/ai-agents-api';
import { AgentAvatar } from '../../../components/agent-avatar';
import { ChatMessage } from '../../../components/chat-message';
import { ChatComposer } from '../../../components/chat-composer';
import { Sidebar } from '../../../components/sidebar';
import { SuggestedPrompts } from '../../../components/suggested-prompts';
import { PromptLibraryPanel } from '../../../components/prompt-library-panel';

export default function ChatPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;

  const [agents, setAgents] = useState<AiAgentPersona[]>([]);
  const [agent, setAgent] = useState<AiAgentPersona | null>(null);
  const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshConversations = useCallback(async () => {
    const list = await listConversations(agentId);
    setConversations(list);
    return list;
  }, [agentId]);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      setError('');
      setMessages([]);
      setConversationId(undefined);
      try {
        const agentList = agents.length ? agents : await listAgents();
        if (!cancelled && !agents.length) setAgents(agentList);
        const found = agentList.find((a) => a.id === agentId) ?? null;
        if (!cancelled) setAgent(found);
        if (!found) return;

        const list = await refreshConversations();
        if (cancelled) return;
        const latest = list[0];
        if (latest) {
          setConversationId(latest.id);
          const history = await getMessages(latest.id);
          if (!cancelled) setMessages(history);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load conversation');
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSelectConversation(id: string) {
    setError('');
    setConversationId(id);
    setSidebarOpen(false);
    try {
      const history = await getMessages(id);
      setMessages(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
    }
  }

  function handleNewChat() {
    setConversationId(undefined);
    setMessages([]);
    setError('');
    setSidebarOpen(false);
  }

  async function handleSend(text: string) {
    setError('');
    setDraft('');
    const optimisticUser: AiChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);
    try {
      const isNewConversation = !conversationId;
      const result = await sendMessage(agentId, text, conversationId);
      setConversationId(result.conversationId);
      setMessages((prev) => [...prev, result.message]);
      if (isNewConversation) await refreshConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-dvh">
      <Sidebar
        conversations={conversations}
        activeConversationId={conversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col bg-surface-muted">
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            {agent ? (
              <div className="flex min-w-0 items-center gap-3">
                <AgentAvatar id={agent.id} name={agent.name} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{agent.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{agent.role}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </div>
          {agent ? (
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="btn-outline shrink-0 gap-2 bg-surface px-3 sm:px-4"
            >
              <BookOpen className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Prompt library</span>
            </button>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          {messages.length === 0 && agent ? (
            <SuggestedPrompts agent={agent} onPick={handleSend} />
          ) : (
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m} agentId={agentId} agentName={agent?.name ?? ''} />
              ))}
              {sending ? <p className="text-xs text-muted-foreground">Thinking…</p> : null}
              <div ref={bottomRef} />
            </div>
          )}

          {error ? (
            <div className="mx-4 mb-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-300 ring-1 ring-red-500/20 sm:mx-6">
              {error}
            </div>
          ) : null}

          <ChatComposer value={draft} onChange={setDraft} onSend={handleSend} disabled={sending || !agent} />
        </div>
      </div>

      {libraryOpen && agent ? (
        <PromptLibraryPanel
          agentId={agent.id}
          agentName={agent.name}
          onClose={() => setLibraryOpen(false)}
          onPick={(prompt) => {
            setDraft(prompt);
            setLibraryOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
