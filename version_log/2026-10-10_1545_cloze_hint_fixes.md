# Cloze Hint Button: Monolingual Defaults, Reliable Feedback, Stable Blank

## Context

Three issues were reported on the cloze practice page's 💡 "Show Definition"
button and blank rendering:

1. No monolingual-aware defaults (translation should be OFF and definition ON
   when the language pack has `monolingual: true`, e.g. English EN→EN).
2. The 💡 button sometimes does nothing — returns no visible feedback on miss.
3. The blank input/gap animates (grows and snaps back) on every state change,
   not just on question transitions.

## Files Affected

- `src/lib/dictionary-client.ts` — changed `getHint()` return type to
  `HintResult` discriminated union (distinguishes "not-found" from "error").
- `src/app/practice/page.tsx` — monolingual-aware defaults, auto-hint on new
  question, visible "No definition available" message, loading state, stable
  key on blank, `transition-all` → `transition-colors`, `transition-none` on MC blank.
- `src/lib/data-layer.ts` — added `Array.isArray` guards to all cloze-sentence
  fetch functions (`getClozeSentencesByCollection`, `getNewSentencesByCollection`,
  `getClozeSentencesDueForReview`, `getAllClozeSentences`,
  `getClozeSentencesForWord`, `getOnboardingCloze`) to prevent
  `sentences.map is not a function` when the API returns an error object.
- `api/src/routes/dictionary.ts` — (unchanged; already uses active language
  via `resolveLanguage`).
- `api/src/routes/dictionary.test.ts` — 3 hint tests (hit, miss, 400).
- `CHANGELOG.md` / `version_log/` — updated.

## Before / After

**Fix 1 — Monolingual defaults:**
Before: `showTranslation` always initialized to `true` regardless of language.
After: `isMonolingual` computed from `getActivePack().monolingual`; translation
defaults to `false` for monolingual packs; definition hint auto-shows on each
new question for monolingual packs.

**Fix 2 — Always-visible feedback:**
Before: `getHint()` returned `HintResponse | null` — the UI couldn't
distinguish a miss from an error, and showed nothing on either.
After: `getHint()` returns `HintResult` with `{ ok, hint }` or
`{ ok: false, reason: 'not-found' | 'error' }`. The page shows
"No definition available for this word." when the word is a genuine miss,
and logs + toasts on error. The 💡 button already showed "…" while loading.

**Fix 3 — Stable blank:**
Before: The input had `transition-all` (animating width/min-width on every
class change); the MC blank span had no stable key and no `transition-none`.
After: Input uses `transition-colors` only; both blank variants get
`key={`blank-${current.sentence.id}`}` so they remount only on question change;
MC blank has `transition-none`.

## Reasoning

- Monolingual languages (EN→EN): a foreign-language translation is meaningless,
  so hiding it and defaulting to a definition hint is the correct study aid.
  Non-monolingual languages keep existing behavior unchanged.
- The hint endpoint already resolves the active language via
  `getActiveLanguage()` at the `getHint` call site — verified no hardcoded
  language in the fetch path.
- `lookupWord()` on the server already tries inflection tables, morphology
  peeling, and the AI cache — so "surface form first, then lemma" is handled
  server-side. The client only needs to show feedback on the final miss.
- `transition-all` was the root cause of the grow-and-snap: any class change
  (e.g. `inputColorClass` via `fuzzyStatus`) triggered a width animation.
  `transition-colors` limits animation to color-only, which is fast and
  imperceptible.

## Risks / Side Effects

- The auto-hint `useEffect` adds one extra API call per question for monolingual
  languages. The `getHint` function hits the dictionary cache (no AI call on
  miss), so the cost is one SQLite read per new question.
- The "No definition available" message persists until the user advances to the
  next question (reset in `prepareSentence`), preventing repeated clicks on a
  dead button.
- The `Array.isArray` guards in `data-layer.ts` degrade gracefully to an empty
  array when the API returns an error object (e.g. 401/429 JSON body instead of
  the expected sentence array), preventing the `TypeError: sentences.map is not
a function` crash observed in the practice page console.
