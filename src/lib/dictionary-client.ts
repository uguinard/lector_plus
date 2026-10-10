/**
 * Client-side dictionary lookup. Calls /api/dictionary/lookup, which queries
 * the SQLite dictionary for the active language (built by
 * scripts/build-dictionary.ts).
 *
 * Returns the rich entry shape on a hit, or null on a miss — callers should
 * fall back to the AI translate API when null.
 */
import { getActiveLanguage, getActivePack } from './data-layer';
import { foldWord } from './languages';
import { apiFetch } from './api-base';

export interface ExpandedDictionaryEntry {
  word: string;
  rank?: number;
  ipa?: string;
  etymology?: string;
  senses: Array<{ partOfSpeech: string; gloss: string }>;
  relatedForms?: Array<{ form: string; relation: string }>;
  lemmaInfo?: { stem: string; label: string };
  /** `dict` = built-in kaikki dict, `cache` = user-learned AI translation. */
  source?: 'dict' | 'cache';
}

export interface HintResponse {
  word: string;
  gloss: string;
  partOfSpeech: string | null;
}

/**
 * In-memory session cache. Map of `${language}:${lowercase word}` → entry (or
 * null for misses) — keyed by language so the same word in different target
 * languages doesn't collide. Cleared on page reload, so memory is bounded by
 * how many distinct words the user looks up in one session (typically <500).
 */
const sessionCache = new Map<string, ExpandedDictionaryEntry | null>();

export async function lookupWordRemote(word: string): Promise<ExpandedDictionaryEntry | null> {
  const language = getActiveLanguage();
  const key = `${language}:${foldWord(word, getActivePack())}`;
  if (sessionCache.has(key)) {
    return sessionCache.get(key) ?? null;
  }

  const url = `/api/dictionary/lookup?word=${encodeURIComponent(word)}&language=${language}`;
  const res = await apiFetch(url);
  if (!res.ok) {
    // Don't cache transport errors — let the next click retry.
    return null;
  }
  const data = await res.json();
  const entry: ExpandedDictionaryEntry | null = data.entry ?? null;
  sessionCache.set(key, entry);
  return entry;
}

/** Drop a single cached entry (call after editing the dict to force a re-fetch).
 *  Keys are `${language}:${word}`, so invalidate the word across every language. */
export function invalidateLookupCache(word?: string): void {
  if (word === undefined) {
    sessionCache.clear();
    return;
  }
  const suffix = `:${foldWord(word, getActivePack())}`;
  for (const key of sessionCache.keys()) {
    if (key.endsWith(suffix)) sessionCache.delete(key);
  }
}

/**
 * Result of a hint lookup. Distinguishes a genuine miss (404 — the word is
 * simply not in the dictionary) from a transport/server error, so the UI
 * can show an appropriate message instead of failing silently.
 */
export type HintResult =
  | { ok: true; hint: HintResponse }
  | { ok: false; reason: 'not-found' | 'error' };

/**
 * Fetch a one-sense hint for the blanked word in cloze practice.
 * Falls back to the first available sense of the full dictionary entry.
 *
 * Returns a discriminated result so callers can tell "word not found" from
 * "network/server error". The active language is resolved server-side from the
 * `?language=` query parameter (read from getActiveLanguage at the call site).
 */
export async function getHint(word: string): Promise<HintResult> {
  const language = getActiveLanguage();
  const url = `/api/dictionary/hint/${encodeURIComponent(word)}?language=${encodeURIComponent(language)}`;
  try {
    const res = await apiFetch(url);
    if (res.status === 404) return { ok: false, reason: 'not-found' };
    if (!res.ok) return { ok: false, reason: 'error' };
    const data = (await res.json().catch(() => null)) as { hint?: HintResponse | null } | null;
    if (data?.hint) return { ok: true, hint: data.hint };
    return { ok: false, reason: 'not-found' };
  } catch (err) {
    console.warn(`Hint lookup failed for "${word}" in ${language}:`, err);
    return { ok: false, reason: 'error' };
  }
}

export interface CacheAcceptedTranslationInput {
  word: string;
  senses: Array<{ partOfSpeech: string; gloss: string }>;
  ipa?: string;
  etymology?: string;
  relatedForms?: Array<{ form: string; relation: string }>;
  sourceSentence?: string;
  language?: string;
}

/**
 * Persist an accepted AI translation into the on-device cache (lector.db).
 * Called from the read page when the user saves to vocab / marks known /
 * sets a learning level — actions that signal trust in the translation.
 *
 * Fire-and-forget: we don't block the UI on the write. Errors are logged.
 * The session lookup cache is invalidated for the word so the next click
 * re-fetches and picks up the freshly-cached entry (now with `source: 'cache'`).
 */
export async function cacheAcceptedTranslation(
  input: CacheAcceptedTranslationInput,
): Promise<void> {
  if (!input.word || !input.senses?.length) return;
  invalidateLookupCache(input.word);
  try {
    const res = await apiFetch('/api/dictionary/cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('cacheAcceptedTranslation failed:', err);
    }
  } catch (err) {
    console.warn('cacheAcceptedTranslation network error:', err);
  }
}

/**
 * Convenience: collapse an entry's first sense into the legacy
 * `{ translation, partOfSpeech }` shape used by older code paths.
 */
export function entryToLegacyTranslation(entry: ExpandedDictionaryEntry): {
  translation: string;
  partOfSpeech: string | null;
} {
  const first = entry.senses[0];
  const allGlosses = entry.senses.map((s) => s.gloss).join('; ');
  return {
    translation: allGlosses || first?.gloss || '',
    partOfSpeech: first?.partOfSpeech || null,
  };
}
