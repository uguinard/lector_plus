# 2026-09-30 12:55 — Read-page CJK routing fix

## Context

The reader page's `handleWordClick` used `word.includes(' ')` to decide
between the word-gloss path and the phrase-translation path. CJK text has
no spaces, so a multi-sentence drag or a newline-separated selection
(`内容について確認しました\nチェックをする`) looked like a single word to
the heuristic, then the word-gloss server guard rejected it with
`Word must be a single token` (400). The phrase-translation endpoint
already accepts multi-token input, so the fix is purely client-side routing.

## Files affected

- `src/app/read/[bookId]/page.tsx`
- `CHANGELOG.md`

## Before / After

Before:

```ts
const isPhrase = word.includes(' ');
```

After:

```ts
const isPhrase = word.trim().split(/\s+/).filter(Boolean).length > 1;
```

## Reasoning

- Real whitespace-token counting matches the server's token-count guard,
  so client and server agree on what "phrase" means.
- Spaces and newlines are both whitespace per `\s+`, so accidental
  multi-sentence drags (newline-separated) and Latin phrases with spaces
  both land on the phrase path.
- Latin single words (`dog`, `casa`): `tokenCount === 1` → word path,
  unchanged.
- CJK single words (`日本語`): `tokenCount === 1` → word path, unchanged.
- CJK newline-separated text (`日本語\nチェックをする`): `tokenCount > 1` →
  phrase path, was previously the broken case.

## Risks / side effects

- Pure routing change. No API contract change, no DB change, no UI change.
- Single CJK word still routes to the word path (same as before); the fix
  only changes behaviour for the multi-token case.
- Other call sites in the same file (`lines 593, 625, 795, 887, 1041,
1253, 1339, 1356-1357`) still use `word.includes(' ')`. Those are
  server-side or feature-flag checks, not the routing decision this bug
  was about. Leaving them alone keeps the change minimal — broad
  sweeping of the heuristic would risk regressing unrelated branches.
