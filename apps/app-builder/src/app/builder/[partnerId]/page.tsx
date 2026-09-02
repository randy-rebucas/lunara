'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { CheckCircle2, ChevronDown, CloudUpload, History, Loader2, Menu, Rocket } from 'lucide-react';
import { BLOCK_REGISTRY, type BlockType } from '@lunara/blocks';
import type { AppBlock, AppNavStyle, AppScreen, PartnerAppConfig } from '@lunara/types';
import { Button, cn } from '@lunara/ui';
import {
  getDraft,
  saveDraft,
  publishDraft,
  listVersions,
  rollbackToVersion,
} from '../../../lib/app-config-api';
import { useAdminToken } from '../../../lib/use-admin-token';
import { useDebouncedEffect } from '../../../lib/use-debounced-effect';
import { getFriendlyErrorMessage } from '../../../lib/format-error';
import { buildScreenFromTemplate, SCREEN_TEMPLATES } from '../../../lib/screen-templates';
import { Card, CardBody } from '../../../components/ui/card';
import { FormLabel, Input } from '../../../components/ui/input';
import { BlockPalette } from '../../../components/builder/block-palette';
import { ScreenCanvas, CANVAS_DROPPABLE_ID } from '../../../components/builder/screen-canvas';
import { BlockConfigPanel } from '../../../components/builder/block-config-panel';
import { LivePreviewPanel } from '../../../components/builder/live-preview-panel';
import { VersionHistoryPanel } from '../../../components/builder/version-history-panel';
import { ScreenTabs } from '../../../components/builder/screen-tabs';
import { AddScreenModal } from '../../../components/builder/add-screen-modal';
import { NavStyleControl } from '../../../components/builder/nav-style-control';

function StatusPill({ latestVersion }: { latestVersion: number | null }) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-xs font-medium',
        latestVersion ? 'bg-primary/10 text-primary' : 'bg-muted/40 text-muted',
      )}
    >
      {latestVersion ? `Published v${latestVersion}` : 'Not published yet'}
    </span>
  );
}

export default function BuilderPage() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const { token, setToken } = useAdminToken();

  const [config, setConfig] = useState<PartnerAppConfig | null>(null);
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [publishState, setPublishState] = useState<'idle' | 'confirming' | 'publishing' | 'error'>('idle');
  const [versions, setVersions] = useState<PartnerAppConfig[]>([]);
  const [rollingBackVersion, setRollingBackVersion] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const [showAddScreenModal, setShowAddScreenModal] = useState(false);
  const [navPanelOpen, setNavPanelOpen] = useState(false);
  const navPanelRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    if (!historyOpen) return;
    function handleClick(e: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [historyOpen]);

  useEffect(() => {
    if (!navPanelOpen) return;
    function handleClick(e: MouseEvent) {
      if (navPanelRef.current && !navPanelRef.current.contains(e.target as Node)) {
        setNavPanelOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [navPanelOpen]);

  function refreshVersions() {
    if (!token || !partnerId) return;
    listVersions(partnerId, token)
      .then(setVersions)
      .catch(() => {});
  }

  useEffect(() => {
    if (!token || !partnerId) return;
    setLoading(true);
    getDraft(partnerId, partnerId, token)
      .then((draft) => {
        const screens = draft.screens.length
          ? draft.screens
          : [{ id: crypto.randomUUID(), key: 'home', title: 'Home', blocks: [] }];
        setConfig({ ...draft, screens, navStyle: draft.navStyle ?? 'tabs' });
        setActiveScreenId(screens[0].id);
      })
      .catch((err) => setError(getFriendlyErrorMessage(err, 'Failed to load draft')))
      .finally(() => setLoading(false));
    refreshVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, partnerId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timeout);
  }, [toast]);

  useDebouncedEffect(
    () => {
      if (!config || !token) return;
      setSaveState('saving');
      saveDraft(partnerId, token, { theme: config.theme, screens: config.screens, navStyle: config.navStyle ?? 'tabs' })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    },
    [config],
    1000,
  );

  const activeScreen = config?.screens.find((s) => s.id === activeScreenId) ?? null;
  const selectedBlock = activeScreen?.blocks.find((b) => b.id === selectedBlockId) ?? null;

  function updateScreen(screenId: string, updater: (screen: AppScreen) => AppScreen) {
    setConfig((prev) =>
      prev
        ? { ...prev, screens: prev.screens.map((s) => (s.id === screenId ? updater(s) : s)) }
        : prev,
    );
  }

  function updateNavStyle(navStyle: AppNavStyle) {
    setConfig((prev) => (prev ? { ...prev, navStyle } : prev));
  }

  function handleAddScreens(keys: string[]) {
    const newScreens = SCREEN_TEMPLATES.filter((t) => keys.includes(t.key)).map(buildScreenFromTemplate);
    setConfig((prev) => (prev ? { ...prev, screens: [...prev.screens, ...newScreens] } : prev));
    setActiveScreenId(newScreens[0]?.id ?? activeScreenId);
    setShowAddScreenModal(false);
  }

  function handleRemoveScreen(screenId: string) {
    setConfig((prev) => (prev ? { ...prev, screens: prev.screens.filter((s) => s.id !== screenId) } : prev));
    if (activeScreenId === screenId) {
      const remaining = (config?.screens ?? []).filter((s) => s.id !== screenId);
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

  async function handlePublish() {
    if (!token) return;
    setPublishState('publishing');
    try {
      const published = await publishDraft(partnerId, token);
      setPublishState('idle');
      setToast(`Published v${published.version}`);
      refreshVersions();
    } catch {
      setPublishState('error');
    }
  }

  async function handleRollback(version: number) {
    if (!token) return;
    setRollingBackVersion(version);
    try {
      const rolledBack = await rollbackToVersion(partnerId, version, token);
      setToast(`Rolled back to v${version} (published as v${rolledBack.version})`);
      refreshVersions();
      const draft = await getDraft(partnerId, partnerId, token);
      const screens = draft.screens.length
        ? draft.screens
        : [{ id: crypto.randomUUID(), key: 'home', title: 'Home', blocks: [] }];
      setConfig({ ...draft, screens, navStyle: draft.navStyle ?? 'tabs' });
      setActiveScreenId(screens[0].id);
      setSelectedBlockId(null);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to roll back'));
    } finally {
      setRollingBackVersion(null);
    }
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <Card elevated>
            <CardBody className="space-y-4">
              <h1 className="text-lg font-semibold text-slate-900">Admin access</h1>
              <p className="text-sm text-muted">
                Paste an admin bearer token (from <code>POST /auth/login</code>) to edit this partner&apos;s app.
              </p>
              <div>
                <FormLabel htmlFor="token">Bearer token</FormLabel>
                <Input id="token" onChange={(e) => setToken(e.target.value)} />
              </div>
            </CardBody>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-surface-muted">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-sm font-semibold text-slate-900">
            App builder <span className="font-normal text-muted">/ {partnerId}</span>
          </h1>
          <StatusPill latestVersion={versions[0]?.version ?? null} />
          <span className="flex items-center gap-1.5 text-xs text-muted">
            {saveState === 'saving' && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Saving...
              </>
            )}
            {saveState === 'saved' && (
              <>
                <CloudUpload className="h-3 w-3" /> Draft saved
              </>
            )}
            {saveState === 'error' && <span className="text-destructive">Failed to save draft</span>}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div ref={navPanelRef} className="relative">
            <Button variant="outline" size="sm" onClick={() => setNavPanelOpen((v) => !v)}>
              <Menu className="h-4 w-4" />
              Nav
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', navPanelOpen && 'rotate-180')} />
            </Button>
            {navPanelOpen && config && (
              <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl bg-surface p-4 shadow-elevated ring-1 ring-border/60">
                <NavStyleControl value={config.navStyle ?? 'tabs'} onChange={updateNavStyle} />
              </div>
            )}
          </div>
          <div ref={historyRef} className="relative">
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen((v) => !v)}>
              <History className="h-4 w-4" />
              History
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', historyOpen && 'rotate-180')} />
            </Button>
            {historyOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-xl bg-surface p-3 shadow-elevated ring-1 ring-border/60">
                <VersionHistoryPanel
                  versions={versions}
                  rollingBackVersion={rollingBackVersion}
                  onRollback={handleRollback}
                  bare
                />
              </div>
            )}
          </div>
          {publishState === 'confirming' ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">Publish this draft live?</span>
              <Button onClick={handlePublish} size="sm">
                Confirm
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPublishState('idle')}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setPublishState('confirming')} disabled={publishState === 'publishing'}>
              <Rocket className="h-4 w-4" />
              {publishState === 'publishing' ? 'Publishing...' : 'Publish'}
            </Button>
          )}
        </div>
      </header>

      {(toast || error || publishState === 'error') && (
        <div className="shrink-0 space-y-2 border-b border-border bg-surface px-4 py-2">
          {toast && (
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
              <CheckCircle2 className="h-4 w-4" />
              {toast}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {publishState === 'error' && <p className="text-sm text-destructive">Failed to publish - try again.</p>}
        </div>
      )}

      {loading || !config ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading draft...
          </p>
        </div>
      ) : (
        <>
          <ScreenTabs
            screens={config.screens}
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
                  theme={config.theme}
                  screens={config.screens}
                  activeScreenId={activeScreenId}
                  onSelectScreen={setActiveScreenId}
                  navStyle={config.navStyle ?? 'tabs'}
                />
                <p className="flex items-center gap-1 text-[11px] text-muted">
                  <CloudUpload className="h-3 w-3" /> Autosaves as you edit
                </p>
              </div>
              <aside className="w-80 shrink-0 border-l border-border bg-surface">
                <BlockConfigPanel bare block={selectedBlock} onChange={handleBlockPropsChange} />
              </aside>
            </div>
          </DndContext>
        </>
      )}

      {showAddScreenModal && config && (
        <AddScreenModal
          existingKeys={config.screens.map((s) => s.key)}
          onClose={() => setShowAddScreenModal(false)}
          onAdd={handleAddScreens}
        />
      )}
    </main>
  );
}
