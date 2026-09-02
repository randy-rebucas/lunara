# Partner mobile brand assets

Each white-labeled customer-mobile build reads its assets and identifiers from a folder here,
named after the partner's slug, selected via the `LUNARA_PARTNER_SLUG` env var passed to
`apps/customer-mobile/app.config.js` (see that file and `eas.json`).

## Layout

```
partner-brands/<slug>/
  manifest.json
  icon.png            # 1024x1024, required
  splash.png          # optional — falls back to icon.png if absent
  adaptive-icon.png    # optional (Android) — falls back to icon.png if absent
```

## manifest.json schema

```json
{
  "partnerId": "<Mongo ObjectId of the partner's owner User — used to tag bookings>",
  "appName": "Partner Laundry",
  "slug": "partner-laundry-customer",
  "iosBundleId": "com.partnerlaundry.customer",
  "androidPackage": "com.partnerlaundry.customer",
  "easProjectId": "<this partner's own EAS project id>",
  "splashBackgroundColor": "#ffffff"
}
```

Unset fields fall back to the default Lunara app's values — only override what the partner's
brand actually changes. `partnerId` should match the `partnerId` returned by
`GET /api/v1/public/branding` for this partner's customer-web domain, since both clients tag
bookings with the same `x-lunara-partner-id` header for auto-dispatch.

## Setting up a new partner's EAS project

Use `.claude/skills/scaffold-partner-brand/setup-eas.mjs` instead of running these by hand — it
creates the EAS project (`eas project:init`), adds the `preview-<slug>` / `production-<slug>`
profiles to `apps/customer-mobile/eas.json`, and sets the project's env vars in one step:

```
node .claude/skills/scaffold-partner-brand/setup-eas.mjs \
  --slug <slug> --apiUrl <https://partner-api-url> --websiteUrl <https://partner-website-url>
```

Pass `--dry-run` to preview the changes first. See `.claude/skills/scaffold-partner-brand/SKILL.md`
for the full onboarding flow (this script, then `generate.mjs`).
