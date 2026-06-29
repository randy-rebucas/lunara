'use client';

import { useEffect, useState } from 'react';
import type { ChatMessage, RecipientInfo } from '@lunara/types';
import { ConversationPane } from '../../components/conversation-pane';
import { adminFetch } from '../../lib/admin-api';
import { subscribeAdminRealtime } from '../../lib/admin-realtime';

interface ConversationListItem {
  _id: string;
  partnerId: string;
  unreadCount: number;
  lastMessage?: ChatMessage;
  recipient: RecipientInfo;
  updatedAt: string;
}

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<ConversationListItem[]>('/admin/messages')
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .then((data) => { if (data) setConversations(data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Update conversation list in real-time when a new message arrives
    return subscribeAdminRealtime({
      onNewMessage: (msg) => {
        setConversations((prev) =>
          prev.map((c) => {
            if (c._id !== msg.conversationId) return c;
            const isSelected = selectedId === c._id;
            return {
              ...c,
              lastMessage: msg,
              unreadCount: isSelected ? 0 : c.unreadCount + 1,
            };
          })
        );
      },
    });
  }, [selectedId]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header strip */}
      <div className="shrink-0 border-b border-border/60 px-6 py-3">
        <h1 className="text-base font-semibold text-slate-900">Partner messages</h1>
        <p className="text-xs text-muted">Support conversations with partner shops</p>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left: conversation list — always fixed width on sm+; full-width on mobile only when no selection */}
        <div
          className={`shrink-0 overflow-y-auto border-r border-border/60 sm:w-72 lg:w-80 ${
            selectedId ? 'hidden sm:block' : 'w-full'
          }`}
        >
          {loading && (
            <p className="px-5 py-6 text-sm text-muted">Loading conversations…</p>
          )}
          {error && <div className="alert-error mx-5 mt-5">{error}</div>}
          {!loading && conversations.length === 0 && !error && (
            <p className="px-5 py-6 text-sm text-muted">No conversations yet.</p>
          )}

          <div className="divide-y divide-border/40">
            {conversations.map((conv) => {
              const active = conv._id === selectedId;
              return (
                <button
                  key={conv._id}
                  type="button"
                  onClick={() => setSelectedId(conv._id)}
                  className={`w-full px-5 py-4 text-left transition-colors hover:bg-slate-50 ${
                    active ? 'bg-primary/5 hover:bg-primary/8' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                        <span className="truncate">
                          {conv.recipient.branchName ?? 'Partner shop'}
                        </span>
                        {conv.recipient.branchCode && (
                          <span className="font-mono text-xs text-muted">
                            #{conv.recipient.branchCode}
                          </span>
                        )}
                        {conv.unreadCount > 0 && (
                          <span className="inline-flex items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {conv.unreadCount}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {[conv.recipient.email, conv.recipient.city, conv.recipient.province]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {conv.lastMessage ? (
                        <p className="mt-1 truncate text-sm text-muted">
                          <span className="font-medium capitalize">
                            {conv.lastMessage.senderRole}:
                          </span>{' '}
                          {conv.lastMessage.content ||
                            (conv.lastMessage.attachments.length > 0 ? 'Attachment' : '')}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-muted">No messages yet</p>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <p className="shrink-0 text-xs text-muted">
                        {new Date(conv.lastMessage.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: conversation pane */}
        {selectedId ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <ConversationPane
              conversationId={selectedId}
              onBack={() => setSelectedId(null)}
            />
          </div>
        ) : (
          <div className="hidden flex-1 items-center justify-center sm:flex">
            <p className="text-sm text-muted">Select a conversation to view messages</p>
          </div>
        )}
      </div>
    </div>
  );
}
