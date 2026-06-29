'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, MessageAttachment, PartnerConversation } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { PageHeader } from '../../components/ui/page-header';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { resolveApiOrigin } from '@lunara/utils';
import { getPartnerToken, partnerFetch, resolveMediaUrl } from '../../lib/partner-api';
import { useMessagingSocket } from '../../lib/use-messaging-socket';

function MessageBubble({ msg, myId }: { msg: ChatMessage; myId: string }) {
  const isOwn = msg.senderId === myId;
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isOwn
            ? 'rounded-tr-none bg-primary/10 text-slate-900'
            : 'rounded-tl-none bg-surface-muted text-slate-900'
        }`}
      >
        {!isOwn && (
          <p className="mb-1 text-xs font-semibold text-primary">{msg.senderName}</p>
        )}
        {msg.content && <p className="text-sm leading-relaxed">{msg.content}</p>}
        {msg.attachments.map((a) =>
          a.mimeType.startsWith('image/') ? (
            <a key={a.url} href={resolveMediaUrl(a.url)} target="_blank" rel="noreferrer" className="mt-2 block">
              <img
                src={resolveMediaUrl(a.url)}
                alt={a.filename}
                className="max-h-48 w-auto rounded-lg object-cover transition-opacity hover:opacity-90"
              />
            </a>
          ) : (
            <a
              key={a.url}
              href={resolveMediaUrl(a.url)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center gap-2 rounded-lg border border-border/60 bg-white px-3 py-2 text-sm text-primary hover:bg-slate-50"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="truncate">{a.filename}</span>
            </a>
          )
        )}
        <p className={`mt-1 text-[10px] text-muted ${isOwn ? 'text-right' : ''}`}>
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { ready } = useRequirePartner();
  const [conversation, setConversation] = useState<PartnerConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<MessageAttachment | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const myId = (() => {
    try {
      const token = getPartnerToken();
      if (!token) return '';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return (payload.sub as string) ?? '';
    } catch {
      return '';
    }
  })();

  const loadMessages = useCallback(async (convId: string) => {
    const res = await partnerFetch<{ items: ChatMessage[] }>(`/partner/messages/${convId}/messages`);
    setMessages(res.items);
    await partnerFetch(`/partner/messages/${convId}/read`, { method: 'PATCH' });
  }, []);

  useEffect(() => {
    if (!ready) return;
    partnerFetch<PartnerConversation>('/partner/messages')
      .then(async (conv) => {
        setConversation(conv);
        await loadMessages(conv._id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [ready, loadMessages]);

  const messagesLen = messages.length;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: messagesLen <= 1 ? 'instant' : 'smooth' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesLen]);

  useMessagingSocket({
    conversationId: conversation?._id ?? null,
    onNewMessage: (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      if (conversation) {
        void partnerFetch(`/partner/messages/${conversation._id}/read`, { method: 'PATCH' });
      }
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !conversation) return;
    setPendingPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : file.name);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const token = getPartnerToken();
      const apiOrigin = resolveApiOrigin(process.env.NEXT_PUBLIC_API_URL);
      const res = await fetch(`${apiOrigin}/api/v1/partner/messages/${conversation._id}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.message ?? 'Upload failed');
      const att = body.data as MessageAttachment;
      setPendingAttachment(att);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPendingPreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Revoke blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      setPendingPreview((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  function removePending() {
    setPendingAttachment(null);
    if (pendingPreview?.startsWith('blob:')) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(null);
  }

  async function handleSend() {
    if (!conversation) return;
    if (!content.trim() && !pendingAttachment) return;
    setSending(true);
    setError('');
    try {
      const msg = await partnerFetch<ChatMessage>(`/partner/messages/${conversation._id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          attachments: pendingAttachment ? [pendingAttachment] : [],
        }),
      });
      setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
      setContent('');
      removePending();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  if (!ready) return <AuthLoading message="Loading messages…" />;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="shrink-0 px-4 pt-4 sm:px-6">
        <PageHeader
          title="Messages"
          description="Direct support channel with Lunara"
        />
        {error && <div className="alert-error mt-2">{error}</div>}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {!conversation && !error && (
          <p className="text-sm text-muted">Loading conversation…</p>
        )}
        {messages.length === 0 && conversation && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted">No messages yet. Send the first one below.</p>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((msg) => (
            <MessageBubble key={msg._id} msg={msg} myId={myId} />
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Compose bar */}
      <div className="shrink-0 border-t border-border/60 bg-surface px-4 py-3 sm:px-6">
        {/* Attachment preview */}
        {pendingPreview && (
          <div className="mb-2 flex items-center gap-2">
            {pendingPreview.startsWith('blob:') ? (
              <img src={pendingPreview} alt="pending" className="h-16 w-16 rounded-lg object-cover" />
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <svg className="h-4 w-4 shrink-0 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="max-w-[160px] truncate">{pendingPreview}</span>
              </div>
            )}
            <button
              type="button"
              className="rounded-full bg-slate-200 p-1 text-xs text-slate-700 hover:bg-slate-300"
              onClick={removePending}
              aria-label="Remove attachment"
            >
              ✕
            </button>
            {uploading && <span className="text-xs text-muted">Uploading…</span>}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* File picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            disabled={uploading || !conversation}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted transition-colors hover:bg-slate-100 hover:text-primary disabled:opacity-40"
            aria-label="Attach image"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {/* Text input */}
          <textarea
            className="input-field min-h-[2.5rem] max-h-32 flex-1 resize-none py-2"
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            rows={1}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!conversation || sending}
          />

          {/* Send */}
          <button
            type="button"
            disabled={sending || uploading || !conversation || (!content.trim() && !pendingAttachment)}
            className="btn-primary h-10 shrink-0 px-4 disabled:opacity-40"
            onClick={handleSend}
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
