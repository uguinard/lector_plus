# Changelog

## 2026-09-30 12:55

- Fix read-page handler routing multi-token CJK selections (newline-separated text, accidental multi-sentence drags) to the phrase-translation endpoint instead of failing the word-gloss server guard with `Word must be a single token` (400).
  - `src/app/read/[bookId]/page.tsx`: replaced `word.includes(' ')` token heuristic with `word.trim().split(/\s+/).filter(Boolean).length > 1`. The phrase path already accepts multi-token input; this routes it correctly instead of bouncing it at the server.
  - Rationale: Japanese / Chinese text has no spaces, so `内容について確認しました\nチェックをする` looked like a single word to the old check, then the gloss endpoint's single-token regex rejected it.
  - Risks: low — pure routing change. If the user genuinely clicked a single Japanese word, `tokenCount` is 1 and behaviour is unchanged.
