'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChatMessage, ConversationDetail, RecipientInfo } from '@lunara/types';
import { ConversationPane } from '../conversation-pane';
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

type Tab = 'all' | 'unread';

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'P';
}

function timeAgo(iso?: string) {
  if (!iso) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'now';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 px-5 py-4 first:border-0">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 break-all text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function MessagesBoard() {
  const [conversations, setConversations] = useState<ConversationListItem[] | null>(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<ConversationDetail | null>(null);

  const load = useCallback(() => {
    adminFetch<ConversationListItem[]>('/admin/messages')
      .then(setConversations)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load conversations'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return subscribeAdminRealtime({
      onNewMessage: (msg) => {
        setConversations((prev) =>
          (prev ?? []).map((c) => {
            if (c._id !== msg.conversationId) return c;
            const isSelected = selectedId === c._id;
            return {
              ...c,
              lastMessage: msg,
              unreadCount: isSelected ? 0 : c.unreadCount + 1,
              updatedAt: msg.createdAt,
            };
          }),
        );
      },
    });
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    adminFetch<ConversationDetail>(`/admin/messages/${selectedId}`)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const items = useMemo(() => conversations ?? [], [conversations]);
  const unreadCount = items.filter((c) => c.unreadCount > 0).length;

  const filtered = useMemo(() => {
    let list = items;
    if (tab === 'unread') list = list.filter((c) => c.unreadCount > 0);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        [c.recipient.branchName, c.recipient.branchCode, c.recipient.email, c.recipient.city]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q)),
      );
    }
    return [...list].sort(
      (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
    );
  }, [items, tab, search]);

  const selected = items.find((c) => c._id === selectedId) ?? null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-border/60 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="dc-eyebrow">Communication</p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">Messaging</h1>
            <p className="mt-0.5 text-xs text-muted">Support conversations with partner laundry shops.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="dc-chip rounded-md border border-border/80 px-2.5 py-1">
              {items.length} conversation{items.length === 1 ? '' : 's'}
            </span>
            {unreadCount > 0 ? <span className="badge-primary">{unreadCount} unread</span> : null}
            <button type="button" className="btn-outline btn-sm" onClick={load}>
              Sync
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="alert-error m-4" role="alert">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* Conversation list */}
        <div
          className={`shrink-0 flex-col overflow-hidden border-r border-border/60 sm:w-80 ${
            selectedId ? 'hidden sm:flex' : 'flex w-full'
          }`}
        >
          <div className="shrink-0 space-y-2 border-b border-border/60 p-3">
            <input
              type="search"
              className="input-field text-sm"
              placeholder="Search shop, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search conversations"
            />
            <div className="flex gap-1">
              {(['all', 'unread'] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    tab === t ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-slate-100'
                  }`}
                >
                  {t === 'all' ? `All ${items.length}` : `Unread ${unreadCount}`}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations === null ? (
              <p className="px-5 py-6 text-sm text-muted">Loading conversations…</p>
            ) : filtered.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">
                {search || tab === 'unread' ? 'No matching conversations.' : 'No conversations yet.'}
              </p>
            ) : (
              <ul className="divide-y divide-border/40">
                {filtered.map((c) => {
                  const active = c._id === selectedId;
                  const name = c.recipient.branchName ?? 'Partner shop';
                  return (
                    <li key={c._id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(c._id)}
                        aria-current={active}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                          active ? 'bg-primary/5 hover:bg-primary/5' : ''
                        }`}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-sm font-semibold text-blue-600">
                          {initials(name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-slate-900">{name}</span>
                            <span className="shrink-0 text-[11px] text-muted">
                              {timeAgo(c.lastMessage?.createdAt ?? c.updatedAt)}
                            </span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5">
                            <span className="truncate text-xs text-muted">
                              {c.lastMessage
                                ? c.lastMessage.content ||
                                  (c.lastMessage.attachments.length > 0 ? 'Sent an attachment' : '')
                                : 'No messages yet'}
                            </span>
                            {c.unreadCount > 0 ? (
                              <span className="ml-auto inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                                {c.unreadCount}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Chat pane */}
        {selectedId ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <ConversationPane conversationId={selectedId} onBack={() => setSelectedId(null)} />
          </div>
        ) : (
          <div className="hidden flex-1 items-center justify-center sm:flex">
            <div className="text-center">
              <p className="text-sm font-medium text-slate-900">Select a conversation</p>
              <p className="mt-1 text-sm text-muted">Choose a partner shop from the list to view messages.</p>
            </div>
          </div>
        )}

        {/* Details rail */}
        {selected ? (
          <div className="hidden w-72 shrink-0 overflow-y-auto border-l border-border/60 xl:block">
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-lg font-semibold text-blue-600">
                {initials(selected.recipient.branchName ?? 'Partner shop')}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {selected.recipient.branchName ?? 'Partner shop'}
                </p>
                {selected.recipient.branchCode ? (
                  <p className="text-code text-xs text-muted">{selected.recipient.branchCode}</p>
                ) : null}
              </div>
            </div>

            <RailSection title="Contact">
              <RailRow
                label="Email"
                value={
                  selected.recipient.email ? (
                    <a href={`mailto:${selected.recipient.email}`} className="link-primary">
                      {selected.recipient.email}
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
              <RailRow
                label="Phone"
                value={
                  selected.recipient.phone ? (
                    <a href={`tel:${selected.recipient.phone}`} className="link-primary">
                      {selected.recipient.phone}
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
            </RailSection>

            <RailSection title="Location">
              <RailRow label="Address" value={selected.recipient.line1 ?? '—'} />
              <RailRow
                label="City"
                value={
                  [selected.recipient.city, selected.recipient.province].filter(Boolean).join(', ') || '—'
                }
              />
            </RailSection>

            <RailSection title="Conversation">
              <RailRow label="Started" value={detail ? new Date(detail.createdAt).toLocaleDateString() : '—'} />
              <RailRow label="Unread" value={selected.unreadCount} />
            </RailSection>

            <div className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-4">
              <Link href="/partners" className="btn-outline btn-sm flex-1 text-center">
                Shop directory
              </Link>
              <Link href="/partners/settlements" className="btn-outline btn-sm flex-1 text-center">
                Settlements
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
