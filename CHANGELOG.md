# Changelog

## 2026-09-30 12:55

- Fix read-page handler routing multi-token CJK selections (newline-separated text, accidental multi-sentence drags) to the phrase-translation endpoint instead of failing the word-gloss server guard with `Word must be a single token` (400).
  - `src/app/read/[bookId]/page.tsx`: replaced `word.includes(' ')` token heuristic with `word.trim().split(/\s+/).filter(Boolean).length > 1`. The phrase path already accepts multi-token input; this routes it correctly instead of bouncing it at the server.
  - Rationale: Japanese / Chinese text has no spaces, so `内容について確認しました\nチェックをする` looked like a single word to the old check, then the gloss endpoint's single-token regex rejected it.
  - Risks: low — pure routing change. If the user genuinely clicked a single Japanese word, `tokenCount` is 1 and behaviour is unchanged.

## 2026-10-10 14:46

- Register English ("en") as a monolingual learnable language (English-to-English definitions). Step 1 of two: registration only; the monolingual dictionary script (Step 2) follows next.
  - `languages/types.ts`: added optional `monolingual?: boolean` to `LanguageConfig` so the dictionary builder and lookup layer can branch on same-language glosses.
  - `languages/en/manifest.ts` (new): English manifest with `monolingual: true`, US flag, Google TTS config, and an `avoidWords` stop-word set for the SRS.
  - `languages/registry.ts`: imported `en` and added it to `MANIFESTS` (alphabetically between `eo` and `es`), which widens `LanguageCode` to include `'en'` and surfaces the language in the picker automatically.
  - `src/components/ChatWidget/constants.ts`: added `en` entry to `EXAMPLE_PROMPTS` (type now requires it).
  - `languages/tokenizer/tokenizer.test.ts`: added English text samples to the `CORPUS` legacy-parity goldens (type now requires it; English uses the Latin script the oracle already covers).
  - Rationale: the script-agnostic tokenizer dispatches on `pack.script.kind`, so English (`alpha-spaced`) tokenizes correctly with no code changes. The MarkdownReader already tokenizes by the lesson's language, not the UI language, so a target-language match with the UI language never skips tokenization.
  - Risks: low — no runtime changes for existing languages. Dictionary download for English is not pinned yet (Step 2); lookups fall back to AI until then.

## 2026-10-10 14:57

- Add English dictionary build profile to `scripts/build-dictionary.ts` with multi-language dump filtering. Step 2 of English language registration.
  - Extended `LangProfile` interface: added `langFilter?: string` (skip entries whose `lang` field doesn't match) and `skipEntryTags?: string[]` (skip entries/senses carrying disqualifying tags like form-of, proper-noun, abbreviation).
  - Extended `KaikkiLine` interface: added `lang?: string` and `tags?: string[]`.
  - Extended `KaikkiSense` interface: added `tags?: string[]`.
  - Modified `extractEntry` function: applies `langFilter` check early (before any processing), then checks entry-level and sense-level `tags` against `skipEntryTags`.
  - Added `en` profile to `PROFILES`:
    - `kaikkiUrls`: canonical `/English/` dump URL
    - `letterClass`: `a-zA-Z'-` (apostrophe as token boundary, hyphen for compounds)
    - Empty `prefixes`/`suffixes`: English resolves via kaikki form-of entries + inflection tables
    - `vowels`: `aeiouy`
    - `glossFilter: true`: drops gloss-less entries (large thesaurus section)
    - `langFilter: 'English'`: filters the multi-language dump to English-only entries
    - `skipEntryTags`: drops form-of, alt-of, proper-noun, abbreviation, abbrev, initialism, symbol, punctuation
    - `skipPos`: drops abbrev, initialism, punct, symbol parts of speech
  - Added `scripts/gen-coverage-corpus-en.py`: generates the top-5000 English wordfreq corpus file.
  - Added `scripts/coverage-corpus-en.txt`: 4,911 alpha-filtered English tokens for the coverage gate.
  - Rationale: English Wiktionary's dump is multi-language (entries for every language share one file), so filtering on `lang === "English"` at the entry level is required to keep non-English headwords out of the English dictionary. The skipEntryTags filter prevents form-of and proper-noun entries from crowding the lookup table with no dictionary value.
  - Risks: The English dump is multi-GB; the streaming path handles this, but the first build will download several GB. The skipEntryTags filter may over-prune if kaikki's tag vocabulary differs from expectations; this can be tuned after a test build.
