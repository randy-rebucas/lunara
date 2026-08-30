'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Headset, Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { Button, cn } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { escalateToHuman, fetchSuggestedPrompts, sendChatMessage, type ChatMessage } from '../../lib/ai-chat';

type View = 'chat' | 'escalate' | 'escalated';

function Avatar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary',
        className,
      )}
      aria-hidden
    >
      E
    </span>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="space-y-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-sm font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold">{children}</h3>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-xs">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg bg-black/10 p-3 text-xs">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 text-slate-600">{children}</blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ChatWidget() {
  const { isAuthenticated, api, user } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<string[]>([]);

  const [escalateName, setEscalateName] = useState('');
  const [escalateEmail, setEscalateEmail] = useState('');
  const [escalateMessage, setEscalateMessage] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [escalateConfirmation, setEscalateConfirmation] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || messages.length > 0 || prompts.length > 0) return;
    fetchSuggestedPrompts(api, isAuthenticated).then(setPrompts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, view]);

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setSending(true);

    try {
      const result = await sendChatMessage(api, isAuthenticated, trimmed, conversationId);
      if (result.conversationId) setConversationId(result.conversationId);
      setMessages((prev) => [...prev, result.message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.');
    } finally {
      setSending(false);
    }
  }

  function openEscalate() {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    setEscalateMessage(lastUserMessage?.content ?? '');
    setEscalateEmail(user?.email ?? '');
    setError(null);
    setView('escalate');
  }

  async function handleEscalateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!escalateMessage.trim() || (!isAuthenticated && !escalateEmail.trim())) return;
    setEscalating(true);
    setError(null);
    try {
      const transcript = messages
        .slice(-10)
        .map((m) => `${m.role === 'user' ? 'Visitor' : 'Emma'}: ${m.content}`)
        .join('\n');
      const confirmation = await escalateToHuman(api, isAuthenticated, {
        message: escalateMessage.trim(),
        transcript,
        name: escalateName.trim() || undefined,
        email: isAuthenticated ? undefined : escalateEmail.trim(),
      });
      setEscalateConfirmation(confirmation);
      setView('escalated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach support — please try again.');
    } finally {
      setEscalating(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close chat' : 'Chat with us'}
        aria-expanded={open}
        className="fixed bottom-[8%] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_16px_32px_-8px_rgb(37_99_235/0.5)] transition hover:bg-primary/90 hover:shadow-[0_20px_36px_-8px_rgb(37_99_235/0.55)] active:scale-95 sm:right-6"
      >
        {open ? <X className="h-6 w-6" aria-hidden /> : <MessageCircle className="h-6 w-6" aria-hidden />}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Chat with Emma"
          className="reveal reveal-visible fixed bottom-[calc(8%+3.75rem)] right-5 z-40 flex h-[min(70vh,34rem)] w-[min(92vw,23rem)] flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_24px_48px_-16px_rgb(15_23_42/0.35)] ring-1 ring-border/60 sm:right-6"
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border/50 bg-surface-muted px-4 py-3">
            <Avatar />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">Emma · Lunara Support</p>
              <p className="truncate text-xs text-muted-foreground">
                {view === 'escalate' ? 'Talk to a human' : 'Usually replies instantly'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-full p-1.5 text-muted-foreground transition hover:bg-slate-200/60"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* Body */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {view === 'chat' ? (
              <div className="flex flex-col gap-3">
                {messages.length === 0 ? (
                  <div className="rounded-xl bg-primary/5 p-3 text-sm leading-relaxed text-slate-700">
                    Hi, I&apos;m Emma 👋 Ask me about bookings, pricing, tracking, or your account —
                    or talk to a human any time.
                  </div>
                ) : null}

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                        m.role === 'user'
                          ? 'whitespace-pre-wrap rounded-br-sm bg-primary text-white'
                          : 'rounded-bl-sm bg-surface-muted text-slate-800 ring-1 ring-border/50',
                      )}
                    >
                      {m.role === 'user' ? m.content : <MarkdownContent content={m.content} />}
                    </div>
                  </div>
                ))}

                {sending ? (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-surface-muted px-3.5 py-2.5 ring-1 ring-border/50">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
                      <span className="text-xs text-muted-foreground">Emma is typing…</span>
                    </div>
                  </div>
                ) : null}

                {messages.length === 0 && prompts.length > 0 ? (
                  <div className="mt-1 flex flex-col gap-2">
                    {prompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleSend(prompt)}
                        className="flex items-start gap-2 rounded-xl bg-surface px-3 py-2.5 text-left text-sm text-slate-700 ring-1 ring-border/50 transition hover:bg-primary/5 hover:text-primary hover:ring-primary/30"
                      >
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                        {prompt}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {view === 'escalate' ? (
              <form onSubmit={handleEscalateSubmit} className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  We&apos;ll pass this straight to our support team. Prefer to chat live instead?{' '}
                  <a
                    href="https://lunara-ai-agents.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-primary"
                  >
                    Talk to our AI agents
                  </a>
                  .
                </p>
                {!isAuthenticated ? (
                  <>
                    <div>
                      <label className="form-label" htmlFor="chat-escalate-name">
                        Name (optional)
                      </label>
                      <input
                        id="chat-escalate-name"
                        type="text"
                        value={escalateName}
                        onChange={(e) => setEscalateName(e.target.value)}
                        className="input-field"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="chat-escalate-email">
                        Email
                      </label>
                      <input
                        id="chat-escalate-email"
                        type="email"
                        required
                        value={escalateEmail}
                        onChange={(e) => setEscalateEmail(e.target.value)}
                        className="input-field"
                        placeholder="you@example.com"
                      />
                    </div>
                  </>
                ) : null}
                <div>
                  <label className="form-label" htmlFor="chat-escalate-message">
                    What do you need help with?
                  </label>
                  <textarea
                    id="chat-escalate-message"
                    required
                    rows={4}
                    value={escalateMessage}
                    onChange={(e) => setEscalateMessage(e.target.value)}
                    className="input-field resize-none"
                    placeholder="Tell us what's going on…"
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setView('chat')}>
                    Back
                  </Button>
                  <Button type="submit" className="flex-1 gap-1.5" disabled={escalating}>
                    {escalating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    Send to support
                  </Button>
                </div>
              </form>
            ) : null}

            {view === 'escalated' ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Headset className="h-6 w-6" aria-hidden />
                </span>
                <p className="text-sm font-semibold text-slate-900">Message sent</p>
                <p className="max-w-[18rem] text-sm text-muted-foreground">{escalateConfirmation}</p>
                <button
                  type="button"
                  onClick={() => setView('chat')}
                  className="link-primary text-sm"
                >
                  Back to chat
                </button>
              </div>
            ) : null}
          </div>

          {/* Footer */}
          {view === 'chat' ? (
            <div className="border-t border-border/50 bg-surface px-3 py-3">
              {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend(input);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message…"
                  className="input-field"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  aria-label="Send"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition hover:bg-primary/90 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" aria-hidden />
                </button>
              </form>
              <button
                type="button"
                onClick={openEscalate}
                className="mt-2 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-primary"
              >
                <Headset className="h-3.5 w-3.5" aria-hidden />
                Talk to a human instead
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
