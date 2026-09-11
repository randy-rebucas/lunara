# Component Map — Orders (Empty State)

## Screenshot region → implementation

| Screenshot region | Production implementation |
|---|---|
| Logo icon (moon/sparkle) | `BrandLogo` (SVG) |
| "LUNARA" + "PARTNER · SHOP OPS" | `BrandHeader` → `Text` tokens |
| Bell icon + red dot | `IconButton` + `NotificationBadge` |
| "SL" avatar + "Staff / Shop Staff" + chevron | `UserMenuTrigger` (`Avatar` + `Text` stack + `Icon`) |
| "Orders" title | `Text` (display token) |
| "Manage and track all shop orders" | `Text` (secondary token) |
| Search input | `SearchField` |
| Filter/sliders button | `IconButton` (icon-only, secondary) |
| Filter pills (All/Accept/Receive & Verify/Processing…) | `SegmentedFilterBar` composed of `FilterPill` (with `CountBadge`), horizontally scrollable |
| Empty-state card | `EmptyState` composite component |
| Box + paper airplane artwork | `EmptyStateIllustration` (static SVG/PNG asset) |
| "No orders here" | `Text` (heading token), part of `EmptyState` |
| Description copy | `Text` (body/secondary token), part of `EmptyState` |
| Tip callout (💡 + text) | `TipCallout` (reusable, icon + text in tinted box) |
| Bottom tab bar | `BottomTabBar` composed of `TabBarItem` (icon + label), active pill state |

## Component tree

```tsx
<OrdersScreen>
  <AppHeader>
    <BrandLogo />
    <BrandWordmark title="LUNARA" subtitle="PARTNER · SHOP OPS" />
    <IconButton icon="bell" badge />
    <UserMenuTrigger initials="SL" name="Staff" role="Shop Staff" />
  </AppHeader>

  <ScreenTitle
    title="Orders"
    subtitle="Manage and track all shop orders"
  />

  <SearchRow>
    <SearchField placeholder="Search order, customer, service, payment..." />
    <IconButton icon="sliders" />
  </SearchRow>

  <SegmentedFilterBar
    filters={[
      { label: "All", count: 0, active: true },
      { label: "Accept", count: 0 },
      { label: "Receive & Verify", count: 0 },
      { label: "Processing", count: 0 },
      // ...more, horizontally scrollable
    ]}
  />

  <EmptyState
    illustration={<EmptyStateIllustration />}
    title="No orders here"
    description="Orders assigned to your shop will show up here as they move through the pipeline."
    tip="New orders from customers will appear here once they are assigned to your shop."
  />

  <BottomTabBar
    items={[
      { icon: "clipboard", label: "Orders", active: true },
      { icon: "qr-scan", label: "Scan" },
      { icon: "user", label: "Profile" },
    ]}
  />
</OrdersScreen>
```

## Reuse notes

- `EmptyState`, `TipCallout`, `SegmentedFilterBar`, `SearchField`, `BottomTabBar` are generic and should live in the shared partner-mobile design system, not be screen-specific.
- `EmptyStateIllustration` should be swappable per context (e.g., different art for "no orders" vs "no customers" vs "no history") — treat it as a prop/slot, not hardcoded inside `EmptyState`.
- Filter pill counts (`0`) are live data, not static — bind to actual order counts per status.
