import type { StepperProgressProps } from '@lunara/blocks';

export function StepperProgressPreview({ steps, currentStep }: StepperProgressProps) {
  return (
    <div>
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={step} className="flex flex-1 items-center gap-1">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${i <= currentStep ? 'bg-primary' : 'bg-border'}`} />
            {i < steps.length - 1 ? (
              <span className={`h-px flex-1 ${i < currentStep ? 'bg-primary' : 'bg-border'}`} />
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-1 text-center text-[8px] font-semibold text-slate-900">{steps[currentStep]}</p>
    </div>
  );
}
