# 2026-09-30 12:55 — Route multi-token CJK clicks to phrase endpoint

## Context

User reported a console error on the Japanese reader:

```
Word must be a single token
src/lib/claude.ts (75:11) @ streamWordGloss
```

The browser DevTools showed the offending URL payload: `内容について確認しました\nチェックをする` (two sentences joined by a newline). The reader's `handleWordClick` was sending that text to the word-gloss endpoint, which the API rejects with `400` when the body contains more than one whitespace-separated token.

Root cause: the routing check was `const isPhrase = word.includes(' ')`. Japanese text doesn't use spaces, so any selection that crossed a line break — or a stray newline between sentences — looked like a single "word" to the check, then hit the server's single-token guard.

## Files affected

- `src/app/read/[bookId]/page.tsx` (1 hunk, ~10 lines)

## Before vs After

**Before**
```ts
currentWordSourceRef.current = source ?? null;
const isPhrase = word.includes(' ');

// ...
if (isPhrase) {
  const phraseWords = word.trim().split(/\s+/).filter(Boolean).length;
```

**After**
```ts
currentWordSourceRef.current = source ?? null;
// CJK text doesn't use spaces, so a click can carry newlines / multiple
// sentences that look like one "word" to `word.includes(' ')`. Count tokens
// by any whitespace so multi-line selections route to the phrase endpoint
// instead of hitting the server's single-token guard with a 400.
const tokenCount = word.trim().split(/\s+/).filter(Boolean).length;
const isPhrase = tokenCount > 1;

// ...
if (isPhrase) {
  const phraseWords = tokenCount;
```

## Reasoning

The phrase endpoint (`POST /api/translate`) already handles multi-token input — it asks for a literal breakdown, idiomatic meaning, etc. The word-gloss endpoint is intentionally single-token because it tries to be the cheap "give me one meaning for this one word" path. The fix is purely client-side routing: if the selection has more than one whitespace-separated token, treat it as a phrase.

## Risks / side effects

- Single-word clicks (the common case) are unchanged — `tokenCount === 1` → `isPhrase === false` → falls through to the word path exactly as before.
- For users with the Free plan and a multi-token selection, this now triggers the phrase-selection cap check (`phraseSelectionLimitPayload`) where before it bypassed it. That's the correct behaviour.
- No server-side change. No new dependency. No migration.
