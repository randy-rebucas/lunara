'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, LogIn } from 'lucide-react';
import brandIcon from '@lunara/brand/icon';
import type { AiAgentPersona, AiChatMessage } from '@lunara/types';
import { getGuestPromptLibrary, sendGuestMessage } from '../../../lib/ai-agents-api';
import { AgentAvatar } from '../../../components/agent-avatar';
import { ChatMessage } from '../../../components/chat-message';
import { ChatComposer } from '../../../components/chat-composer';
import { SuggestedPrompts } from '../../../components/suggested-prompts';
import { PromptLibraryPanel } from '../../../components/prompt-library-panel';

const EMMA: Omit<AiAgentPersona, 'suggestedPrompts'> = {
  id: 'emma',
  name: 'Emma Flores',
  role: 'Customer Support',
  tagline: 'Ask general questions about how Lunara works — sign in for order/account help.',
};

export default function GuestEmmaPage() {
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getGuestPromptLibrary('emma')
      .then((groups) => setSuggestedPrompts(groups.flatMap((g) => g.prompts)))
      .catch(() => setSuggestedPrompts([]));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async (text: string) => {
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
      const result = await sendGuestMessage('emma', text);
      setMessages((prev) => [...prev, result.message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
    } finally {
      setSending(false);
    }
  }, []);

  const agent: AiAgentPersona = { ...EMMA, suggestedPrompts };

  return (
    <div className="flex h-dvh flex-col bg-surface-muted">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src={brandIcon}
            alt=""
            width={32}
            height={32}
            className="shrink-0 rounded-lg"
            aria-hidden
            priority
          />
          <AgentAvatar id={EMMA.id} name={EMMA.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{EMMA.name}</p>
            <p className="truncate text-xs text-muted-foreground">Browsing as guest</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="btn-outline gap-2 bg-surface px-3 sm:px-4"
          >
            <BookOpen className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Prompt library</span>
          </button>
          <Link href="/login" className="btn-outline gap-2 bg-surface px-3 sm:px-4">
            <LogIn className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Sign in</span>
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {messages.length === 0 ? (
          <SuggestedPrompts agent={agent} onPick={handleSend} />
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} agentId="emma" agentName={EMMA.name} />
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

        <ChatComposer value={draft} onChange={setDraft} onSend={handleSend} disabled={sending} />
      </div>

      {libraryOpen ? (
        <PromptLibraryPanel
          agentId="emma"
          agentName={EMMA.name}
          guest
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
