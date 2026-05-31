const steps = [
  { key: 'phone', label: 'Phone' },
  { key: 'profile', label: 'Profile' },
  { key: 'address', label: 'Address' },
  { key: 'done', label: 'Done' },
] as const;

export type OnboardingStep = (typeof steps)[number]['key'];

export function OnboardingProgress({ current }: { current: OnboardingStep }) {
  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <ol className="flex items-center justify-center gap-1 text-xs sm:gap-3 sm:text-sm">
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step.key} className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                done
                  ? 'bg-accent text-white'
                  : active
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-200 text-muted'
              }`}
            >
              {done ? '✓' : index + 1}
            </span>
            <span
              className={`hidden sm:inline ${active ? 'font-semibold text-slate-900' : 'text-muted'}`}
            >
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <span
                className={`hidden h-px w-4 sm:block sm:w-6 ${done ? 'bg-accent/40' : 'bg-border'}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
