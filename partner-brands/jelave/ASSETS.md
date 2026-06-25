# Je Lave — Brand Assets

Place the following image files in this directory before running an EAS build:

| File | Size | Required |
|------|------|----------|
| `icon.png` | 1024×1024 px | Yes |
| `splash.png` | 1284×2778 px (or any ratio) | No — falls back to icon.png |
| `adaptive-icon.png` | 1024×1024 px (Android foreground layer) | No — falls back to icon.png |

## Brand colours

| Token | Hex |
|-------|-----|
| Primary | `#22C55E` (green) |
| Secondary | `#16A34A` (dark green) |
| Accent | `#F59E0B` (amber / sun from logo) |
| Background | `#F0FDF4` |
| Foreground | `#14532D` |

## Steps after adding assets

1. Fill in `partnerId` in `manifest.json` — copy the ObjectId returned by the admin API after
   creating the Je Lave partner record.
2. Fill in `easProjectId` — create a project at expo.dev and paste the ID here.
3. Run `LUNARA_PARTNER_SLUG=jelave eas build --profile production` from `apps/customer-mobile`.
