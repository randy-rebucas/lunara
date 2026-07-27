'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, BarChart3, LogOut, MessageSquarePlus, Settings, User, X } from 'lucide-react';
import brandIcon from '@lunara/brand/icon';
import type { AiConversationSummary } from '@lunara/types';
import { getCurrentUser, logout } from '../lib/ai-agents-api';
import { relativeTime } from '../lib/relative-time';

export function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  open,
  onClose,
}: {
  conversations: AiConversationSummary[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  open: boolean;
  onClose: () => void;
}) {
  const role = getCurrentUser()?.role;
  const canSeeStats = role === 'staff' || role === 'admin';

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} aria-hidden />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-72 shrink-0 flex-col border-r border-border bg-surface-muted transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2.5 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <Image src={brandIcon} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-lg" aria-hidden priority />
            <p className="text-sm font-bold tracking-wide text-white">LUNARA AI TEAM</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/10 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="px-3 pb-3">
          <Link href="/" className="btn-ghost w-full justify-start gap-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to team
          </Link>
        </div>

        <div className="px-3">
          <button
            type="button"
            onClick={onNewChat}
            className="btn-outline w-full justify-start gap-2 bg-surface"
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden />
            New chat
          </button>
        </div>

        <div className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          {conversations.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">No conversations yet.</p>
          ) : null}
          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectConversation(c.id)}
              className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                c.id === activeConversationId
                  ? 'bg-primary/15 font-medium text-indigo-300'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <span className="block truncate">{c.title || 'New conversation'}</span>
              <span className="block text-xs text-muted-foreground">{relativeTime(c.updatedAt)}</span>
            </button>
          ))}
        </div>

        <div className="space-y-0.5 border-t border-border px-3 py-3">
          {canSeeStats ? (
            <Link href="/stats" className="btn-ghost w-full justify-start gap-2">
              <BarChart3 className="h-4 w-4" aria-hidden />
              Usage stats
            </Link>
          ) : null}
          <Link href="/profile" className="btn-ghost w-full justify-start gap-2">
            <User className="h-4 w-4" aria-hidden />
            Profile
          </Link>
          <Link href="/settings" className="btn-ghost w-full justify-start gap-2">
            <Settings className="h-4 w-4" aria-hidden />
            Settings
          </Link>
          <button
            type="button"
            onClick={() => logout().then(() => window.location.assign('/login'))}
            className="btn-ghost w-full justify-start gap-2"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
