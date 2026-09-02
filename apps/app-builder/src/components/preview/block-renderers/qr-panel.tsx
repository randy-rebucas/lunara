import type { QrPanelProps } from '@lunara/blocks';

export function QrPanelPreview({ mode, instructions, code }: QrPanelProps) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-surface p-2 ring-1 ring-border/60">
      <div className="h-10 w-10 rounded-md bg-slate-900" />
      {code ? <p className="text-[8px] font-bold text-slate-900">{code}</p> : null}
      {instructions ? <p className="text-center text-[7px] text-muted">{instructions}</p> : null}
      <p className="text-[7px] uppercase text-muted">{mode}</p>
    </div>
  );
}
