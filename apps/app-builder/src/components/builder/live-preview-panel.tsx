'use client';

import type { AppScreen, AppNavStyle, BrandTheme } from '@lunara/types';
import { PhoneFrame } from '../phone-mockup';
import { BlockListPreview } from '../preview/block-renderers';
import { PhoneNav } from '../preview/phone-nav';

export function LivePreviewPanel({
  screen,
  theme,
  screens,
  activeScreenId,
  onSelectScreen,
  navStyle = 'tabs',
}: {
  screen: AppScreen | null;
  theme: BrandTheme;
  /** All screens in the app, for in-preview navigation. Omit to render a single screen with no nav chrome. */
  screens?: AppScreen[];
  activeScreenId?: string | null;
  onSelectScreen?: (id: string) => void;
  navStyle?: AppNavStyle;
}) {
  return (
    <div
      style={
        {
          '--color-primary': theme.primary,
          '--color-secondary': theme.secondary,
          '--color-accent': theme.accent,
          '--color-surface': theme.background,
          '--color-surface-muted': theme.muted,
          '--color-border': theme.border,
          '--color-muted': theme.muted,
          '--color-destructive': theme.destructive,
        } as React.CSSProperties
      }
      className="flex flex-col items-center gap-3"
    >
      <PhoneFrame label={screen?.title ?? 'Preview'}>
        <div className="relative flex h-full flex-col">
          <div className="flex-1 overflow-y-auto bg-surface-muted p-3 pt-9">
            {screen ? <BlockListPreview blocks={screen.blocks} /> : (
              <p className="text-center text-[9px] text-muted">No screen selected</p>
            )}
          </div>
          {screens && screens.length > 1 && onSelectScreen && (
            <PhoneNav
              navStyle={navStyle}
              screens={screens}
              activeScreenId={activeScreenId ?? null}
              onSelect={onSelectScreen}
            />
          )}
        </div>
      </PhoneFrame>
    </div>
  );
}
