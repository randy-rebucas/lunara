'use client';

import { useDraggable } from '@dnd-kit/core';
import {
  Megaphone,
  List,
  MousePointerClick,
  Sparkles,
  ShoppingBag,
  Quote,
  HelpCircle,
  MapPin,
  Percent,
  type LucideIcon,
} from 'lucide-react';
import { BLOCK_REGISTRY, type BlockType } from '@lunara/blocks';
import { Card, CardBody } from '../ui/card';

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  List,
  Megaphone,
  MousePointerClick,
  ShoppingBag,
  Quote,
  HelpCircle,
  MapPin,
  Percent,
};

function PaletteItem({ type }: { type: BlockType }) {
  const definition = BLOCK_REGISTRY[type];
  const Icon = ICONS[definition.icon] ?? Sparkles;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { source: 'palette', blockType: type },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      className={`flex w-full items-center gap-2.5 rounded-lg border border-border/60 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-900 shadow-sm transition hover:border-primary/40 hover:bg-primary/5 ${isDragging ? 'opacity-40' : ''}`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {definition.label}
    </button>
  );
}

function PaletteBody() {
  return (
    <>
      <div className="space-y-2">
        {(Object.keys(BLOCK_REGISTRY) as BlockType[]).map((type) => (
          <PaletteItem key={type} type={type} />
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Drag a block onto the canvas, then configure it on the right.
      </p>
    </>
  );
}

export function BlockPalette({ bare }: { bare?: boolean } = {}) {
  if (bare) {
    return (
      <div className="flex h-full flex-col">
        <div className="editor-panel-header">Blocks</div>
        <div className="editor-scrollbar flex-1 overflow-y-auto p-3">
          <PaletteBody />
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Blocks</h3>
        <PaletteBody />
      </CardBody>
    </Card>
  );
}
