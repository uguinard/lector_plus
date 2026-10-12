// Text-to-Speech wrapper
// Uses managed TTS when entitled and available, otherwise browser TTS
import { getActiveLanguage, getEntitlements } from './data-layer';
import { apiFetch, lectorMode } from './api-base';
import { LANGUAGES, DEFAULT_LANGUAGE, type LanguageCode } from './languages';
import {
  getRecommendedVoices as getCuratedVoices,
  getBestRecommendedVoice,
  formatVoiceLabel,
  type RecommendedVoice,
} from './browser-tts-voices';

// Default speech rate (1.0 is normal speed). Exported so callers that offer a
// speed control (e.g. dictation practice) can scale relative to the app's
// normal "1x" listening rate instead of hard-coding it.
export const DEFAULT_RATE = 0.9;

// Resolve the active language's TTS config. Browser-TTS voice selection is
// driven entirely off this, so switching the target language picks an
// appropriate voice instead of always assuming Afrikaans.
function activeLangConfig() {
  return LANGUAGES[getActiveLanguage() as LanguageCode] ?? LANGUAGES[DEFAULT_LANGUAGE];
}

// Accepted langs for the active language, most-specific first — e.g.
// af → ['af-ZA', 'af', 'nl-NL', 'nl']; de → ['de-DE', 'de']. Languages without
// a Google voice (eo) have no ttsCode/fallbackTts — only the bare code remains
// (browser TTS is not used for them, but voice listings stay well-defined).
function candidateLangs(): string[] {
  const config = activeLangConfig();
  return [config.ttsCode, config.code, ...(config.fallbackTts ?? [])].filter(
    (lang): lang is string => Boolean(lang),
  );
}

/**
 * Whether the active language has synthesized audio at all. Speaker buttons
 * gate on this: for `pronunciation.audio: 'none'` languages (disputed or
 * reconstructed pronunciation — #307 §3.2a) the speaker UI absents itself
 * rather than silently mis-speaking through a wrong-language browser voice.
 */
export function hasAudio(): boolean {
  return activeLangConfig().pronunciation.audio !== 'none';
}

/**
 * Whether a speaker control should render for the active language in this
 * browser: 'none' languages never speak; server-engine languages (eo →
 * eSpeak NG, or Supertonic-supported languages) always can, independent of
 * browser voices; Google-only languages keep the historical browser-TTS
 * availability check (their fallback path).
 */
export function canSpeak(): boolean {
  const audio = activeLangConfig().pronunciation.audio;
  if (audio === 'none') return false;
  // Languages with any server-side engine (espeak or supertonic) always work
  if (audio.includes('espeak') || audio.includes('supertonic')) return true;
  // Google languages fall back to browser TTS availability
  return isTTSAvailable();
}

// Preferred voice name patterns (higher quality voices)
const PREFERRED_VOICE_PATTERNS = [/google/i, /premium/i, /enhanced/i, /natural/i, /neural/i];

// Voice names to avoid (often robotic sounding)
const AVOID_VOICE_PATTERNS = [/espeak/i, /mbrola/i];

// Cached voice selection for browser TTS
let cachedVoice: SpeechSynthesisVoice | undefined;
let voiceInitialized = false;

// Audio element for Google TTS playback
let audioElement: HTMLAudioElement | null = null;

// LocalStorage keys
const VOICE_PREF_KEY_PREFIX = 'lector-tts-voice-';
const TTS_MODE_KEY = 'lector-tts-mode';

function voicePrefKey(languageCode: string): string {
  return `${VOICE_PREF_KEY_PREFIX}${languageCode}`;
}

/**
 * Migrate old global voice preference to per-language keys.
 * Runs once on first load.
 */
function migrateVoicePreference(): void {
  if (typeof window === 'undefined') return;
  const oldKey = 'lector-tts-voice';
  const oldValue = localStorage.getItem(oldKey);
  if (oldValue) {
    const activeLang = getActiveLanguage();
    localStorage.setItem(voicePrefKey(activeLang), oldValue);
    localStorage.removeItem(oldKey);
  }
}

// TTS modes
export type TTSMode = 'google' | 'supertonic' | 'browser';

/**
 * Check if the browser supports the Web Speech API
 * @returns true if browser TTS is available
 */
export function isTTSAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Get the current TTS mode preference
 */
export function getTTSMode(): TTSMode {
  if (typeof window === 'undefined') return 'browser';
  migrateVoicePreference();
  return (localStorage.getItem(TTS_MODE_KEY) as TTSMode) || 'google';
}

/**
 * Set the TTS mode preference
 */
export function setTTSMode(mode: TTSMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TTS_MODE_KEY, mode);
}

/**
 * Score a voice based on quality indicators
 * Higher score = better quality
 */
function scoreVoice(voice: SpeechSynthesisVoice): number {
  let score = 0;

  // Prefer local/offline voices (usually higher quality)
  if (voice.localService) score += 5;

  // Prefer voices with preferred name patterns
  for (const pattern of PREFERRED_VOICE_PATTERNS) {
    if (pattern.test(voice.name)) {
      score += 10;
      break;
    }
  }

  // Avoid certain voice types
  for (const pattern of AVOID_VOICE_PATTERNS) {
    if (pattern.test(voice.name)) {
      score -= 20;
      break;
    }
  }

  // Prefer exact language match for the active language
  const primaryLang = activeLangConfig().ttsCode;
  if (primaryLang) {
    if (voice.lang === primaryLang) score += 3;
    if (voice.lang.startsWith(primaryLang.split('-')[0])) score += 2;
  }

  return score;
}

/**
 * Get the best available voice for the active language (browser TTS).
 * Caches the result for consistent voice selection.
 * @returns The voice to use, or undefined if none found
 */
function getActiveLanguageVoice(): SpeechSynthesisVoice | undefined {
  if (!isTTSAvailable()) {
    return undefined;
  }

  const allLangs = candidateLangs();
  const matchesActiveLang = (v: SpeechSynthesisVoice) =>
    allLangs.some((lang) => v.lang === lang || v.lang.startsWith(lang.split('-')[0]));

  // Return the cached voice only while it still matches the active language.
  // The cache outlives a server-side language switch (settings PUT without a
  // reload), and a stale voice is worse than none: a Latin voice handed
  // Cyrillic text plays silence rather than erroring.
  if (voiceInitialized && cachedVoice) {
    if (matchesActiveLang(cachedVoice)) return cachedVoice;
    cachedVoice = undefined;
    voiceInitialized = false;
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    return undefined;
  }

  // Check for user's saved preference — but only reuse it if it still matches
  // the active language. The saved name is per-language, so an Afrikaans voice
  // must not be reused after the user switches the target language to German.
  const savedVoiceName = localStorage.getItem(voicePrefKey(getActiveLanguage()));
  if (savedVoiceName) {
    const savedVoice = voices.find((v) => v.name === savedVoiceName);
    if (savedVoice && matchesActiveLang(savedVoice)) {
      cachedVoice = savedVoice;
      voiceInitialized = true;
      return cachedVoice;
    }
  }

  // Find all candidate voices for the active language (+ fallbacks)
  const candidateVoices = voices.filter(matchesActiveLang);

  if (candidateVoices.length === 0) {
    voiceInitialized = true;
    return undefined;
  }

  // Sort by score and pick the best one
  candidateVoices.sort((a, b) => scoreVoice(b) - scoreVoice(a));
  cachedVoice = candidateVoices[0];
  voiceInitialized = true;

  // Save the selection for next time
  if (cachedVoice) {
    localStorage.setItem(voicePrefKey(getActiveLanguage()), cachedVoice.name);
  }

  return cachedVoice;
}

/**
 * Set a specific voice by name (browser TTS)
 * @param voiceName - The name of the voice to use
 * @param languageCode - The language to save the preference for (defaults to active language)
 */
export function setPreferredVoice(voiceName: string, languageCode?: string): void {
  if (!isTTSAvailable()) return;

  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.name === voiceName);

  if (voice) {
    cachedVoice = voice;
    voiceInitialized = true;
    const lang = languageCode ?? getActiveLanguage();
    localStorage.setItem(voicePrefKey(lang), voiceName);
  }
}

/**
 * Get the currently selected voice name for a language
 * @param languageCode - The language to get the preference for (defaults to active language)
 */
export function getCurrentVoiceName(languageCode?: string): string | undefined {
  const lang = languageCode ?? getActiveLanguage();
  return cachedVoice?.name || localStorage.getItem(voicePrefKey(lang)) || undefined;
}

/**
 * Speak via the server TTS route. The API dispatches to the engine the active
 * language declares (`pronunciation.audio`): Google for the national-language
 * packs, self-hosted eSpeak NG for Esperanto, self-hosted Supertonic for
 * supported languages (#307 §3.2c follow-on).
 * @returns true if successful, false if the caller may fall back to browser TTS
 */
async function speakWithServer(
  text: string,
  rate: number,
  engine?: 'google' | 'supertonic',
): Promise<boolean> {
  try {
    const response = await apiFetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, rate, language: getActiveLanguage(), engine }),
    });

    const data = await response.json();

    // Check if we should fall back to browser TTS
    if (data.fallback || data.error) {
      console.log('Managed TTS unavailable:', data.error);
      return false;
    }

    // Stop any current audio
    stopSpeaking();

    // Create audio element and play
    const audioData = `data:${data.contentType};base64,${data.audioContent}`;
    audioElement = new Audio(audioData);
    audioElement.play();

    return true;
  } catch (error) {
    console.error('Server TTS error:', error);
    return false;
  }
}

/**
 * Speak using browser's speech synthesis
 */
function speakWithBrowser(text: string, rate: number): void {
  if (!isTTSAvailable()) {
    console.warn('Text-to-speech is not available in this browser');
    return;
  }

  // Stop any current speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  // Set the voice for the active language (falls back per the registry)
  const voice = getActiveLanguageVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    // Set language even without a specific voice (bcp47 covers languages
    // without a Google ttsCode).
    const config = activeLangConfig();
    utterance.lang = config.ttsCode ?? config.script.bcp47;
    // The browser will pick its default voice, which for a non-matching
    // language often plays nothing at all (e.g. a Latin voice handed
    // Cyrillic text) — leave a trail for that otherwise-silent failure.
    console.warn(
      `No ${config.name} browser voice found — install one in the OS or configure managed TTS`,
    );
  }

  // Set speech parameters
  utterance.rate = Math.max(0.1, Math.min(10, rate));
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Speak
  window.speechSynthesis.speak(utterance);
}

/**
 * Speaks text via system audio, dispatching on the active language's
 * pronunciation capability (#307 §3.2):
 * - `audio: 'none'` — no-op. Nothing can sensibly speak the language; the
 *   speaker UI is already absent (see `hasAudio`).
 * - server-engine-only languages (eo → eSpeak NG) — always the server route,
 *   unmetered, and NEVER browser TTS: there is no matching browser voice, so
 *   a failure surfaces instead of mis-speaking in the wrong language.
 * - Google/Supertonic languages — managed TTS when entitled, browser TTS otherwise
 *   (existing behavior).
 * @param text - The text to speak
 * @param rate - Speech rate (default 0.9 for clearer learning)
 */
export async function speak(text: string, rate: number = DEFAULT_RATE): Promise<void> {
  const audio = activeLangConfig().pronunciation.audio;
  if (audio === 'none') return;

  if (!audio.includes('google') && !audio.includes('supertonic')) {
    // eSpeak-only language: no plan gating (synthesis is zero-marginal-cost
    // and unmetered on every tier — #307 §3.2c) and no browser fallback.
    const success = await speakWithServer(text, rate);
    if (!success) console.error('TTS failed and this language has no browser fallback voice');
    return;
  }

  const mode = getTTSMode();

  if (mode === 'google') {
    if (lectorMode() === 'cloud') {
      const entitlements = await getEntitlements();
      if (entitlements?.limits.ttsCharsPerMonth === 0) {
        // Free (including Free+BYOK) is browser-only. Persist the fallback so a
        // lapsed subscriber does not repeatedly make denied managed-TTS calls.
        setTTSMode('browser');
        speakWithBrowser(text, rate);
        return;
      }
    }
    const success = await speakWithServer(text, rate, 'google');
    if (success) return;
  }

  if (mode === 'supertonic') {
    // Supertonic is unmetered and available on all tiers (including Free).
    // No entitlement check needed.
    const success = await speakWithServer(text, rate, 'supertonic');
    if (success) return;
    // On failure, fall through to browser TTS
  }

  speakWithBrowser(text, rate);
}

/**
 * Stop any current speech (both Google and browser)
 */
export function stopSpeaking(): void {
  // Stop browser TTS
  if (isTTSAvailable()) {
    window.speechSynthesis.cancel();
  }

  // Stop audio element
  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
    audioElement = null;
  }
}

/**
 * Get available voices for the active language (+ fallbacks) for browser TTS.
 * Useful for debugging or letting users choose a voice.
 * @returns Array of available voices
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isTTSAvailable()) {
    return [];
  }

  const voices = window.speechSynthesis.getVoices();
  const relevantLangs = candidateLangs();

  return voices.filter((v) =>
    relevantLangs.some((lang) => v.lang === lang || v.lang.startsWith(lang.split('-')[0])),
  );
}

/**
 * Wait for voices to be loaded and initialize the cache
 * Some browsers load voices asynchronously
 * @returns Promise that resolves when voices are available
 */
export function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isTTSAvailable()) {
      resolve([]);
      return;
    }

    const initializeAndResolve = () => {
      const voices = window.speechSynthesis.getVoices();
      // Pre-initialize the voice cache
      if (voices.length > 0 && !voiceInitialized) {
        getActiveLanguageVoice();
      }
      resolve(voices);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      initializeAndResolve();
      return;
    }

    // Wait for voiceschanged event
    window.speechSynthesis.addEventListener('voiceschanged', initializeAndResolve, { once: true });

    // Timeout after 3 seconds
    setTimeout(initializeAndResolve, 3000);
  });
}

/**
 * Reset voice cache for a language (useful if user wants to re-select)
 * @param languageCode - The language to reset (defaults to active language)
 */
export function resetVoiceCache(languageCode?: string): void {
  cachedVoice = undefined;
  voiceInitialized = false;
  const lang = languageCode ?? getActiveLanguage();
  localStorage.removeItem(voicePrefKey(lang));
}

/**
 * Check if Google Cloud TTS is configured
 * Makes a test request to see if the API key is set
 */
export async function isGoogleTTSConfigured(): Promise<boolean> {
  try {
    const response = await apiFetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test' }),
    });
    const data = await response.json();
    return !data.fallback;
  } catch {
    return false;
  }
}

/**
 * Check if Supertonic TTS is available on the server
 * Makes a test request with engine=supertonic
 */
export async function isSupertonicAvailable(): Promise<boolean> {
  try {
    const response = await apiFetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test', engine: 'supertonic' }),
    });
    const data = await response.json();
    return !data.fallback && !data.error;
  } catch {
    return false;
  }
}

/**
 * Get curated/recommended voices for the active language (browser TTS).
 * Uses Readium Speech curated voice lists filtered by quality.
 * @param languageCode - The language to get voices for (defaults to active language)
 * @param availableVoices - Optional pre-fetched voices; if omitted, fetches from browser
 * @returns Array of recommended voices sorted by quality (best first)
 */
export function getRecommendedVoices(
  languageCode?: string,
  availableVoices?: SpeechSynthesisVoice[],
): RecommendedVoice[] {
  const lang = languageCode ?? getActiveLanguage();
  const voices = availableVoices ?? (isTTSAvailable() ? window.speechSynthesis.getVoices() : []);
  return getCuratedVoices(lang, voices);
}

/**
 * Get the best available curated voice for a language.
 * @param languageCode - The language to get the voice for (defaults to active language)
 * @param availableVoices - Optional pre-fetched voices
 * @returns The best matching SpeechSynthesisVoice or undefined
 */
export function getBestVoice(
  languageCode?: string,
  availableVoices?: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  const lang = languageCode ?? getActiveLanguage();
  const voices = availableVoices ?? (isTTSAvailable() ? window.speechSynthesis.getVoices() : []);
  return getBestRecommendedVoice(lang, voices);
}

/**
 * Format a recommended voice for display in the selector.
 * e.g. "Emma (veryHigh, Edge)"
 */
export { formatVoiceLabel };

export type { RecommendedVoice, VoiceQuality } from './browser-tts-voices';
