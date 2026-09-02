'use client';

import {
  Check,
  Home,
  Package,
  Percent,
  UserCircle,
  HelpCircle,
  KeyRound,
  type LucideIcon,
} from 'lucide-react';
import { BLOCK_REGISTRY } from '@lunara/blocks';
import { cn } from '@lunara/ui';
import { SCREEN_TEMPLATES, type ScreenTemplate } from '../../lib/screen-templates';

const ICONS: Record<string, LucideIcon> = {
  Home,
  Package,
  Percent,
  UserCircle,
  HelpCircle,
  KeyRound,
};

function TemplateCard({
  template,
  selected,
  onToggle,
}: {
  template: ScreenTemplate;
  selected: boolean;
  onToggle: () => void;
}) {
  const Icon = ICONS[template.icon] ?? Home;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition',
        selected ? 'border-primary ring-2 ring-primary/25' : 'border-border/60 hover:border-primary/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
            selected ? 'border-primary bg-primary text-white' : 'border-border/70 text-transparent',
          )}
        >
          <Check className="h-3 w-3" />
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{template.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{template.description}</p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {template.blocks.map((b) => BLOCK_REGISTRY[b.type].label).join(' · ')}
      </p>
    </button>
  );
}

export function ScreenTemplatePicker({
  selectedKeys,
  onToggle,
  excludeKeys,
}: {
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
  excludeKeys?: string[];
}) {
  const templates = excludeKeys?.length
    ? SCREEN_TEMPLATES.filter((t) => !excludeKeys.includes(t.key))
    : SCREEN_TEMPLATES;

  if (templates.length === 0) {
    return <p className="text-sm text-muted">Every available screen is already in your app.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {templates.map((template) => (
        <TemplateCard
          key={template.key}
          template={template}
          selected={selectedKeys.has(template.key)}
          onToggle={() => onToggle(template.key)}
        />
      ))}
    </div>
  );
}
