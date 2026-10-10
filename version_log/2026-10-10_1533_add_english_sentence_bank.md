## Context

Step 3 of English language registration: the sentence (cloze) bank for English
practice sentences. The dictionary (Step 2) was already built successfully.
The user explicitly requested that ALL words (including function words like
"the", "and", "in") be included as cloze targets — no stop-word filtering.

## Files Affected

- `scripts/build-cloze-en.py` (new) — English Tatoeba cloze bank generator
- `api/src/lib/sentence-bank-en.json` (new) — generated sentence bank (8,859 rows)
- `api/src/routes/cloze.ts` — registered `en` in `SENTENCE_BANKS` map

## Before vs After

### New script (`scripts/build-cloze-en.py`)

Modeled after `scripts/build-cloze-it.py`, adapted for a monolingual English pack:

- Uses `eng_sentences.tsv.bz2` (Tatoeba English sentences) and
  `eng-eng_links.tsv.bz2` (English-to-English sentence links = paraphrases)
- Source sentences are English; "translations" are linked English paraphrases
- `AVOID_WORDS` is intentionally empty — all content words pass through as
  candidate cloze targets (user preference)
- Filters by dictionary POS only (`useful_dictionary_word`): keeps content words
  (noun/adj/adv/verb/num/intj), excludes proper nouns (`name` in POS)
- wordfreq top-N list provides frequency ranking for top500/top1000/top2000 bands

### New JSON (`api/src/lib/sentence-bank-en.json`)

Generated output with 8,859 rows, 1,863 unique cloze words.

Each row format matches existing banks:
```json
{
  "id": 17174,
  "text": "He who pays the piper calls the tune.",
  "translation": "He who pays the piper calls the tune.",
  "clozeWord": "the",
  "clozeIndex": 3,
  "wordRank": 1,
  "collection": "top500"
}
```

### Route registration (`api/src/routes/cloze.ts`)

Before:
```typescript
const SENTENCE_BANKS: Record<string, () => Promise<{ default: unknown }>> = {
  af: () => import('../lib/sentence-bank-af.json'),
  ...
  el: () => import('../lib/sentence-bank-el.json'),
  eo: () => import('../lib/sentence-bank-eo.json'),
  ...
};
```

After:
```typescript
const SENTENCE_BANKS: Record<string, () => Promise<{ default: unknown }>> = {
  af: () => import('../lib/sentence-bank-af.json'),
  ...
  el: () => import('../lib/sentence-bank-el.json'),
  en: () => import('../lib/sentence-bank-en.json'),    // ← added
  eo: () => import('../lib/sentence-bank-eo.json'),
  ...
};
```

## Reasoning

The English pack is monolingual (English-to-English). Tatoeba's `eng-eng_links`
file links English sentences to other English sentences that are paraphrases or
alternate phrasings — these serve as the "translation" for the cloze exercise.
This is conceptually identical to how other language packs use a separate
language's sentence export as the translation.

Per user instruction, no stop-word filtering is applied. All content words
(words with noun/verb/adjective/adverb/sense in their POS) are retained as
cloze targets. The only exclusion is proper names (POS contains `name`), since
a personal or place name is not a generalizable cloze target.

## Risks / Side Effects

- The English sentence bank includes extremely common words as cloze targets
  (e.g., "the", "and", "in"). This is intentional per user preference but means
  some cloze exercises will be very easy (the blank is filled by context alone).
- The bank has 8,859 rows vs. ~7,000-9,000 for other Latin-script languages,
  which is within the expected range.
- Coverage is 85.2% (1,704/2,000 candidates), meeting the typical threshold.
