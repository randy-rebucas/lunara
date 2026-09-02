'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  BannerProps,
  ButtonRowProps,
  FaqProps,
  HeroProps,
  ListProps,
  MapProps,
  ProductGridProps,
  PromoProps,
  TestimonialProps,
} from '@lunara/blocks';
import { BLOCK_REGISTRY, type BlockType } from '@lunara/blocks';
import type { AppBlock } from '@lunara/types';
import { Card, CardBody } from '../ui/card';
import { FormLabel, Input } from '../ui/input';

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <FormLabel>{label}</FormLabel>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function HeroFields({ props, onChange }: { props: HeroProps; onChange: (props: HeroProps) => void }) {
  return (
    <div className="space-y-3">
      <TextField label="Headline" value={props.headline ?? ''} onChange={(v) => onChange({ ...props, headline: v })} />
      <TextField
        label="Subheadline"
        value={props.subheadline ?? ''}
        onChange={(v) => onChange({ ...props, subheadline: v })}
      />
      <TextField
        label="Button label"
        value={props.ctaLabel ?? ''}
        onChange={(v) => onChange({ ...props, ctaLabel: v })}
      />
    </div>
  );
}

function BannerFields({ props, onChange }: { props: BannerProps; onChange: (props: BannerProps) => void }) {
  return (
    <div className="space-y-3">
      <TextField label="Message" value={props.message ?? ''} onChange={(v) => onChange({ ...props, message: v })} />
      <div>
        <FormLabel>Tone</FormLabel>
        <select
          className="input-field"
          value={props.tone}
          onChange={(e) => onChange({ ...props, tone: e.target.value as BannerProps['tone'] })}
        >
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
        </select>
      </div>
    </div>
  );
}

function ListFields({ props, onChange }: { props: ListProps; onChange: (props: ListProps) => void }) {
  return (
    <div className="space-y-3">
      <TextField label="Title" value={props.title ?? ''} onChange={(v) => onChange({ ...props, title: v })} />
      <div className="space-y-2">
        <FormLabel>Items</FormLabel>
        {props.items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2">
            <Input
              value={item.label}
              placeholder="Label"
              onChange={(e) => {
                const items = [...props.items];
                items[i] = { ...item, label: e.target.value };
                onChange({ ...props, items });
              }}
            />
            <button
              type="button"
              onClick={() => onChange({ ...props, items: props.items.filter((_, j) => j !== i) })}
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...props,
              items: [...props.items, { id: crypto.randomUUID(), label: 'New item' }],
            })
          }
          className="flex items-center gap-1.5 text-xs font-medium text-primary"
        >
          <Plus className="h-3.5 w-3.5" /> Add item
        </button>
      </div>
    </div>
  );
}

function ButtonRowFields({
  props,
  onChange,
}: {
  props: ButtonRowProps;
  onChange: (props: ButtonRowProps) => void;
}) {
  return (
    <div className="space-y-2">
      <FormLabel>Buttons</FormLabel>
      {props.buttons.map((button, i) => (
        <div key={button.id} className="flex items-center gap-2">
          <Input
            value={button.label}
            placeholder="Label"
            onChange={(e) => {
              const buttons = [...props.buttons];
              buttons[i] = { ...button, label: e.target.value };
              onChange({ ...props, buttons });
            }}
          />
          <button
            type="button"
            onClick={() => onChange({ ...props, buttons: props.buttons.filter((_, j) => j !== i) })}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Remove button"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({
            ...props,
            buttons: [...props.buttons, { id: crypto.randomUUID(), label: 'New button', action: '' }],
          })
        }
        className="flex items-center gap-1.5 text-xs font-medium text-primary"
      >
        <Plus className="h-3.5 w-3.5" /> Add button
      </button>
    </div>
  );
}

function ProductGridFields({
  props,
  onChange,
}: {
  props: ProductGridProps;
  onChange: (props: ProductGridProps) => void;
}) {
  return (
    <div className="space-y-3">
      <TextField label="Title" value={props.title ?? ''} onChange={(v) => onChange({ ...props, title: v })} />
      <div>
        <FormLabel>Columns</FormLabel>
        <select
          className="input-field"
          value={props.columns}
          onChange={(e) => onChange({ ...props, columns: Number(e.target.value) as 2 | 3 })}
        >
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </div>
      <div className="space-y-2">
        <FormLabel>Items</FormLabel>
        {props.items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2">
            <Input
              value={item.name}
              placeholder="Name"
              onChange={(e) => {
                const items = [...props.items];
                items[i] = { ...item, name: e.target.value };
                onChange({ ...props, items });
              }}
            />
            <Input
              value={item.price ?? ''}
              placeholder="Price"
              className="w-24"
              onChange={(e) => {
                const items = [...props.items];
                items[i] = { ...item, price: e.target.value };
                onChange({ ...props, items });
              }}
            />
            <button
              type="button"
              onClick={() => onChange({ ...props, items: props.items.filter((_, j) => j !== i) })}
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...props,
              items: [...props.items, { id: crypto.randomUUID(), name: 'New item' }],
            })
          }
          className="flex items-center gap-1.5 text-xs font-medium text-primary"
        >
          <Plus className="h-3.5 w-3.5" /> Add item
        </button>
      </div>
    </div>
  );
}

function TestimonialFields({
  props,
  onChange,
}: {
  props: TestimonialProps;
  onChange: (props: TestimonialProps) => void;
}) {
  return (
    <div className="space-y-3">
      <TextField label="Quote" value={props.quote ?? ''} onChange={(v) => onChange({ ...props, quote: v })} />
      <TextField
        label="Author name"
        value={props.authorName ?? ''}
        onChange={(v) => onChange({ ...props, authorName: v })}
      />
      <TextField
        label="Author role"
        value={props.authorRole ?? ''}
        onChange={(v) => onChange({ ...props, authorRole: v })}
      />
    </div>
  );
}

function FaqFields({ props, onChange }: { props: FaqProps; onChange: (props: FaqProps) => void }) {
  return (
    <div className="space-y-3">
      <TextField label="Title" value={props.title ?? ''} onChange={(v) => onChange({ ...props, title: v })} />
      <div className="space-y-2">
        <FormLabel>Questions</FormLabel>
        {props.items.map((item, i) => (
          <div key={item.id} className="space-y-1 rounded-md border border-border/60 p-2">
            <div className="flex items-center gap-2">
              <Input
                value={item.question}
                placeholder="Question"
                onChange={(e) => {
                  const items = [...props.items];
                  items[i] = { ...item, question: e.target.value };
                  onChange({ ...props, items });
                }}
              />
              <button
                type="button"
                onClick={() => onChange({ ...props, items: props.items.filter((_, j) => j !== i) })}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Remove question"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <Input
              value={item.answer}
              placeholder="Answer"
              onChange={(e) => {
                const items = [...props.items];
                items[i] = { ...item, answer: e.target.value };
                onChange({ ...props, items });
              }}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...props,
              items: [...props.items, { id: crypto.randomUUID(), question: 'New question', answer: '' }],
            })
          }
          className="flex items-center gap-1.5 text-xs font-medium text-primary"
        >
          <Plus className="h-3.5 w-3.5" /> Add question
        </button>
      </div>
    </div>
  );
}

function MapFields({ props, onChange }: { props: MapProps; onChange: (props: MapProps) => void }) {
  return (
    <div className="space-y-3">
      <TextField label="Title" value={props.title ?? ''} onChange={(v) => onChange({ ...props, title: v })} />
      <TextField label="Address" value={props.address ?? ''} onChange={(v) => onChange({ ...props, address: v })} />
    </div>
  );
}

const HANDLED_TYPES = new Set([
  'hero',
  'banner',
  'list',
  'button-row',
  'product-grid',
  'testimonial',
  'faq',
  'map',
  'promo',
]);

/** Generic fallback editor for block types that don't yet have bespoke fields above.
 *  Exposes the raw props as editable JSON so every registered block type is still
 *  configurable — bespoke per-field UIs can be added incrementally later. */
function GenericJsonFields({
  props,
  onChange,
}: {
  props: Record<string, unknown>;
  onChange: (props: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(props, null, 2));
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <FormLabel>Props (JSON)</FormLabel>
      <textarea
        className="input-field h-48 w-full font-mono text-xs"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value);
            setError(null);
            onChange(parsed);
          } catch {
            setError('Invalid JSON');
          }
        }}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function PromoFields({ props, onChange }: { props: PromoProps; onChange: (props: PromoProps) => void }) {
  return (
    <div className="space-y-3">
      <TextField label="Title" value={props.title ?? ''} onChange={(v) => onChange({ ...props, title: v })} />
      <TextField
        label="Description"
        value={props.description ?? ''}
        onChange={(v) => onChange({ ...props, description: v })}
      />
      <TextField label="Code" value={props.code ?? ''} onChange={(v) => onChange({ ...props, code: v })} />
    </div>
  );
}

function ConfigFields({ block, onChange }: { block: AppBlock; onChange: (props: Record<string, unknown>) => void }) {
  return (
    <>
      {block.type === 'hero' && (
        <HeroFields props={block.props as HeroProps} onChange={(p) => onChange(p)} />
      )}
      {block.type === 'banner' && (
        <BannerFields props={block.props as BannerProps} onChange={(p) => onChange(p)} />
      )}
      {block.type === 'list' && <ListFields props={block.props as ListProps} onChange={(p) => onChange(p)} />}
      {block.type === 'button-row' && (
        <ButtonRowFields props={block.props as ButtonRowProps} onChange={(p) => onChange(p)} />
      )}
      {block.type === 'product-grid' && (
        <ProductGridFields props={block.props as ProductGridProps} onChange={(p) => onChange(p)} />
      )}
      {block.type === 'testimonial' && (
        <TestimonialFields props={block.props as TestimonialProps} onChange={(p) => onChange(p)} />
      )}
      {block.type === 'faq' && <FaqFields props={block.props as FaqProps} onChange={(p) => onChange(p)} />}
      {block.type === 'map' && <MapFields props={block.props as MapProps} onChange={(p) => onChange(p)} />}
      {block.type === 'promo' && <PromoFields props={block.props as PromoProps} onChange={(p) => onChange(p)} />}
      {!HANDLED_TYPES.has(block.type) && (
        <GenericJsonFields props={block.props} onChange={(p) => onChange(p)} />
      )}
    </>
  );
}

export function BlockConfigPanel({
  block,
  onChange,
  bare,
}: {
  block: AppBlock | null;
  onChange: (props: Record<string, unknown>) => void;
  bare?: boolean;
}) {
  const definition = block ? BLOCK_REGISTRY[block.type as BlockType] : null;

  if (bare) {
    return (
      <div className="flex h-full flex-col">
        <div className="editor-panel-header">
          {block ? `Configure — ${definition?.label ?? block.type}` : 'Configure'}
        </div>
        <div className="editor-scrollbar flex-1 overflow-y-auto p-3">
          {block ? (
            <div className="space-y-4">
              <ConfigFields block={block} onChange={onChange} />
            </div>
          ) : (
            <p className="text-sm text-muted">Select a block on the canvas to edit its content.</p>
          )}
        </div>
      </div>
    );
  }

  if (!block) {
    return (
      <Card>
        <CardBody>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Configure</h3>
          <p className="mt-3 text-sm text-muted">Select a block in the canvas to edit its content.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Configure — {definition?.label ?? block.type}
        </h3>
        <ConfigFields block={block} onChange={onChange} />
      </CardBody>
    </Card>
  );
}
