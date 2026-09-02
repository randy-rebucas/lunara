import type { FormCardProps } from '@lunara/blocks';

export function FormCardPreview({ title, description, fields, submitLabel }: FormCardProps) {
  return (
    <div className="rounded-xl bg-surface p-2 ring-1 ring-border/60">
      {title ? <p className="text-[9px] font-semibold text-slate-900">{title}</p> : null}
      {description ? <p className="mb-1 text-[8px] text-muted">{description}</p> : null}
      <div className="space-y-1">
        {fields.map((field) => (
          <div key={field.id} className="rounded-md bg-white px-1.5 py-1 ring-1 ring-border/60">
            <p className="text-[7px] text-muted">{field.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-1.5 rounded-md bg-primary py-1 text-center text-[8px] font-semibold text-white">
        {submitLabel}
      </div>
    </div>
  );
}
