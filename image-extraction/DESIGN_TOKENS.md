# Design Tokens — Orders (Empty State)

All values are estimates read off the screenshot (853×1844px source). Treat pixel values as approximate; verify against Figma/original source before locking into a design system.

## Color

| Token | Approx value | Usage |
|---|---|---|
| `brand.primary` | `#4F46E5` (indigo/violet) | Active pill, primary tab, CTA fills, icon accents |
| `brand.primaryText` | `#FFFFFF` | Text/icons on primary fill |
| `background.app` | `#F3F4FA` (very light lavender-grey) | Screen background |
| `surface.card` | `#FFFFFF` | Search bar, empty-state card, pills (inactive), tip box lighter tint |
| `surface.tipBox` | `#EDEBFB` (pale violet) | Tip callout background |
| `text.primary` | `#0F1130` (near-black navy) | Headings ("Orders", "No orders here") |
| `text.secondary` | `#6B7280` (grey) | Subtitle, description, placeholder text |
| `text.brandWordmark` | `#4F46E5` | "LUNARA" wordmark |
| `border.subtle` | `#E5E7EB` | Card/input borders |
| `badge.notification` | `#F43F5E` (pink/red dot) | Bell notification dot |
| `illustration.tint` | `#C7CCF7` → `#8B93EE` gradient | Empty-state artwork (box + paper airplane), low-saturation violet |

## Typography

| Token | Est. size | Weight | Usage |
|---|---|---|---|
| `text.display` | 32px | 800 (extrabold) | "Orders" page title |
| `text.heading` | 22px | 700 (bold) | "No orders here" |
| `text.body` | 15px | 500 | Description, tip text |
| `text.label` | 13px | 600 | Pill labels, wordmark subtitle |
| `text.wordmark` | 20px | 800 | "LUNARA" |
| `text.caption` | 12px | 500 | Status bar, subtitle under wordmark |

Font family could not be determined precisely from the screenshot — appears to be a geometric sans (e.g., Inter/SF Pro/Poppins). Mark as estimate; confirm against the app's actual font config.

## Spacing

```ts
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
```
Observed rhythm: 16–24px between major sections (header → title → search → pills → card), ~24–32px internal card padding.

## Radius

| Token | Value | Usage |
|---|---|---|
| `radius.sm` | 10px | Notification bell button background |
| `radius.md` | 16px | Search input, logo icon square |
| `radius.lg` | 24px | Empty-state card |
| `radius.pill` | 999px | Filter pills, active tab, bottom nav pill |

## Elevation

| Token | Usage |
|---|---|
| `elevation.none` | Background, text |
| `elevation.subtle` | Search bar, filter pills (soft shadow) |
| `elevation.medium` | Empty-state card, bottom nav bar |

## Motion (suggested, not visible in static screenshot)

- Pill selection: 150ms ease-out background/color crossfade
- Bottom nav active state: 150ms ease-out
- Empty-state illustration: optional subtle idle float/parallax (restrained, not required)
