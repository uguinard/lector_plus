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

## 2026-10-10 15:02

- Fix `parseLangArg` to accept bare positional language argument (e.g., `build-dictionary.ts en`) in addition to `--lang en`.
  - `scripts/build-dictionary.ts`: `parseLangArg` now checks for non-dash argv entries that match a known PROFILES key, before falling back to `af`.
  - Rationale: the script was only invoked with `--lang` syntax internally; a bare positional argument silently fell through to the `af` default.
  - Risks: low — only adds a new code path; `--lang` syntax unchanged.

- Add English dictionary release placeholders to `dict.env`.
  - Added `en` to the `DICT_LANGS` list (between `de` and `es`, alphabetical).
  - Added placeholder `DICT_VERSION_EN=` and `DICT_SHA256_EN=` lines at the bottom; empty values mean `en` is not yet "published" in the pin manifest (`parseDictEnv` skips languages without both a version and sha256).
  - Rationale: the dictionary build now produces `dictionary-en.db` successfully; the release tag and sha256 will be filled in when a release is cut.
  - Risks: low — the `dict-pins.test.ts` suite verifies that every listed language has a valid pin, and `en` is correctly excluded until values are populated.

- Successfully built English dictionary: 734,875 entries, 1,065,504 senses, 434,108 inflections, 240 MB, 98.3% coverage.
  - `data/dictionary-en.db`: built from the 3.1 GB kaikki English dump (1,492,836 lines).
  - 1,057 glossless entries dropped by `glossFilter`.
  - Coverage 4,827/4,911 wordfreq tokens = 98.3%, well above the 85% threshold.

## 2026-10-10 15:33

- Create English sentence bank generator script (`scripts/build-cloze-en.py`).
  - Modeled after `scripts/build-cloze-it.py` but adapted for a monolingual pack:
    uses `eng-eng_links.tsv` to find paraphrase sentences as "translations".
  - Candidate words come from wordfreq top-N list, filtered only by dictionary
    POS (content words: noun/adj/adv/verb/num/intj; proper nouns excluded).
  - All content words pass through as cloze targets — no stop-word exclusion.
  - Sentence length filtered to 5–20 words; sentences-per-word capped at 6.
  - Downloads Tatoeba `eng_sentences.tsv.bz2` and `eng-eng_links.tsv.bz2`
    (cached in `tmp/cloze-en/`).
  - Prerequisites noted: requires `pip install wordfreq` and the English dict DB.

- Generate English sentence bank (`api/src/lib/sentence-bank-en.json`).
  - 8,859 rows, 1,704/2,000 candidate words covered (85.2%).
  - Collections: top500=2,793, top1000=2,401, top2000=3,665.
  - Cloze targets include all content words — high-frequency ones like "the",
    "and", "in", "with" are intentionally included per user preference.

- Register `en` in the `SENTENCE_BANKS` map in `api/src/routes/cloze.ts`.
  - Added `en: () => import('../lib/sentence-bank-en.json')` alphabetically
    between `el` and `eo`, following the same lazy-import pattern as all other
    languages.
