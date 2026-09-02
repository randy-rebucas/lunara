'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ChevronDown, ChevronLeft, CloudUpload, Palette, Save } from 'lucide-react';
import { BLOCK_REGISTRY, type BlockType } from '@lunara/blocks';
import type { AppBlock, AppNavStyle, AppScreen } from '@lunara/types';
import { Button, cn } from '@lunara/ui';
import { useAnonymousDraft } from '../lib/use-anonymous-draft';
import { useBrandSession } from '../lib/use-brand-session';
import { claimDesign } from '../lib/app-config-api';
import { getFriendlyErrorMessage } from '../lib/format-error';
import { deriveTheme } from '../lib/derive-theme';
import { extractLogoColors } from '../lib/extract-logo-colors';
import { buildScreenFromTemplate, SCREEN_TEMPLATES } from '../lib/screen-templates';
import { Card, CardBody } from '../components/ui/card';
import { DocumentUploadField } from '../components/ui/document-upload-field';
import { FormLabel, Input } from '../components/ui/input';
import { BlockPalette } from '../components/builder/block-palette';
import { ScreenCanvas, CANVAS_DROPPABLE_ID } from '../components/builder/screen-canvas';
import { BlockConfigPanel } from '../components/builder/block-config-panel';
import { LivePreviewPanel } from '../components/builder/live-preview-panel';
import { ClaimModal } from '../components/builder/claim-modal';
import { ScreenTemplatePicker } from '../components/builder/screen-template-picker';
import { ScreenTabs } from '../components/builder/screen-tabs';
import { AddScreenModal } from '../components/builder/add-screen-modal';
import { NavStyleControl } from '../components/builder/nav-style-control';

const COLOR_FIELDS = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'accent', label: 'Accent' },
] as const;

function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2].map((n) => (
        <span
          key={n}
          className={cn('h-1.5 rounded-full transition-all', n === step ? 'w-6 bg-primary' : 'w-1.5 bg-border')}
        />
      ))}
    </div>
  );
}

export default function AppBuilderPage() {
  const router = useRouter();
  const { draft, setDraft, loaded, clearDraft } = useAnonymousDraft();
  const { setBrandSession } = useBrandSession();

  const [step, setStep] = useState<'brand' | 'screens' | 'editor' | null>(null);
  const [selectedTemplateKeys, setSelectedTemplateKeys] = useState<Set<string>>(new Set(['home']));
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);
  const [showAddScreenModal, setShowAddScreenModal] = useState(false);
  const [brandPanelOpen, setBrandPanelOpen] = useState(false);
  const brandPanelRef = useRef<HTMLDivElement>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    if (!loaded || step !== null) return;
    setStep(draft.wizardCompleted && draft.screens.length > 0 ? 'editor' : 'brand');
    if (draft.screens.length > 0) setActiveScreenId(draft.screens[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => {
    if (!brandPanelOpen) return;
    function handleClick(e: MouseEvent) {
      if (brandPanelRef.current && !brandPanelRef.current.contains(e.target as Node)) {
        setBrandPanelOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [brandPanelOpen]);

  const activeScreen = draft.screens.find((s) => s.id === activeScreenId) ?? null;
  const selectedBlock = activeScreen?.blocks.find((b) => b.id === selectedBlockId) ?? null;

  async function handleLogoChange(file: File | null) {
    setLogoFile(file);
    if (!file) return;
    try {
      const extracted = await extractLogoColors(file);
      setDraft((d) => ({ ...d, theme: deriveTheme(extracted) }));
    } catch {
      // extraction is best-effort — keep whatever theme is already set
    }
  }

  function updateColor(key: 'primary' | 'secondary' | 'accent', value: string) {
    setDraft((d) => ({
      ...d,
      theme: deriveTheme({ ...d.theme, [key]: value }),
    }));
  }

  function updateNavStyle(navStyle: AppNavStyle) {
    setDraft((d) => ({ ...d, navStyle }));
  }

  function updateScreen(screenId: string, updater: (screen: AppScreen) => AppScreen) {
    setDraft((d) => ({ ...d, screens: d.screens.map((s) => (s.id === screenId ? updater(s) : s)) }));
  }

  function toggleTemplate(key: string) {
    setSelectedTemplateKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleConfirmScreens() {
    const built = SCREEN_TEMPLATES.filter((t) => selectedTemplateKeys.has(t.key)).map(buildScreenFromTemplate);
    setDraft((d) => ({ ...d, screens: built, wizardCompleted: true }));
    setActiveScreenId(built[0]?.id ?? null);
    setStep('editor');
  }

  function handleAddScreens(keys: string[]) {
    const newScreens = SCREEN_TEMPLATES.filter((t) => keys.includes(t.key)).map(buildScreenFromTemplate);
    setDraft((d) => ({ ...d, screens: [...d.screens, ...newScreens] }));
    setActiveScreenId(newScreens[0]?.id ?? activeScreenId);
    setShowAddScreenModal(false);
  }

  function handleRemoveScreen(screenId: string) {
    setDraft((d) => ({ ...d, screens: d.screens.filter((s) => s.id !== screenId) }));
    if (activeScreenId === screenId) {
      const remaining = draft.screens.filter((s) => s.id !== screenId);
      setActiveScreenId(remaining[0]?.id ?? null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !activeScreen) return;

    const activeData = active.data.current as { source?: string; blockType?: BlockType } | undefined;

    if (activeData?.source === 'palette' && activeData.blockType) {
      const definition = BLOCK_REGISTRY[activeData.blockType];
      const newBlock: AppBlock = {
        id: crypto.randomUUID(),
        type: activeData.blockType,
        order: activeScreen.blocks.length,
        props: definition.defaultProps,
      };
      updateScreen(activeScreen.id, (s) => ({ ...s, blocks: [...s.blocks, newBlock] }));
      setSelectedBlockId(newBlock.id);
      return;
    }

    if (active.id !== over.id && over.id !== CANVAS_DROPPABLE_ID) {
      const sorted = [...activeScreen.blocks].sort((a, b) => a.order - b.order);
      const oldIndex = sorted.findIndex((b) => b.id === active.id);
      const newIndex = sorted.findIndex((b) => b.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(sorted, oldIndex, newIndex).map((b, i) => ({ ...b, order: i }));
      updateScreen(activeScreen.id, (s) => ({ ...s, blocks: reordered }));
    }
  }

  function handleRemoveBlock(blockId: string) {
    if (!activeScreen) return;
    updateScreen(activeScreen.id, (s) => ({
      ...s,
      blocks: s.blocks.filter((b) => b.id !== blockId).map((b, i) => ({ ...b, order: i })),
    }));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  }

  function handleBlockPropsChange(props: Record<string, unknown>) {
    if (!activeScreen || !selectedBlockId) return;
    updateScreen(activeScreen.id, (s) => ({
      ...s,
      blocks: s.blocks.map((b) => (b.id === selectedBlockId ? { ...b, props } : b)),
    }));
  }

  async function handleClaim(values: { email: string; password: string }) {
    setClaiming(true);
    setClaimError('');
    try {
      const result = await claimDesign({
        email: values.email,
        password: values.password,
        brandName: draft.brandName || 'My App',
        theme: draft.theme,
        screens: draft.screens,
        navStyle: draft.navStyle,
      });
      setBrandSession({ token: result.tokens.accessToken, email: result.user.email });
      clearDraft();
      router.push('/my-app');
    } catch (err) {
      setClaimError(getFriendlyErrorMessage(err, 'Failed to save your design. Please try again.'));
    } finally {
      setClaiming(false);
    }
  }

  if (!loaded || step === null) return null;

  const brandFields = (
    <div className="space-y-4">
      <div>
        <FormLabel htmlFor="brandName">Brand name</FormLabel>
        <Input
          id="brandName"
          value={draft.brandName}
          onChange={(e) => setDraft((d) => ({ ...d, brandName: e.target.value }))}
          placeholder="e.g. Sparkle Laundry"
        />
      </div>
      <DocumentUploadField label="Logo (optional)" file={logoFile} onChange={handleLogoChange} />
      <div className="grid grid-cols-3 gap-2">
        {COLOR_FIELDS.map(({ key, label }) => (
          <div key={key}>
            <FormLabel htmlFor={`color-${key}`}>{label}</FormLabel>
            <input
              id={`color-${key}`}
              type="color"
              value={draft.theme[key]}
              onChange={(e) => updateColor(key, e.target.value)}
              className="h-9 w-full cursor-pointer rounded-md border border-border/60 bg-transparent p-0.5"
            />
          </div>
        ))}
      </div>
      <NavStyleControl value={draft.navStyle} onChange={updateNavStyle} />
    </div>
  );

  if (step === 'brand') {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-16">
        <div className="w-full max-w-md space-y-6">
          <StepDots step={1} />
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Design your app</h1>
            <p className="mt-2 text-sm text-muted">
              Start with your brand — upload a logo and we&apos;ll pick up your colors automatically.
            </p>
          </div>
          <Card elevated>
            <CardBody className="space-y-5">
              {brandFields}
              <Button className="w-full" onClick={() => setStep('screens')} disabled={!draft.brandName.trim()}>
                Continue
              </Button>
            </CardBody>
          </Card>
        </div>
      </main>
    );
  }

  if (step === 'screens') {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="space-y-6">
          <StepDots step={2} />
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Choose your screens</h1>
            <p className="mt-2 text-sm text-muted">
              Pick the screens you want in {draft.brandName || 'your'} app. You can add more later.
            </p>
          </div>
          <ScreenTemplatePicker selectedKeys={selectedTemplateKeys} onToggle={toggleTemplate} />
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setStep('brand')}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={handleConfirmScreens} disabled={selectedTemplateKeys.size === 0}>
              Continue with {selectedTemplateKeys.size} screen{selectedTemplateKeys.size === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-surface-muted">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-sm font-semibold text-slate-900">
            {draft.brandName || 'My App'}
          </h1>
          <span className="flex items-center gap-1 text-xs text-muted">
            <CloudUpload className="h-3 w-3" /> Saved locally
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div ref={brandPanelRef} className="relative">
            <Button variant="outline" size="sm" onClick={() => setBrandPanelOpen((v) => !v)}>
              <Palette className="h-4 w-4" />
              Brand
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', brandPanelOpen && 'rotate-180')} />
            </Button>
            {brandPanelOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl bg-surface p-4 shadow-elevated ring-1 ring-border/60">
                {brandFields}
              </div>
            )}
          </div>
          <Button size="sm" onClick={() => setShowClaimModal(true)}>
            <Save className="h-4 w-4" />
            Save my design
          </Button>
        </div>
      </header>

      <ScreenTabs
        screens={draft.screens}
        activeScreenId={activeScreenId}
        onSelect={setActiveScreenId}
        onRemove={handleRemoveScreen}
        onAddScreen={() => setShowAddScreenModal(true)}
      />

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-60 shrink-0 border-r border-border bg-surface">
            <BlockPalette bare />
          </aside>
          <aside className="w-72 shrink-0 border-r border-border bg-surface">
            <ScreenCanvas
              bare
              blocks={activeScreen?.blocks ?? []}
              selectedBlockId={selectedBlockId}
              onSelectBlock={setSelectedBlockId}
              onRemoveBlock={handleRemoveBlock}
            />
          </aside>
          <div
            className="editor-scrollbar flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-10"
            style={{
              backgroundImage: 'radial-gradient(var(--color-border) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            <LivePreviewPanel
              screen={activeScreen}
              theme={draft.theme}
              screens={draft.screens}
              activeScreenId={activeScreenId}
              onSelectScreen={setActiveScreenId}
              navStyle={draft.navStyle}
            />
            <p className="text-[11px] text-muted">Saved locally as you edit — no account yet.</p>
          </div>
          <aside className="w-80 shrink-0 border-l border-border bg-surface">
            <BlockConfigPanel bare block={selectedBlock} onChange={handleBlockPropsChange} />
          </aside>
        </div>
      </DndContext>

      {showAddScreenModal && (
        <AddScreenModal
          existingKeys={draft.screens.map((s) => s.key)}
          onClose={() => setShowAddScreenModal(false)}
          onAdd={handleAddScreens}
        />
      )}

      {showClaimModal && (
        <ClaimModal
          brandName={draft.brandName}
          submitting={claiming}
          error={claimError}
          onClose={() => setShowClaimModal(false)}
          onSubmit={handleClaim}
        />
      )}
    </main>
  );
}
