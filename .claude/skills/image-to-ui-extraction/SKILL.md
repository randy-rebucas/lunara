---
name: image-to-ui-extraction
description: Decompose a supplied UI screenshot into production-ready visual assets, reusable UI components, design tokens, responsive layout rules, and implementation guidance. Use when a user asks to extract, slice, reverse-engineer, analyze, or recreate a mobile/web UI from an image, especially when the result will be implemented in React, React Native, Expo, Next.js, or a shared design system.
---

# Image-to-UI Extraction Skill

## Purpose

Turn a UI screenshot into a **production implementation blueprint**, not a collection of screenshot fragments.

The primary objective is to determine:

1. Which visual regions are genuine image assets.
2. Which elements should be recreated as SVG/vector/icon assets.
3. Which elements must be implemented as live UI.
4. How the screen should be decomposed into reusable components.
5. Which visual measurements should become design tokens.
6. How the composition should behave responsively.
7. Which interaction, loading, error, accessibility, and platform states are missing from the static screenshot.
8. How to translate the result into maintainable React/React Native code.

The screenshot is a **reference for the visual system and composition**. Do not treat the screenshot itself as the application.

---

# Core Principle

Never default to:

```text
screenshot → crop everything → place PNGs in app
```

Prefer:

```text
screenshot
   ↓
visual analysis
   ↓
asset classification
   ↓
layout decomposition
   ↓
design tokens
   ↓
component architecture
   ↓
responsive rules
   ↓
interaction/state model
   ↓
implementation blueprint
```

A screenshot should become a source of **design intelligence**, not a source of brittle UI images.

---

# 0. Resolve the source image to an actual file — required before any extraction claim

Extraction requires filesystem access to the source image bytes. A screenshot shown inline in chat is not automatically a file you can read or crop.

Before doing any of the following steps:

1. **Locate a real file path for the source image.** Check for an attached file path in the conversation/tool context (pasted images in Claude Code are usually saved to a temp path and referenced by path). If a path is present, confirm it with `Read` or a file-existence check before proceeding.
2. **If no accessible file path exists** (the image only appears as inline chat content with no path), **stop and ask the user** to save/attach the image as a file, or provide a path to it. Do not fabricate crop coordinates, asset filenames, or manifests against an image you cannot open.
3. Once a real path is confirmed, copy the original, untouched, into `image-extraction/source/` before any further work.
4. Verify image-processing tooling is actually available in the environment (e.g. ImageMagick `convert`/`magick`, or Python `PIL`/`Pillow`) with a quick check command. If none is available, say so explicitly and fall back to visual-analysis-only output — do not claim crops were produced.

**Never describe a crop, asset, or manifest entry as "extracted" unless a real crop command was actually run against a real file and produced a real output file on disk.** A written description of what *should* be cropped is a specification, not an extraction — label it as such (see Section 6).

---

# 1. Inspect the source image first

Record:

- pixel dimensions
- aspect ratio
- likely platform
- likely viewport/device class
- safe-area implications
- visual density
- major horizontal/vertical regions
- background treatment
- image regions
- text regions
- controls
- decorative elements

If image-processing tooling is available, use it to inspect dimensions and create crops.

Do not modify the original image.

Create a working directory such as:

```text
image-extraction/
├── source/
├── crops/
├── reference/
├── assets/
└── specification/
```

---

# 2. Build an annotated reference

Create an annotated copy of the screenshot.

Draw bounding boxes around candidate regions and label them:

```text
01 Logo
02 Wordmark
03 Hero image
04 Decorative artwork
05 Icon
06 Login card
07 Form field
08 Primary CTA
09 Support card
```

The annotated image is a review artifact. It is not a production asset.

Prefer clear numbering so every extracted region can be referenced from the implementation specification.

---

# 3. Classify every visible element

For each region, classify it as one of:

### A. Raster asset

Examples:

- photography
- texture
- complex illustration
- photographic product imagery

Recommended implementation:

```tsx
<Image source={asset} />
```

or:

```html
<img src="..." />
```

### B. Vector asset

Examples:

- logos
- simple illustrations
- decorative line art
- icons
- arrows
- interface symbols

Preferred implementation:

```text
SVG
```

or the platform's native vector/icon system.

### C. Live typography

Never crop normal text into an image.

Implement as:

```tsx
<Text>Welcome back,</Text>
```

Use the closest available typeface and document uncertainty if the original font is unavailable.

### D. Live UI component

Examples:

- inputs
- buttons
- cards
- links
- tabs
- switches
- checkboxes
- navigation
- dialogs

These must be implemented as interactive components.

### E. CSS/layout effect

Examples:

- gradients
- glows
- shadows
- borders
- blur
- rounded corners
- opacity
- overlays
- spacing

These should be recreated using layout/style primitives.

---

# 4. Extraction rules

Extract an image region only when doing so provides actual value.

Good candidates:

```text
logo artwork
photography
complex illustration
handwritten decorative artwork
texture
```

Do NOT crop:

```text
headings
labels
button text
form fields
input borders
cards
shadows
background gradients
navigation
arrows
standard icons
```

If an element could reasonably be represented by SVG, typography, CSS, or a reusable component, prefer that over a screenshot crop.

---

# 5. Cropping procedure

This step produces real files on disk, not descriptions. For each candidate asset:

1. Identify the tight visible bounds.
2. Include necessary transparent/visual breathing room.
3. Avoid capturing unrelated UI.
4. Preserve the original aspect ratio.
5. Record source coordinates.
6. **Run an actual crop command** against the file in `image-extraction/source/` (e.g. `magick convert source.png -crop WxH+X+Y crops/01_logo.png`, or Python `PIL.Image.open(...).crop((x0,y0,x1,y1)).save(...)`), then verify the output file exists (`Glob`/`ls`) and is non-empty before listing it anywhere as extracted.
7. Record the intended production format.

If Section 0 established that no source file or tooling is available, skip this section entirely and say so — do not write hypothetical filenames into the manifest as if they were produced.

Use filenames such as:

```text
01_logo.png
02_hero_laundry.jpg
03_handwritten_decoration.png
04_support_icon.png
```

Also create a machine-readable manifest:

```json
{
  "source": {
    "width": 853,
    "height": 1844
  },
  "assets": [
    {
      "name": "logo",
      "sourceCrop": [55, 165, 160, 270],
      "category": "brand",
      "recommendedFormat": "svg"
    }
  ]
}
```

Coordinates are examples only. Measure the actual supplied image.

---

# 6. Separate extraction from production recommendations

A crop is not automatically the final production asset.

For each extracted region provide:

```text
Source crop:
    what was extracted

Production recommendation:
    PNG / JPEG / WebP / AVIF / SVG / live UI

Reason:
    why that representation is preferable

Notes:
    transparency, resolution, recoloring,
    responsiveness, white-labeling, etc.
```

Example:

```text
Logo
→ Crop for reference
→ Rebuild/use original SVG for production
→ Reason: scalable, crisp, themeable
```

---

# 7. Reverse-engineer the layout

Describe the screen as layers.

A useful model is:

```text
Screen
│
├── Background
│   ├── base color
│   ├── gradient
│   ├── glow
│   └── decorative imagery
│
├── Header
│   ├── logo
│   └── wordmark
│
├── Hero
│   ├── heading
│   ├── description
│   ├── photography
│   └── decoration
│
├── Primary content
│   └── form/card
│
└── Secondary content
    └── support/help
```

Identify which layers are:

- normal flow
- absolute positioned
- overlapping
- sticky
- fixed
- scrollable

Do not assume absolute positioning merely because an element visually overlaps another element. Prefer normal layout flow wherever possible and reserve absolute positioning for genuine decorative/compositional layers.

---

# 8. Measure visual geometry

Estimate or measure:

- outer margins
- content width
- card width
- card height
- gaps
- vertical rhythm
- border widths
- corner radii
- icon sizes
- button height
- input height
- image bounds
- heading size
- body size
- line height

Translate repeated measurements into tokens.

Example:

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

Do not create a token for every arbitrary pixel measurement. Look for repeated visual relationships.

---

# 9. Extract the design language

Identify:

## Color

```text
Brand primary
Brand secondary
Background
Surface
Text primary
Text secondary
Border
Success
Warning
Error
Info
```

## Typography

Document:

```text
Display / Hero
Heading
Body
Label
Caption
Button
```

For each, estimate:

```text
font family
font weight
font size
line height
letter spacing
```

## Shape

Identify:

```text
small radius
medium radius
large radius
pill radius
```

## Elevation

Identify:

```text
none
subtle
medium
strong
```

## Motion

If inferred from the design, suggest restrained transitions for:

```text
focus
button press
loading
success
error
screen transition
```

Do not invent complex animation merely because it could look impressive.

---

# 10. Build the component hierarchy

Use an Atomic-Design-inspired hierarchy, but prioritize domain meaning.

### Primitives

```text
Box
Text
Icon
Image
Divider
Stack
Pressable
```

### Controls

```text
Button
Input
Checkbox
Radio
Switch
Select
```

### Feedback

```text
Toast
Alert
Spinner
Skeleton
EmptyState
```

### Composite components

```text
Card
OrderCard
AddressCard
ServiceCard
PriceBreakdown
StatusBadge
```

### Domain components

```text
OrderTimeline
PickupProof
DeliveryProof
LaundryStatus
PickupScheduler
ServiceSelector
PaymentSummary
```

### Screen structures

```text
LoginScreen
BookingScreen
OrderTrackingScreen
PartnerDashboard
RiderHome
```

Rule:

> Screens compose components. Screens should not contain their own design language.

---

# 11. Design component states

A screenshot normally represents only one state.

For every important interactive component, define states.

## Button

```text
default
pressed
focused
disabled
loading
success
error
```

## Input

```text
empty
focused
filled
error
disabled
loading
success
```

## Authentication screen

```text
default
keyboard-open
submitting
authentication-failed
network-unavailable
session-expired
```

For mobile applications also consider:

```text
offline
poor connection
permission denied
background/foreground restoration
```

---

# 12. Think in user jobs, not visual similarity

Ask:

```text
What is the user trying to accomplish?
What is the primary action?
What information must be understood immediately?
What can be progressively disclosed?
What happens when something fails?
```

Do not optimize only for pixel similarity.

A visually accurate reconstruction that has poor interaction design is not a successful extraction.

---

# 13. Mobile and web are compositions, not scaled screenshots

For mobile:

- respect safe areas
- use touch-friendly targets
- support keyboard behavior
- avoid excessive horizontal density
- use native interaction patterns
- account for narrow widths

For web:

- define max-widths
- introduce desktop composition changes
- use larger available space intentionally
- avoid simply scaling the mobile screenshot

A typical responsive strategy:

```text
Mobile
    ↓
single-column flow

Tablet
    ↓
constrained single-column or split composition

Desktop
    ↓
two-column / asymmetric composition
```

Only recommend a two-column layout when it improves the information hierarchy.

---

# 14. Accessibility must survive extraction

Every screenshot-derived interactive element must become accessible.

Check:

- semantic labels
- accessible names
- contrast
- focus states
- touch target size
- keyboard navigation on web
- screen reader behavior
- reduced motion
- error messaging
- password visibility controls
- meaningful validation

Never preserve a visual design at the expense of accessibility.

---

# 15. White-label / theme considerations

If the product supports multiple brands, separate:

```text
Design tokens
=
how the interface behaves

Brand tokens
=
who the interface belongs to
```

Example:

```ts
const brand = {
  primary: "...",
  secondary: "...",
  logo: "...",
  appName: "...",
};
```

And:

```ts
const semantic = {
  background: "...",
  surface: "...",
  textPrimary: "...",
  textSecondary: "...",
  border: "...",
  error: "...",
};
```

Never bake partner-specific colors into generic components.

---

# 16. Implementation mapping

Produce a mapping from screenshot region to implementation.

Example:

| Screenshot region | Production implementation |
|---|---|
| Logo | `BrandLogo` |
| Wordmark | `BrandWordmark` |
| Hero photograph | `HeroImage` |
| Handwritten decoration | `DecorativeArtwork` |
| Heading | `Text` token |
| Email field | `FormField` |
| Password field | `PasswordField` |
| Sign-in button | `Button variant="primary"` |
| Support area | `SupportCard` |

Then produce a component tree:

```tsx
<LoginScreen>
  <BrandHeader />

  <HeroSection>
    <HeroCopy />
    <HeroArtwork />
  </HeroSection>

  <AuthCard>
    <EmailField />
    <PasswordField />
    <PrimaryButton />
  </AuthCard>

  <SupportCard />
</LoginScreen>
```

---

# 17. React Native / Expo guidance

When the target is Expo/React Native:

Prefer:

```tsx
<View />
<Text />
<Pressable />
<Image />
```

and shared design-system primitives over screenshot-specific styling.

Do not reproduce web UI patterns blindly.

Use platform capabilities when relevant:

```text
SafeArea
Keyboard handling
Haptics
Camera
Location
Notifications
Secure storage
Network state
```

For apps with offline workflows, explicitly design offline states instead of assuming a permanent network connection.

---

# 18. Next.js / web guidance

When the target is web:

Prefer:

```text
semantic HTML
CSS variables
responsive CSS
accessible forms
keyboard navigation
```

Use the same design tokens as the mobile implementation.

Do not force React Native's interaction model onto desktop web.

---

# 19. Output package

When asked to perform image extraction, produce as many of these as the tooling allows:

```text
01_annotated_reference.png

assets/
├── logo.*
├── hero-image.*
├── decorative-art.*
└── icons.*

manifest.json

IMPLEMENTATION_SPEC.md

DESIGN_TOKENS.md

COMPONENT_MAP.md
```

If actual source assets are unavailable, clearly label extracted crops as:

```text
reference extraction
```

rather than claiming they are the original production assets.

---

# 20. Implementation specification template

Use this structure:

```markdown
# [Screen Name] — Implementation Specification

## Source
- Image dimensions:
- Platform:
- Estimated viewport:

## Visual decomposition

### 01 — [Region]
- Bounds:
- Category:
- Production representation:
- Notes:

## Design tokens

### Colors
...

### Typography
...

### Spacing
...

### Radius
...

### Elevation
...

## Component architecture
...

## Responsive behavior
...

## Interaction states
...

## Accessibility
...

## Implementation mapping
...

## Open questions / uncertainty
...
```

---

# 21. Quality-control checklist

Before finishing, verify:

### Asset extraction

- [ ] Original image preserved
- [ ] Candidate assets identified
- [ ] Crops have meaningful boundaries
- [ ] No UI text was unnecessarily rasterized
- [ ] Production format recommended
- [ ] Asset manifest created

### UI reconstruction

- [ ] Layout hierarchy documented
- [ ] Reusable components identified
- [ ] Design tokens identified
- [ ] Responsive behavior documented
- [ ] Interaction states documented
- [ ] Accessibility considered

### Engineering

- [ ] No screenshot-sized UI images proposed
- [ ] Components are reusable
- [ ] Theme/brand separation is preserved
- [ ] Mobile is treated as mobile
- [ ] Web is treated as web
- [ ] Uncertainty is explicitly documented

---

# 22. Important judgment rules

When uncertain:

### Prefer live UI over rasterized UI.

### Prefer SVG over raster for logos and simple artwork.

### Prefer tokens over arbitrary values.

### Prefer reusable components over screen-specific components.

### Prefer normal layout flow over unnecessary absolute positioning.

### Prefer explicit states over hidden assumptions.

### Prefer responsive composition over screenshot scaling.

### Prefer original source assets over screenshot crops when they are available.

### Never claim an extracted crop is the original source asset.

### Never invent exact font names, measurements, or colors when the screenshot does not provide enough evidence. Mark them as estimates.

---

# Example: Lunara login screen

For a login screenshot containing:

```text
Lunara logo
Welcome back, Team!
Laundry photograph
Handwritten decoration
Email field
Password field
Forgot password
Sign in
Support card
```

The correct decomposition is:

```text
BrandLogo
BrandWordmark
HeroImage
DecorativeArtwork

WelcomeHeading
WelcomeDescription

AuthCard
├── EmailField
├── PasswordField
├── ForgotPasswordLink
└── PrimaryButton

SupportCard
```

Not:

```text
login-screen.png
```

The resulting implementation should allow the same visual system to be reused by other Lunara experiences while permitting brand-specific identity where required.

---

# Final principle

The quality of screenshot extraction should be judged by this question:

> "Could another engineer implement the screen accurately, responsively, accessibly, and maintainably without needing the original designer to explain every detail?"

If yes, the extraction is successful.
