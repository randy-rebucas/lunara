# Lunara Partner Login — Implementation Specification

## Source
- Provided as inline image (no file on disk to crop from — no raw crops were produced; regions below are documented for asset sourcing, not pixel-extracted).
- Estimated dimensions: ~853×1844 (iPhone-class, 9:19.5 aspect)
- Platform: iOS status bar visible → React Native / Expo mobile
- Existing implementation: `apps/partner-mobile/app/login.tsx` already matches ~90% of this screenshot (same copy, same field/button/support-card structure, same token names in `src/theme`).

## Gap analysis vs. current code

The current `login.tsx` hero uses two flat CSS "blob" circles (`heroBlobOuter`/`heroBlobInner`) for decoration. The screenshot instead shows two elements the current code does not have:

| # | Region | Current code | Screenshot |
|---|---|---|---|
| 04 | Decorative script text ("Clean Operations / Happier Communities") | absent | hand-lettered script, muted lavender, top-right of hero |
| 03 | Hero photograph (folded lavender towels) | absent (flat blob) | real photo, bottom-right, bleeds off-screen, soft rounded top-left corner |

Everything else (logo, wordmark, heading, body copy, email/password fields, forgot-password link, sign-in button, support card, dev hint, status bar) is already implemented and visually matches.

## Visual decomposition

### 01 — BrandMark (logo)
- Category: vector asset (already exists as `BrandMark` component)
- Production representation: existing `src/components/ui/brand-mark.tsx` — no change

### 02 — Wordmark ("LUNARA" / "PARTNER · SHOP OPS")
- Category: live typography — already implemented (`brandName`/`brandSub` styles)

### 03 — Hero photograph (folded towels)
- Category: raster asset (photography) — **new**
- Production representation: `<Image>` sourced from a real photo asset (e.g. `assets/hero/partner-login-towels.jpg`), not a CSS shape
- Placement: absolutely positioned within `hero`, anchored bottom-right, partially bleeding past the safe content width; top-left corner rounded (`borderTopLeftRadius`), remaining corners square/clipped by container bleed
- Recommend WebP/AVIF fallback to JPEG; lazy-decode not needed (above-the-fold)
- Notes: needs brand-safe crop (must not print copyrighted stock art without license); if no licensed photo is available yet, keep current blob as placeholder and track as open item

### 04 — Decorative script text
- Category: live typography (script/handwriting webfont) or lightweight SVG, **not** a raster crop — the text is simple enough to keep editable and localizable
- Recommend a script Google Font (e.g. "Caveat" or "Kalam") loaded via `expo-font`, colored `colors.primaryBorder`/muted lavender, small underline accent (single thin line under "Communities")
- If exact handwriting match matters more than localization, fall back to SVG path, but default to live text for maintainability/a11y (screen readers need real text, not an image)

### 05–09 — Form, button, support card
- Already implemented 1:1 (`FieldRow`, `Button`, `Card primary` support row). No changes needed.

## Design tokens (already present in `src/theme`)
Confirmed matches: `colors.primary`, `colors.primaryLight`, `colors.primaryBorder`, `colors.surface`, `radius.xl/xxl/full`, `spacing.*`, `shadow.elevated/card`, `typography.body/caption`. No new tokens required except a `fontFamily.script` token for the new decorative text.

## Component architecture (delta only)

```
LoginScreen (existing)
└── hero (existing View)
    ├── heroBlobOuter / heroBlobInner   → REMOVE (or keep as fallback under photo)
    ├── HeroPhoto (new)                  ← <Image> absolutely positioned bottom-right
    └── HeroDecoration (new)             ← <Text> script font, absolutely positioned top-right,
                                            "Clean Operations\nHappier Communities" + underline accent
```

## Responsive behavior
No change from existing screen — single-column mobile flow, `KeyboardSafeScrollView` already handles keyboard avoidance. `HeroPhoto`/`HeroDecoration` should use percentage/aspect-ratio-based positioning (not fixed px) so they scale across device widths (SE vs Pro Max) without clipping the form sheet below.

## Interaction / states
No new states — login already covers: default, loading (`Signing in…`), error banner, disabled (empty fields), show/hide password. Hero photo/decoration are purely decorative (`pointerEvents="none"`, `accessibilityElementsHidden`) and must not intercept touches meant for the scroll view or fields below.

## Accessibility
- `HeroPhoto`: `accessible={false}` / `importantForAccessibility="no"` (decorative).
- `HeroDecoration`: since it's real text, either mark decorative (`accessibilityElementsHidden`) since it's non-essential brand flavor, or leave discoverable — it carries no functional info, so hiding it from screen readers is preferred to avoid clutter.
- No change to existing field labels/contrast, which already pass.

## Open questions
1. No licensed photography asset currently exists for the towel hero image — needs a real source file before this can ship (do not substitute a stock/generic placeholder without confirming licensing).
2. Exact script font family is a visual estimate ("Caveat"/"Kalam" class) — not confirmed from the screenshot; verify with design if a specific brand typeface exists.
