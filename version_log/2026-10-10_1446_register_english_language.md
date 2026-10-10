# Register English ("en") as a monolingual learnable language

## Context
English ("en") was added to the language registry as a monolingual pack —
English-to-English definitions rather than translations into a pivot language.
This is Step 1 of a two-step plan: register the language in the UI/registry,
then (Step 2) build the monolingual dictionary script.

## Files affected
- `languages/types.ts` — added optional `monolingual?: boolean` to `LanguageConfig`.
- `languages/en/manifest.ts` — new file; English language manifest.
- `languages/registry.ts` — imported `en` and added it to `MANIFESTS` (alphabetically between `eo` and `es`).
- `src/components/ChatWidget/constants.ts` — added `en` entry to the `EXAMPLE_PROMPTS` record (required by the `Record<LanguageCode, string[]>` type).
- `languages/tokenizer/tokenizer.test.ts` — added `en` English text samples to the `CORPUS` golden list (required by the `Record<Exclude<LanguageCode, ...>, string[]>` type).

## Before vs After

### `languages/types.ts` (LanguageConfig interface)
Before:
```typescript
  /** Flag emoji. */
  flag: string;
  /** Primary TTS locale, e.g. "de-DE". Required when 'google' ∈ pronunciation.audio. */
  ttsCode?: string;
```

After:
```typescript
  /** Flag emoji. */
  flag: string;
  /**
   * True for a monolingual learnable language — e.g. English learned
   * English-to-English — where the dictionary carries definitions in the same
   * language rather than translations into a pivot. The dictionary builder and
   * the lookup layer branch on this so the UI renders a same-language gloss
   * instead of a foreign one.
   */
  monolingual?: boolean;
  /** Primary TTS locale, e.g. "de-DE". Required when 'google' ∈ pronunciation.audio. */
  ttsCode?: string;
```

### `languages/en/manifest.ts` (new file)
```typescript
export const en = {
  name: 'English',
  native: 'English',
  code: 'en' as const,
  flag: '\u{1F1FA}\u{1F1F8}', // 🇺🇸
  ttsCode: 'en-US',
  ttsVoice: 'en-US-Standard-A',
  tatoebaCode: 'eng',
  fallbackTts: ['en', 'en-US', 'en-GB'],
  avoidWords: AVOID_WORDS,
  testPhrase: 'Hello, how are you?',
  pronunciation: { audio: ['google'] as const },
  monolingual: true,
  script: {
    bcp47: 'en',
    direction: 'ltr' as const,
    kind: 'alpha-spaced' as const,
    hasCase: true,
  },
};
```

### `languages/registry.ts`
Before:
```typescript
import { eo } from './eo/manifest';
import { es } from './es/manifest';
```
After:
```typescript
import { eo } from './eo/manifest';
import { en } from './en/manifest';
import { es } from './es/manifest';
```

And in the `MANIFESTS` object, `en` was added between `eo` and `es`.

### `src/components/ChatWidget/constants.ts`
Added an `en` entry with three English grammar example prompts (required by the `Record<LanguageCode, string[]>` type).

### `languages/tokenizer/tokenizer.test.ts`
Added five English sentences to the `CORPUS` object (required by the `Record<Exclude<LanguageCode, ...>, string[]>` type). English qualifies for legacy-parity testing because it uses the standard Latin script that the oracle regex covers.

## Reasoning
- `monolingual` is optional so existing packs are unaffected; only English sets it.
- English uses the standard Latin script (`alpha-spaced`, `hasCase: true`) with no per-script overrides — identical to how `de`, `es`, `pl`, etc. are configured. No case-fold locale, no extra joiners, no extra word chars, no extra token patterns.
- The US flag (🇺🇸) is used as the most common convention for English in language-learning contexts.
- `ttsVoice: 'en-US-Standard-A'` follows the Standard-A pattern used by every other Latin-script Google-TTS pack in the registry.
- `avoidWords` includes common English stop words (articles, conjunctions, prepositions, pronouns, auxiliary verbs) so the SRS won't generate flashcards for grammar particles.

## Tokenizer edge case (Task 4)
Verified that the existing script-agnostic tokenizer correctly handles English without any code changes:
- `tokenize()` in `languages/tokenizer/index.ts` dispatches on `pack.script.kind`. English (`alpha-spaced`) uses the same Unicode-property regex engine as all other Latin-script languages. The `WORD_CHAR` class (`\p{L}\p{M}0-9_`) covers all English letters.
- `MarkdownReader` (`src/components/MarkdownReader/index.tsx:44-52`) tokenizes by the **lesson's** language, not the active UI language, so English text is always processed regardless of the UI language setting. The comment explicitly states this is to prevent language mismatches.
- There is **no** code path that skips tokenization when the target language matches the UI language. The only engine divergence is for `cjk-unspaced` packs (Chinese/Japanese), which English does not use.

## Risks / side effects
- Low — no runtime behavior changes for existing languages.
- The `EXAMPLE_PROMPTS` and `CORPUS` test additions are type-driven: the `Record<LanguageCode, ...>` shape requires every language to have an entry.
- Dictionary download for English is NOT included in this step; it requires a `dict.env` pin entry, which will be added when Step 2 builds the monolingual dictionary. Without a dictionary, English lookups fall back to AI (the documented behavior).
