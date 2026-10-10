# Hint Endpoint + UI

## Context

The English cloze practice page needed a "Show Definition" hint button so learners
can reveal a one-sense gloss for the blanked word without seeing the word itself.
The API had no endpoint to surface a distilled hint (the existing `/lookup` returns
all senses plus related forms — too much).

## Files Affected

- `api/src/routes/dictionary.ts` — added `GET /api/dictionary/hint/:word` handler
- `api/src/lib/openapi/annotations.ts` — added `GET /api/dictionary/hint/{word}` op-doc
- `api/openapi.json` — regenerated (103 endpoints)
- `src/lib/dictionary-client.ts` — added `getHint()` + `HintResponse` interface
- `src/app/practice/page.tsx` — added 💡 hint button, `definitionHint`/`definitionHintLoading` state, `handleDefinitionHint` callback, hint display above type-mode buttons
- `api/src/routes/dictionary.test.ts` — added 3 tests (hit, miss, empty word)

## Before / After

**Before:** No hint endpoint existed. The practice page had no definition-reveal affordance.

**After:** The hint endpoint calls `lookupWord()` and returns the single best sense:

```typescript
// api/src/routes/dictionary.ts
app.get('/hint/:word', (c) => {
  const { word } = c.req.param();
  if (!word || !word.trim()) return c.json({ error: 'Word is required' }, 400);
  const entry = lookupWord(userId, word.trim(), lang);
  if (!entry || entry.senses.length === 0) return c.json({ hint: null }, 404);
  const sense = entry.senses[0];
  return c.json({
    hint: { word: entry.word, gloss: sense.gloss, partOfSpeech: sense.partOfSpeech || null },
  });
});
```

Client:

```typescript
// src/lib/dictionary-client.ts
export interface HintResponse { word: string; gloss: string; partOfSpeech: string | null }
export async function getHint(word: string): Promise<HintResponse> { ... }
```

## Reasoning

- The hint reveals only the top sense's gloss + POS — the learner still must type the word.
- `usedHint` tracking is intentionally NOT persisted to the DB (Free plan takeout budget has < 170 KiB margin; a boolean column per sentence would exceed it). The `definitionHint !== null` check on answer time serves as the transient client-side marker.
- Hint button is disabled once a hint is shown (prevents repeated reveals).

## Risks / Side Effects

- The hint endpoint is `GET` with `:word` path param — URLs are logged in access logs. Words are practice cloze targets (not personal data), so this is acceptable.
- No DB schema changes — fully additive.
