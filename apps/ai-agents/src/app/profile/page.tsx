'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, ShieldCheck, Smartphone } from 'lucide-react';
import type { User } from '@lunara/types';
import { getCurrentUser } from '../../lib/ai-agents-api';
import { AgentAvatar } from '../../components/agent-avatar';

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  return (
    <div className="min-h-dvh bg-surface-muted">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to team
        </Link>

        <h1 className="mb-6 text-lg font-bold text-white">Profile</h1>

        {user ? (
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <AgentAvatar id={user.id} name={user.email ?? user.phone ?? 'U'} size="lg" />
              <div>
                <p className="text-base font-semibold text-white">{user.email ?? user.phone ?? 'Unknown user'}</p>
                <p className="text-sm capitalize text-muted-foreground">{user.role}</p>
              </div>
            </div>

            <dl className="mt-6 space-y-4 border-t border-border pt-5">
              {user.email ? (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <dt className="w-28 text-muted-foreground">Email</dt>
                  <dd className="text-slate-100">{user.email}</dd>
                </div>
              ) : null}
              {user.phone ? (
                <div className="flex items-center gap-3 text-sm">
                  <Smartphone className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <dt className="w-28 text-muted-foreground">Phone</dt>
                  <dd className="text-slate-100">{user.phone}</dd>
                </div>
              ) : null}
              <div className="flex items-center gap-3 text-sm">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
                <dt className="w-28 text-muted-foreground">Status</dt>
                <dd className="text-slate-100">{user.isActive ? 'Active' : 'Inactive'}</dd>
              </div>
              {user.lastLoginAt ? (
                <div className="flex items-center gap-3 text-sm">
                  <span className="h-4 w-4" aria-hidden />
                  <dt className="w-28 text-muted-foreground">Last login</dt>
                  <dd className="text-slate-100">{new Date(user.lastLoginAt).toLocaleString()}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </div>
    </div>
  );
}
