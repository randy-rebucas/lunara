import type { AuthFormProps } from '@lunara/blocks';

export function AuthFormPreview({ mode, tabs, showTrustBadges, termsText }: AuthFormProps) {
  return (
    <div className="rounded-xl bg-surface p-2 ring-1 ring-border/60">
      {tabs && tabs.length > 1 ? (
        <div className="mb-1 flex gap-2">
          {tabs.map((tab) => (
            <p key={tab} className="text-[7px] font-bold uppercase text-slate-800">{tab}</p>
          ))}
        </div>
      ) : null}
      <div className="rounded-md bg-white px-1.5 py-1 text-[7px] text-muted ring-1 ring-border/60">
        {mode === 'signup' ? 'Mobile number' : 'Mobile number or email'}
      </div>
      <div className="mt-1.5 rounded-md bg-primary py-1 text-center text-[8px] font-semibold text-white">
        {mode === 'signup' ? 'Create account' : 'Continue'}
      </div>
      {showTrustBadges ? <p className="mt-1 text-center text-[7px] text-muted">🔒 Secure</p> : null}
      {termsText ? <p className="mt-0.5 text-center text-[6px] text-muted">{termsText}</p> : null}
    </div>
  );
}
