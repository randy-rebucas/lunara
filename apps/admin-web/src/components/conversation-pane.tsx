'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, ConversationDetail, MessageAttachment } from '@lunara/types';
import { resolveApiOrigin } from '@lunara/utils';
import { adminFetch, adminUpload } from '../lib/admin-api';
import { joinAdminConversation, leaveAdminConversation, subscribeAdminRealtime } from '../lib/admin-realtime';
import { AuthenticatedImage } from './authenticated-image';

function resolveImgUrl(url: string) {
  if (!url || url.startsWith('http')) return url;
  const origin = resolveApiOrigin(process.env.NEXT_PUBLIC_API_URL);
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isAdmin = msg.senderRole === 'admin';
  return (
    <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isAdmin
            ? 'rounded-tr-none bg-primary/10 text-slate-900'
            : 'rounded-tl-none bg-surface-muted text-slate-900'
        }`}
      >
        {!isAdmin && (
          <p className="mb-1 text-xs font-semibold text-primary">{msg.senderName}</p>
        )}
        {msg.content && <p className="text-sm leading-relaxed">{msg.content}</p>}
        {msg.attachments.map((a) =>
          a.mimeType.startsWith('image/') ? (
            <a key={a.url} href={resolveImgUrl(a.url)} target="_blank" rel="noreferrer" className="mt-2 block">
              <AuthenticatedImage
                publicPath={a.url}
                alt={a.filename}
                className="max-h-48 w-auto rounded-lg object-cover transition-opacity hover:opacity-90"
              />
            </a>
          ) : (
            <a
              key={a.url}
              href={resolveImgUrl(a.url)}
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
        <p className={`mt-1 text-[10px] text-muted ${isAdmin ? 'text-right' : ''}`}>
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

interface ConversationPaneProps {
  conversationId: string;
  onBack?: () => void;
}

export function ConversationPane({ conversationId, onBack }: ConversationPaneProps) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<MessageAttachment | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDetail(null);
    setMessages([]);
    setError('');
    setContent('');
    setPendingAttachment(null);
    // Revoke any pending blob URL when switching conversations
    setPendingPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });

    adminFetch<ConversationDetail>(`/admin/messages/${conversationId}`)
      .then((d) => setDetail(d))
      .catch(() => {});
    adminFetch<{ items: ChatMessage[] }>(`/admin/messages/${conversationId}/messages`)
      .then((res) => setMessages(res.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));

    adminFetch(`/admin/messages/${conversationId}/read`, { method: 'PATCH' }).catch(() => {});

    joinAdminConversation(conversationId);

    const unsub = subscribeAdminRealtime({
      onNewMessage: (msg) => {
        if (msg.conversationId !== conversationId) return;
        setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
        adminFetch(`/admin/messages/${conversationId}/read`, { method: 'PATCH' }).catch(() => {});
      },
    });
    return () => {
      unsub();
      leaveAdminConversation(conversationId);
    };
  }, [conversationId]);

  // Scroll to bottom on initial load and on new messages
  const messagesLen = messages.length;
  const hasDetail = !!detail;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: messagesLen <= 1 ? 'instant' : 'smooth' });
  }, [messagesLen, hasDetail]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : file.name);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const att = await adminUpload<MessageAttachment>(`/admin/messages/${conversationId}/upload`, form);
      setPendingAttachment(att);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPendingPreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removePending() {
    setPendingAttachment(null);
    if (pendingPreview?.startsWith('blob:')) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(null);
  }

  async function handleSend() {
    if (!content.trim() && !pendingAttachment) return;
    setSending(true);
    setError('');
    try {
      const msg = await adminFetch<ChatMessage>(`/admin/messages/${conversationId}/send`, {
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

  return (
    <div className="flex h-full flex-col">
      {/* Inline header */}
      <div className="shrink-0 border-b border-border/60 px-5 py-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-slate-900 sm:hidden"
              aria-label="Back to list"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">
              {detail?.recipient.branchName ?? '…'}
              {detail?.recipient.branchCode && (
                <span className="ml-2 font-mono text-xs font-normal text-muted">
                  #{detail.recipient.branchCode}
                </span>
              )}
            </p>
            <p className="truncate text-xs text-muted">
              {[detail?.recipient.email, detail?.recipient.city, detail?.recipient.province]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
        {error && <div className="alert-error mt-2">{error}</div>}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted">No messages yet.</p>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((msg) => (
            <MessageBubble key={msg._id} msg={msg} />
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Compose bar */}
      <div className="shrink-0 border-t border-border/60 bg-surface px-4 py-3">
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            disabled={uploading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted transition-colors hover:bg-slate-100 hover:text-primary disabled:opacity-40"
            aria-label="Attach file"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          <textarea
            className="input-field min-h-[2.5rem] max-h-32 flex-1 resize-none py-2"
            placeholder="Reply as Lunara support… (Enter to send)"
            rows={1}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />

          <button
            type="button"
            disabled={sending || uploading || (!content.trim() && !pendingAttachment)}
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
