'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { BLOCK_REGISTRY, validateBlockProps, type BlockType } from '@lunara/blocks';
import type { AppBlock } from '@lunara/types';
import { cn } from '@lunara/ui';
import { Card, CardBody } from '../ui/card';

const CANVAS_DROPPABLE_ID = 'screen-canvas';

function isConfigured(block: AppBlock): boolean {
  try {
    validateBlockProps(block.type, block.props);
    return true;
  } catch {
    return false;
  }
}

function BlockRow({
  block,
  selected,
  onSelect,
  onRemove,
}: {
  block: AppBlock;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const definition = BLOCK_REGISTRY[block.type as BlockType] as { label: string } | undefined;
  const configured = isConfigured(block);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5 shadow-sm transition-colors',
        selected ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border/60 hover:border-border',
        isDragging ? 'opacity-50' : '',
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="cursor-grab text-muted-foreground active:cursor-grabbing"
        aria-label="Reorder block"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-slate-900">{definition?.label ?? block.type}</p>
      </button>
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-medium',
          configured ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive',
        )}
      >
        {configured ? 'Configured' : 'Needs setup'}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive"
        aria-label="Remove block"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ScreenCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onRemoveBlock,
  bare,
}: {
  blocks: AppBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onRemoveBlock: (id: string) => void;
  bare?: boolean;
}) {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROPPABLE_ID });

  const dropZone = (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[240px] space-y-2 rounded-lg border-2 border-dashed p-2 transition',
        isOver ? 'border-primary bg-primary/5' : 'border-border/50',
      )}
    >
      <SortableContext items={sorted.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        {sorted.map((block) => (
          <BlockRow
            key={block.id}
            block={block}
            selected={block.id === selectedBlockId}
            onSelect={() => onSelectBlock(block.id)}
            onRemove={() => onRemoveBlock(block.id)}
          />
        ))}
      </SortableContext>
      {sorted.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Drag a block here to get started.</p>
      ) : null}
    </div>
  );

  if (bare) {
    return (
      <div className="flex h-full flex-col">
        <div className="editor-panel-header">Layers</div>
        <div className="editor-scrollbar flex-1 overflow-y-auto p-3">{dropZone}</div>
      </div>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Screen</h3>
        {dropZone}
      </CardBody>
    </Card>
  );
}

export { CANVAS_DROPPABLE_ID };
