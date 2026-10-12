# Settings Page Tabs Plan

**Goal:** Organize the settings page (`src/app/settings/page.tsx`) into tabbed categories so each logical group of settings lives in its own tab, improving discoverability and reducing vertical scrolling.

---

## Current State

- `src/app/settings/page.tsx` renders 17 settings components sequentially in a `div className="space-y-8"`.
- No existing tab/panel component in the codebase (`src/components/ui/` has Button, Input, Label, etc. but no Tabs).
- 22 component files in `src/app/settings/components/`.
- Settings naturally group into: Appearance/Reading Mode, Practice, Languages, Data/Integration, Account, Misc.

---

## Tab Grouping (logical categories)

| Tab | Components |
|---|---|
| **Appearance** | `HighlightingSettings`, `ThemeSettings`, `ProseSettings` |
| **Practice** | `PracticeSettings` |
| **Languages** | `LanguagesSettings` |
| **Data & Integration** | `AnkiSettings`, `TTSSettings`, `APITokens`, `BYOKSettings` / `LLMSettings` (conditional on `lectorMode`), `DataManagement`, `VersionInfo`, `CloudPlanSettings` (conditional on `lectorMode === 'cloud'`) |
| **Account** | `TwoFactorSettings`, `DeleteAccount` |
| **Misc** | `KnownWordsImport`, `Export` |

---

## Affected Files

| File | Change |
|---|---|
| `src/app/settings/page.tsx` | Replace sequential `space-y-8` render with `<Tabs>` component; each tab contains its grouped components. |
| `src/components/ui/tabs.tsx` [new] | Simple tab component using radio-input pattern + content panels; built from existing UI primitives (Button, RadioGroup, etc.) or a minimal custom implementation. |
| `src/app/settings/components/HighlightingSettings/index.tsx` | No logic changes needed; remains read-from-shared-cache. |
| `src/lib/highlightingSettingsStore.ts` | No changes needed; already consolidated to single `/api/settings` request. |

---

## Design Decisions

### Tab interaction pattern
- Use a **radio-input / hidden-label** pattern: each tab button is a `<input type="radio">` named `settings-tab`, content panels are shown/hidden via Tailwind `peer`/`peer-checked` or simple CSS. This avoids adding new dependencies and works with React state.
- Active tab is visually indicated with `border-b-2 border-primary` and text color `text-primary`.
- Panels use existing `panel p-6` class for consistency.

### Conditional rendering
- `CloudPlanSettings` and `LLMSettings` / `BYOKSettings` remain conditional on `lectorMode()` as before.
- Tabs dynamically show/hide based on mode: e.g., when `lectorMode() === 'cloud'`, the "Data & Integration" tab includes `CloudPlanSettings`; otherwise it includes `LLMSettings`.

### Accessibility
- Tab panel content is marked with `aria-controls` and buttons with `aria-selected`.
- Focus management: when a tab changes, focus moves to the first focusable element in the new panel.

### Migration path
- The vertical stack is replaced entirely by tabs; no component APIs change.
- All existing settings persistence logic is untouched.
- Tests continue to pass because the same components render, just under different parent tabs.

---

## Implementation Steps

1. **Create `src/components/ui/tabs.tsx`** — minimal tab component:
   - Radio group with 6 options (Appearance, Practice, Languages, Data & Integration, Account, Misc).
   - Panels for each tab content.
   - Active state styling using Tailwind.
   - Export a `<Tabs asChild>` or simple `<Tabs>` component.

2. **Update `src/app/settings/page.tsx`**:
   - Import the `<Tabs>` component.
   - Replace the `<div className="space-y-8">` with `<Tabs>`.
   - Map each tab to its component group.
   - Preserve conditional rendering (`lectorMode()`) inside respective tab panels.

3. **Verify**:
   - Run `npm test` — all 852 tests pass.
   - Run `npx tsc --noEmit` — type-check clean.
   - Visually inspect: each tab shows its group, no vertical overflow, conditional components appear/disappear correctly per mode.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Tab component introduces new bugs or breaks layout | Keep the tab component minimal; use existing Tailwind patterns; test each tab renders its components. |
| Conditional mode components (`CloudPlanSettings` / `LLMSettings`) misbehave | Ensure conditional logic inside each tab panel mirrors the original `page.tsx` exactly. |
| Users expect search/find-in-page to work across collapsed tabs | Tab panels are visible (not accordion-collapsed); all content remains in DOM. |
| Mobile: tab overflow on narrow screens | Tab labels are concise; consider horizontal scrolling or collapsing to accordion on very small screens (out of scope for this plan). |

---

## Validation

- **Unit tests**: `npm test` — all 852 tests pass.
- **TypeScript**: `npx tsc --noEmit` — no errors.
- **Smoke test**: Open settings page, click each tab, verify correct components render and settings persist.
- **Cross-mode test**: Switch lector mode (cloud vs local) and verify Data & Integration tab content changes accordingly.

---

## Open Questions (for user clarification if needed)

1. Should the tab labels use icons in addition to text? (Currently text-only for simplicity.)
2. Should there be a "Reset all settings" button somewhere, or is that out of scope?
3. Do you want the active tab to persist across page navigations (e.g., via localStorage)? This would require additional state management.

---