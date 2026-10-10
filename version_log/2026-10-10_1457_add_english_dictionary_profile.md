## Context

Step 2 of English language registration: the `languages/en/manifest.ts` was added in the previous change (2026-10-10 14:46), but the dictionary build script (`scripts/build-dictionary.ts`) had no `en` profile. English Wiktionary's kaikki dump is multi-language — a single JSONL file contains entries for every language, distinguished by the `lang` field. Without filtering, non-English entries would pollute the English dictionary.

## Files Affected

- `scripts/build-dictionary.ts` — extended interfaces and `extractEntry` function, added `en` profile
- `scripts/gen-coverage-corpus-en.py` (new) — generator for English coverage corpus
- `scripts/coverage-corpus-en.txt` (new) — 4,911 English tokens for coverage gate

## Before vs After

### Interface extensions

**Before:**
```typescript
interface KaikkiLine {
  word?: string;
  pos?: string;
  etymology_text?: string;
  ...
}

interface KaikkiSense {
  glosses?: string[];
}
```

**After:**
```typescript
interface KaikkiLine {
  word?: string;
  pos?: string;
  lang?: string;          // ← added
  tags?: string[];        // ← added
  etymology_text?: string;
  ...
}

interface KaikkiSense {
  glosses?: string[];
  tags?: string[];        // ← added
}
```

### LangProfile extensions

**Before:** no multi-language dump filtering support.

**After:** two new optional fields:
- `langFilter?: string` — skip entries whose `lang` field doesn't match
- `skipEntryTags?: string[]` — skip entries whose own `tags` or any sense's `tags` contains a disqualifying tag

### extractEntry changes

**Before:** `extractEntry` had no language filter; it only checked `requireSoundTag`, `skipFormPattern`, and `skipPos`.

**After:** two new filters added at the top of `extractEntry`:
```typescript
// Multi-language dump filter
if (PROFILE.langFilter && raw.lang !== PROFILE.langFilter) return null;

// Entry-level or sense-level tag filter
const skipTags = PROFILE.skipEntryTags;
if (skipTags && skipTags.length > 0) {
  if (raw.tags?.some((t) => skipTags.includes(t))) return null;
  if (raw.senses?.some((s) => s.tags?.some((t) => skipTags.includes(t)))) return null;
}
```

### New en profile

**Before:** no English entry in `PROFILES`.

**After:** full English profile:
```typescript
en: {
  kaikkiUrls: ['https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl'],
  letterClass: "a-zA-Z'-",
  prefixes: [],
  suffixes: [],
  vowels: 'aeiouy',
  rootsJsonRel: null,
  coverageCorpusRel: 'scripts/coverage-corpus-en.txt',
  glossFilter: true,
  langFilter: 'English',
  skipEntryTags: ['form-of', 'alt-of', 'proper-noun', 'abbreviation', 'abbrev', 'initialism', 'symbol', 'punctuation'],
  skipPos: ['abbrev', 'initialism', 'punct', 'symbol'],
}
```

## Reasoning

English Wiktionary's kaikki dump is multi-language. Each JSONL line has a `lang` field identifying the language (e.g., "English", "French", "German"). Without `langFilter: 'English'`, building the English dictionary would include entries for every language, polluting lookups with words like "parlé" (French) and "Haus" (German).

The `skipEntryTags` filter prevents:
- `form-of`/`alt-of`: inflected forms that are redundant with the main lemma entry (they have glosses, so they survive `glossFilter`)
- `proper-noun`: names (London, Paris) are not typically looked up in a dictionary
- `abbreviation`/`abbrev`/`initialism`: abbreviations (UK, CEO) are not dictionary headwords for a reader
- `symbol`/`punctuation`: non-word entries

These entries have glosses (they survive `glossFilter`) and would otherwise crowd the lookup table with entries that have no dictionary value for a reader.

## Risks / Side Effects

- The English dump is multi-GB; the streaming path handles this, but the first build will be slow (download + parse).
- The `skipEntryTags` list is based on expected kaikki tag vocabulary; if the dump uses different tags (e.g., `form_of` instead of `form-of`), the filter needs adjustment. This can be tuned after a test build.
- The coverage corpus uses wordfreq English top-5000; the 85% coverage threshold may need adjustment if English Wiktionary coverage is lower.
