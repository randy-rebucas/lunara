'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { AiAgentPersona, AiChatMessage, AiPromptLibraryGroup } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { PageHeader } from '../../components/ui/page-header';
import { RightDrawer } from '../../components/ui/right-drawer';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { getPromptLibrary, listAgents, listConversations, getMessages, sendMessage } from '../../lib/ai-agents-api';

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="space-y-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold">{children}</h3>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 text-muted">{children}</blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function AiAssistantPage() {
  const { ready } = useRequirePartner();

  const [agent, setAgent] = useState<AiAgentPersona | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<AiPromptLibraryGroup[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);

  const hydrate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const agents = await listAgents();
      const found = agents[0] ?? null;
      setAgent(found);
      if (!found) return;

      const [conversations, promptLibrary] = await Promise.all([
        listConversations(found.id),
        getPromptLibrary(found.id),
      ]);
      setLibrary(promptLibrary);

      const latest = conversations[0];
      if (latest) {
        setConversationId(latest.id);
        setMessages(await getMessages(latest.id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assistant');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready) void hydrate();
  }, [ready, hydrate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function startNewChat() {
    setConversationId(undefined);
    setMessages([]);
    setError('');
  }

  async function handleSend(text: string) {
    if (!agent) return;
    setError('');
    setDraft('');
    const optimisticUser: AiChatMessage = {
      id: `local-${crypto.randomUUID()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);
    try {
      const result = await sendMessage(agent.id, text, conversationId);
      setConversationId(result.conversationId);
      setMessages((prev) => [...prev, result.message]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    void handleSend(trimmed);
  }

  if (!ready) return <AuthLoading message="Loading assistant…" />;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader
        title="AI Assistant"
        description="An AI assistant to help run your shop — answering questions and automating routine tasks."
        actions={
          <>
            {library.length > 0 && (
              <button type="button" className="btn-outline btn-sm" onClick={() => setLibraryOpen(true)}>
                Prompt library
              </button>
            )}
            <button type="button" className="btn-outline btn-sm" onClick={startNewChat}>
              New chat
            </button>
          </>
        }
      />

      {loading ? (
        <AuthLoading message="Loading assistant…" />
      ) : error && !agent ? (
        <div className="alert-error mt-3">{error}</div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-surface">
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm font-medium text-slate-900">
                  {agent ? `Ask ${agent.name} anything about running your shop.` : 'Loading…'}
                </p>
                {agent && (
                  <div className="flex max-w-lg flex-wrap justify-center gap-2">
                    {agent.suggestedPrompts.slice(0, 4).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className="badge-neutral text-xs hover:bg-slate-200"
                        onClick={() => void handleSend(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm sm:max-w-[70%] ${
                        m.role === 'user' ? 'bg-primary text-white' : 'card text-slate-900'
                      }`}
                    >
                      {m.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        <MarkdownContent content={m.content} />
                      )}
                    </div>
                  </div>
                ))}
                {sending && <p className="text-xs text-muted">Thinking…</p>}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {error && agent && (
            <div className="alert-error mx-4 mb-2">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-border p-4">
            <textarea
              className="input-field max-h-40 min-h-[44px] flex-1 resize-none"
              rows={1}
              placeholder="Message your assistant…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              disabled={sending || !agent}
            />
            <button
              type="submit"
              disabled={sending || !draft.trim() || !agent}
              className="btn-primary h-11 shrink-0"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </form>
        </div>
      )}

      <RightDrawer open={libraryOpen} onClose={() => setLibraryOpen(false)} title="Prompt library">
        <div className="flex flex-col gap-5">
          {library.map((group) => (
            <div key={group.category}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{group.category}</h3>
              <div className="mt-2 flex flex-col gap-2">
                {group.prompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="rounded-lg border border-border px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"
                    onClick={() => {
                      setDraft(p);
                      setLibraryOpen(false);
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </RightDrawer>
    </div>
  );
}
