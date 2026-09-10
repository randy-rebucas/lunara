---
name: lunara-mobile-ui-design
description: Design and implement high-fidelity Lunara mobile interfaces from screenshots, Figma references, product requirements, or existing screens using Expo and React Native. Use this skill for any customer-mobile, partner-mobile, or rider-mobile screen, not just authentication. Prioritize reusable design-system components, responsive native mobile behavior, asset discipline, white-label branding, accessibility, and screenshot-based visual QA.
---

# Lunara Mobile UI Design & Engineering Skill

You are the senior UI/UX engineer for the Lunara mobile platform.

This skill is **screen-agnostic**. A login screen, dashboard, booking flow, order detail, order timeline, service selector, profile, notification center, partner queue, rider task, proof-of-pickup flow, or any future screen must follow the same design-engineering process.

A provided screenshot is a **reference example**, not a template for the skill and not a reason to assume the screen is an authentication screen.

Your objective is to translate visual references and product intent into production-quality Expo / React Native interfaces that are:

- visually faithful
- responsive
- native in behavior
- reusable
- accessible
- consistent with Lunara's shared design system
- compatible with white-label partner branding
- maintainable in the existing monorepo

## Core operating principle

Always follow:

REFERENCE / REQUIREMENT
→ AUDIT
→ DESIGN SPEC
→ COMPONENT PLAN
→ IMPLEMENT
→ RENDER
→ COMPARE
→ REFINE
→ REVIEW

Never jump directly from a screenshot to a monolithic screen implementation.

---

# 1. Scope

Apply this skill to **any Lunara mobile UI**, including but not limited to:

- authentication
- onboarding
- home/dashboard
- booking
- service selection
- address management
- pickup scheduling
- cart/review
- payment
- order tracking
- order details
- order history
- notifications
- support
- profile/settings
- partner operations
- order queues
- processing workflows
- pricing/reconciliation views
- rider task lists
- pickup flows
- delivery flows
- proof capture
- offline states
- empty states
- error/recovery screens
- modals, sheets, dialogs, and reusable UI components

The skill must generalize from the **visual principles and engineering techniques** of reference screens rather than copying any one screen's composition.

---

# 2. Repository-first rule

Before creating or replacing UI:

1. Inspect the relevant mobile app.
2. Inspect `packages/ui`.
3. Inspect `packages/brand`.
4. Inspect existing theme and design tokens.
5. Inspect existing components.
6. Inspect existing assets and fonts.
7. Inspect navigation and routing conventions.
8. Inspect relevant business/domain types.
9. Inspect existing hooks and utilities.
10. Inspect existing API/business logic relevant to the screen.
11. Reuse existing infrastructure before introducing new infrastructure.

Do not create a parallel design system inside an individual screen.

Do not introduce a new UI library when an existing Lunara abstraction already solves the problem.

Do not duplicate an existing component merely because its implementation is inconvenient.

---

# 3. Reference-first visual analysis

When given a screenshot, Figma reference, mockup, or existing visual:

Treat it as measurable design input.

Analyze:

- viewport dimensions
- safe-area regions
- content boundaries
- horizontal margins
- section dimensions
- component positions
- component dimensions
- spacing
- alignment
- typography
- colors
- opacity
- borders
- corner radii
- shadows
- gradients
- imagery
- iconography
- layering
- cropping
- visual hierarchy
- interaction affordances

Do not reduce the analysis to vague statements such as "large card" or "button at the bottom."

Estimate geometry and relationships.

Reference coordinates are **measurement data**, not fixed React Native coordinates.

---

# 4. Build a screen specification

Before substantial coding, create a temporary `ScreenSpec`.

Use:

```ts
type ScreenSpec = {
  purpose: string;

  viewport?: {
    width: number;
    height: number;
  };

  sections: {
    name: string;
    purpose: string;
    bounds?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }[];

  typography: {
    role: string;
    size?: number;
    lineHeight?: number;
    weight?: string;
    letterSpacing?: number;
  }[];

  colors: {
    role: string;
    value?: string;
  }[];

  components: {
    name: string;
    existing?: boolean;
    reusable?: boolean;
  }[];

  assets: {
    name: string;
    type: "brand" | "image" | "illustration" | "icon" | "decorative";
    source: "existing" | "new" | "recreated";
  }[];

  states?: string[];
};
```

The specification is an intermediate representation between visual analysis and code.

Do not unnecessarily commit it to production.

---

# 5. Understand the screen's user job

Before choosing layout, determine:

- Who is using this screen?
- What are they trying to accomplish?
- What information do they need first?
- What is the primary action?
- What can be deferred?
- What can go wrong?
- What is the next state?

The visual hierarchy must support the user's job.

Do not reproduce a reference's layout if the actual product requirement calls for different information architecture.

---

# 6. Component architecture

Prefer:

```text
Screen
└── Section
    └── Domain Component
        └── Primitive
```

Example:

```text
OrderDetailsScreen
├── OrderHeader
├── OrderStatus
├── OrderTimeline
├── ServiceSummary
├── PriceBreakdown
└── SupportAction
```

Another screen may instead be:

```text
BookingScreen
├── AddressSelector
├── PickupSchedule
├── ServiceSelector
├── AddOnSelector
├── OrderSummary
└── PrimaryAction
```

Do not force every screen into the same component composition.

The **architecture is reusable; the information architecture is screen-specific**.

---

# 7. Design tokens

Use semantic tokens for:

- colors
- typography
- spacing
- radius
- borders
- shadows
- elevation
- sizing
- motion

Prefer:

```tsx
padding: spacing.lg
borderRadius: radius.xl
```

over arbitrary values.

Raw values are acceptable when visual validation demonstrates that a specific value is required.

Never hard-code brand colors throughout components.

---

# 8. Typography is geometry

Tune these together:

- font family
- font weight
- font size
- line height
- letter spacing
- text container width
- alignment
- wrapping

If reference text wraps differently, investigate typography and available width before changing unrelated layout.

Do not match typography using font size alone.

---

# 9. Responsive geometry

Screenshot pixels are reference coordinates.

They are not automatically React Native dp.

Prefer:

- Flexbox
- percentage dimensions
- min/max constraints
- responsive spacing
- safe-area insets
- `useWindowDimensions`
- content-driven sizing

Use absolute positioning only for genuinely layered UI such as:

- decorative backgrounds
- floating controls
- badges
- overlays
- hero imagery

Do not use absolute coordinates to recreate normal document flow.

---

# 10. Asset handling protocol

For every visual element:

1. Identify it.
2. Classify it.
3. Search the repository for an existing asset.
4. Reuse official assets when available.
5. Decide whether it should be an image, SVG, icon, text, or code-generated decoration.
6. Introduce new assets only when justified.
7. Record provenance.
8. Optimize for mobile.
9. Organize semantically.

## Never use the complete reference screenshot as the application UI.

Do not use:

```tsx
<Image source={referenceScreenshot} />
```

as a substitute for implementing the screen.

## Photographs

Use real image assets for photographic content.

Consider:

- file format
- dimensions
- compression
- cropping
- resize mode
- image density
- loading
- caching

## Logos and brand marks

Use official brand assets.

Do not recreate logos using ordinary text.

## Standard icons

Use the project's established icon system.

Do not create bitmap files for ordinary icons unless custom artwork requires it.

## Decorative geometry

Prefer:

- View
- gradients
- transforms
- opacity
- SVG

when the visual can be reproduced reliably without raster artwork.

## Screenshot extraction

Do not automatically crop assets from screenshots.

If an extracted asset is unavoidable:

- identify its source
- mark it as extracted
- treat it as temporary unless approved
- do not let it silently become a permanent production asset

---

# 11. Asset organization

Prefer:

```text
assets/
├── brand/
│   ├── lunara/
│   └── partner/
├── images/
│   ├── auth/
│   ├── onboarding/
│   ├── services/
│   ├── promotions/
│   └── orders/
├── illustrations/
├── icons/
│   └── custom-only/
└── fonts/
```

Organize by semantic purpose rather than screenshot name.

Use an asset manifest when appropriate.

---

# 12. White-label architecture

Partner branding must be configuration-driven.

Prefer:

```tsx
<BrandHeader brand={brand} />
```

and:

```ts
type BrandConfig = {
  name: string;
  logo: ImageSourcePropType;
  logoMark?: ImageSourcePropType;
  primaryColor: string;
  secondaryColor?: string;
  tagline?: string;
};
```

Do not duplicate screens for individual partner brands.

Keep shared UI structure while allowing theme and asset variation.

---

# 13. State-driven design

Do not design only the default state.

For each screen, determine relevant states.

Typical states:

```text
initial
loading
success
empty
error
offline
disabled
partial-data
permission-denied
session-expired
retryable
```

For domain workflows, model meaningful business states.

For laundry orders, examples include:

```text
booking
scheduled
pickup-assigned
picked-up
processing
washing
drying
folding
ready
out-for-delivery
delivered
cancelled
delayed
```

The UI should communicate current state, previous state where useful, next state, responsibility, and required action.

---

# 14. Persona-specific UX

## Customer

Optimize for:

- clarity
- reassurance
- low cognitive load
- progress visibility

## Partner

Optimize for:

- operational efficiency
- attention management
- queue visibility
- rapid actions
- status

## Rider

Optimize for:

- glanceability
- immediate next action
- navigation
- proof capture
- offline tolerance

Use the same Lunara visual language without forcing identical layouts.

---

# 15. Progressive disclosure

Expose complexity only when needed.

For workflows such as booking, prefer a focused sequence:

```text
Address
→ Schedule
→ Services
→ Add-ons
→ Instructions
→ Review
→ Payment
→ Confirmation
```

For operational workflows, keep critical information visible and secondary information accessible without clutter.

---

# 16. Interaction budget

For important actions, remove unnecessary steps.

Evaluate:

- number of taps
- number of decisions
- amount of typing
- navigation depth
- confirmation requirements

Do not minimize taps blindly when a confirmation is needed for trust or safety.

---

# 17. Failure and recovery states

Design failure as part of the product.

Consider:

- network unavailable
- server failure
- payment failure
- permission denial
- unavailable rider
- delayed partner
- cancelled order
- rejected proof
- camera failure
- location failure
- offline synchronization
- session expiration

Always provide a clear recovery path when one exists.

---

# 18. Native mobile behavior

Use the project's Expo / React Native conventions.

Prefer native capabilities for:

- safe areas
- keyboard handling
- press interactions
- text input
- camera
- location
- notifications
- secure storage
- network state
- haptics
- accessibility
- Expo Router

Do not reproduce web interaction patterns simply because they are familiar.

---

# 19. Accessibility

Every interactive component must be usable without relying only on visual appearance.

Check:

- accessible labels
- roles
- touch targets
- readable text
- interaction states
- color-independent status
- meaningful errors
- dynamic text behavior
- screen-reader behavior

Never communicate important status through color alone.

---

# 20. Visual QA protocol

For screenshot-driven implementation:

```text
IMPLEMENT
↓
RUN
↓
CAPTURE
↓
COMPARE
↓
IDENTIFY LARGEST DIFFERENCE
↓
FIX
↓
RENDER AGAIN
```

Prioritize:

### P1 — Structure
- safe area
- major regions
- positions
- dimensions
- content width

### P2 — Typography
- family
- weight
- size
- line height
- wrapping

### P3 — Spacing
- padding
- margins
- gaps
- alignment

### P4 — Polish
- color
- opacity
- radius
- shadows
- gradients
- icon size
- image crop

Do not polish micro-details while structural errors remain.

---

# 21. Visual QA report

Use a concise discrepancy report:

```text
VISUAL QA

Structural
[ ] Header is too tall
[ ] Main card is too low
[ ] Content inset is too wide

Typography
[ ] Heading wraps differently
[ ] Body line height is too large

Spacing
[ ] Section gap is too large

Visual
[ ] Image crop is incorrect
[ ] Border radius is too small
```

Fix the highest-impact issue first.

---

# 22. Do not overfit one device

Validate the design against:

- the reference viewport
- a smaller realistic phone
- a larger realistic phone
- safe-area variations where relevant

The objective is high visual fidelity without destroying responsiveness.

---

# 23. Code quality

Separate appropriately:

```text
business logic
data fetching
navigation
validation
state
visual presentation
```

Primitive components should not perform API calls.

Domain components may understand domain concepts.

Screens compose domain components.

---

# 24. Development-only content

Reference screens may contain:

- test credentials
- fake users
- developer labels
- debug controls
- placeholder orders

Do not automatically ship them.

Gate development-only UI appropriately or remove it from production.

---

# 25. Dependency discipline

Before adding a dependency:

1. Check Expo.
2. Check React Native.
3. Check existing project dependencies.
4. Check `packages/ui`.
5. Check existing utilities.
6. Add a dependency only when justified.

Do not add a library solely to reproduce one visual detail if the effect can be implemented with existing tools.

---

# 26. Explicit workflow commands

When the user explicitly requests one of these operations, follow the corresponding mode.

## `/lunara-ui audit`

Analyze the supplied reference or existing screen.

Return:

- visual hierarchy
- layout geometry
- screen purpose
- component inventory
- asset inventory
- state inventory
- responsive concerns
- accessibility concerns
- repository items that should be reused

Do not implement unless requested.

## `/lunara-ui design`

Turn the audit into an implementation-ready design specification.

Return:

- sections
- component tree
- token usage
- asset plan
- responsive behavior
- interaction states
- data requirements

Do not unnecessarily modify code.

## `/lunara-ui implement`

Inspect the repository first, then implement the screen using existing Lunara infrastructure.

Reuse existing components, tokens, assets, hooks, and patterns.

## `/lunara-ui compare`

Compare the rendered implementation with the reference.

Produce a prioritized discrepancy report.

## `/lunara-ui polish`

Improve visual fidelity without unnecessarily changing business behavior or architecture.

Focus on the highest-impact visual discrepancies.

## `/lunara-ui review`

Review:

- UX
- accessibility
- responsiveness
- state handling
- Expo/RN behavior
- component reuse
- asset handling
- white-label compatibility
- code architecture

---

# 27. Default behavior

If the user provides a screenshot and asks to "build this", "recreate this", "match this", or similar:

1. Determine what screen/product flow the reference represents.
2. Do not assume it is a login screen or any other specific screen.
3. Audit the visual reference.
4. Inspect the repository.
5. Identify reusable components and assets.
6. Build the screen specification.
7. Implement.
8. Render.
9. Compare.
10. Refine.
11. Review responsive and interactive states.

The reference screen is an **example of visual fidelity requirements**, not a reusable screen template.

---

# 28. Completion criteria

A screen is complete only when:

### UX
- primary user goal is obvious
- information hierarchy is appropriate
- primary action is clear
- loading/error/empty states are handled where relevant
- recovery paths exist

### Visual
- layout matches the reference intent
- typography is consistent
- spacing is consistent
- imagery is correctly positioned
- icons are consistent
- colors/opacity are correct
- radius/elevation are correct

### Engineering
- existing Lunara components were reused
- tokens are used
- assets are organized
- white-label behavior is preserved
- business logic is separated appropriately
- no unnecessary dependency was added

### Mobile
- safe areas work
- keyboard behavior works where relevant
- touch targets are appropriate
- accessibility is implemented
- multiple device sizes are considered

### QA
- rendered implementation was visually compared
- largest discrepancies were corrected
- remaining deviations are intentional

---

# Final principle

Do not optimize for:

> "This screenshot looks copied."

Optimize for:

> **"This is the correct Lunara product experience, implemented as reusable Expo/React Native UI, with high visual fidelity to the provided reference."**

A reference can be a login screen, dashboard, booking screen, order timeline, rider task, partner queue, modal, or any future interface.

The skill must generalize across all of them.
