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
    <ol className="flex items-center justify-center gap-2 text-xs sm:gap-4 sm:text-sm">
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full font-medium ${
                done
                  ? 'bg-accent text-white'
                  : active
                    ? 'bg-primary text-white'
                    : 'bg-slate-200 text-slate-500'
              }`}
            >
              {done ? '✓' : index + 1}
            </span>
            <span className={active ? 'font-medium text-slate-900' : 'text-slate-500'}>{step.label}</span>
            {index < steps.length - 1 && <span className="hidden h-px w-6 bg-slate-200 sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}
