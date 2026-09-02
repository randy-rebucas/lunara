import type { ButtonRowProps } from '@lunara/blocks';

export function ButtonRowPreview({ buttons }: ButtonRowProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {buttons.map((button) => (
        <div key={button.id} className="rounded-md bg-primary px-2 py-1 text-[8px] font-semibold text-white">
          {button.label}
        </div>
      ))}
    </div>
  );
}
