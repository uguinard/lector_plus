# Settings Page Tabs

## Context

Settings page (`src/app/settings/page.tsx`) rendered 17 components sequentially in a `div className="space-y-8"`, making navigation difficult. The plan identified 6 logical tab groups and specified creating a new `tabs.tsx` component.

## Files Affected

### Created
- `src/components/ui/tabs.tsx`

### Modified
- `src/app/settings/page.tsx`

## Before vs After

### Before (page.tsx)
```tsx
<div className="space-y-8">
  {lectorMode() === 'cloud' && <CloudPlanSettings />}
  <LanguagesSettings />
  <ProseSettings />
  ...
</div>
```

### After (page.tsx)
```tsx
<Tabs defaultValue={TAB_APPEARANCE}>
  <TabsList>
    <TabsTrigger value={TAB_APPEARANCE}>Appearance</TabsTrigger>
    <TabsTrigger value={TAB_PRACTICE}>Practice</TabsTrigger>
    ...
  </TabsList>
  <TabsContent value={TAB_APPEARANCE}>
    <div className="space-y-8">
      <HighlightingSettings />
      <ThemeSettings />
      <ProseSettings />
    </div>
  </TabsContent>
  ...
</Tabs>
```

## Reasoning

- **Radio-input state pattern**: `Tabs` holds active tab state via `useState`, passed through `TabsContext`. No external state library needed.
- **Active indicator**: `border-b-2 border-primary` + `text-primary` on active trigger; `border-transparent` + `text-muted-foreground` on inactive.
- **Tab groups**: Appearance (Highlighting+Theme+Prose), Practice, Languages, Data & Integration, Account, Misc — mirrors the plan's 6-group structure.
- **Conditional rendering preserved**: `CloudPlanSettings` and `BYOKSettings`/`LLMSettings` remain conditional on `lectorMode()` exactly as before.
- **`panel p-6` preserved inside each tab panel**: Each settings component still has its own `section className="panel p-6"` wrapper.

## Validation

- `npx tsc --noEmit`: clean (no output)
- `npm test`: 852 passed (53 test files)

## Risks & Side Effects

- None: all 17 settings components keep their exact props and behavior; only the parent layout changed.
