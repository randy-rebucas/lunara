'use client';

import { useEffect, useRef, useState } from 'react';
import { Lock, Mail, X } from 'lucide-react';
import { Button } from '@lunara/ui';
import { Card, CardBody } from '../ui/card';
import { FormLabel, Input } from '../ui/input';
import { getFriendlyErrorMessage } from '../../lib/format-error';

export function ClaimModal({
  brandName,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  brandName: string;
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: { email: string; password: string }) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-modal-title"
    >
      <Card elevated className="w-full max-w-sm">
        <CardBody className="space-y-4">
          <div className="flex items-start justify-between">
            <h2 id="claim-modal-title" className="text-lg font-semibold text-slate-900">
              Save your design
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-muted-foreground hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-muted">
            Create a free account to save {brandName || 'your'} app design and keep editing it later.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit({ email, password });
            }}
            className="space-y-3"
          >
            <div>
              <FormLabel htmlFor="claim-email">Email</FormLabel>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={emailRef}
                  id="claim-email"
                  type="email"
                  required
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <FormLabel htmlFor="claim-password">Password</FormLabel>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="claim-password"
                  type="password"
                  required
                  minLength={8}
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted">At least 8 characters.</p>
            </div>
            {error && <p className="text-sm text-destructive">{getFriendlyErrorMessage(new Error(error), error)}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Saving…' : 'Create account & save'}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
