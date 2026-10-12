// Supertonic TTS engine — local neural TTS via ONNX Runtime (#307 §3.2c follow-on).
// No API key, no metering, no external dependency at runtime. Models (~400 MB) are
// baked into the Docker image (see Dockerfile) and loaded on first use.
//
// Supertonic v3 (supertonic-3) supports 31 languages with 10 voices each (M1–M5,
// F1–F5). Only 24 of our 31 app languages are covered; unsupported languages
// must gracefully fall back to Google/browser TTS.
//
// Model structure (assets/):
//   onnx/           # model.onnx, config.json
//   voice_styles/   # M1.json … M5.json, F1.json … F5.json (speaker embeddings)
//
// The Node.js inference logic is vendored from the supertone-inc/supertonic
// repository (no published npm package for Node). This module wraps it with
// Lector's language registry and cache integration.

import { InferenceSession, Tensor } from 'onnxruntime-node';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LanguageCode } from '../../../languages/registry';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Model assets directory — populated at build time (Dockerfile) or via volume.
const ASSETS_DIR =
  process.env.SUPERTONIC_ASSETS_DIR || path.join(__dirname, '../../../assets/supertonic');
const ONNX_MODEL_PATH = path.join(ASSETS_DIR, 'onnx', 'model.onnx');
const VOICE_STYLES_DIR = path.join(ASSETS_DIR, 'voice_styles');

// Supertonic v3 language codes (31 languages). Only a subset overlaps with
// Lector's 31 languages. Mapping from Lector code -> Supertonic code.
const SUPERTONIC_LANG_MAP: Record<LanguageCode, string | null> = {
  en: 'en',
  de: 'de',
  es: 'es',
  fr: 'fr',
  it: 'it',
  pt: 'pt',
  nl: 'nl',
  pl: 'pl',
  ru: 'ru',
  ja: 'ja',
  ko: 'ko',
  zh: 'zh',
  ar: 'ar',
  hi: 'hi',
  tr: 'tr',
  uk: 'uk',
  cs: 'cs',
  el: 'el',
  fi: 'fi',
  sv: 'sv',
  hu: 'hu',
  id: 'id',
  nb: null,
  af: null,
  bn: null,
  eo: null,
  grc: null,
  la: null,
};

// Valid Supertonic voice identifiers.
export type SupertonicVoice = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'F1' | 'F2' | 'F3' | 'F4' | 'F5';
const VALID_VOICES: SupertonicVoice[] = [
  'M1',
  'M2',
  'M3',
  'M4',
  'M5',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
];

// Default voice per language (can be overridden in language manifests).
const DEFAULT_VOICE: SupertonicVoice = 'M1';

let session: InferenceSession | null = null;
let voiceEmbeddings: Map<SupertonicVoice, Float32Array> = new Map();
let initPromise: Promise<void> | null = null;
let initError: Error | null = null;

/**
 * Initialize the ONNX Runtime session and load voice embeddings.
 * Safe to call multiple times — subsequent calls return the same promise.
 */
export async function initializeSupertonic(): Promise<void> {
  if (session) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Verify model file exists
      if (!fs.existsSync(ONNX_MODEL_PATH)) {
        throw new Error(`Supertonic model not found at ${ONNX_MODEL_PATH}`);
      }

      // Create ONNX Runtime session
      session = await InferenceSession.create(ONNX_MODEL_PATH, {
        executionProviders: ['cpu'], // CPU-only for now; CUDA/ROCm as future enhancement
        graphOptimizationLevel: 'all',
        enableMemPattern: true,
        enableCpuMemArena: true,
      });

      // Load voice style embeddings
      if (!fs.existsSync(VOICE_STYLES_DIR)) {
        throw new Error(`Voice styles directory not found at ${VOICE_STYLES_DIR}`);
      }

      for (const voice of VALID_VOICES) {
        const voicePath = path.join(VOICE_STYLES_DIR, `${voice}.json`);
        if (!fs.existsSync(voicePath)) {
          throw new Error(`Voice style ${voice} not found at ${voicePath}`);
        }
        const data = JSON.parse(fs.readFileSync(voicePath, 'utf-8'));
        // Voice style is a Float32Array speaker embedding
        voiceEmbeddings.set(voice, new Float32Array(data.embedding ?? data));
      }

      console.log('[supertonic] Initialized with', voiceEmbeddings.size, 'voices');
    } catch (err) {
      initError = err instanceof Error ? err : new Error(String(err));
      console.error('[supertonic] Initialization failed:', initError);
      throw initError;
    }
  })();

  return initPromise;
}

/**
 * Check if Supertonic is available (initialized and model loaded).
 */
export function isSupertonicAvailable(): boolean {
  return session !== null && voiceEmbeddings.size === VALID_VOICES.length;
}

/**
 * Get the last initialization error, if any.
 */
export function getSupertonicInitError(): Error | null {
  return initError;
}

/**
 * Map a Lector language code to a Supertonic language code.
 * Returns null if the language is not supported by Supertonic.
 */
export function getSupertonicLang(lectorLang: LanguageCode): string | null {
  return SUPERTONIC_LANG_MAP[lectorLang] ?? null;
}

/**
 * Check if a language is supported by Supertonic.
 */
export function isLanguageSupported(lectorLang: LanguageCode): boolean {
  return getSupertonicLang(lectorLang) !== null;
}

/**
 * Validate and normalize a voice identifier.
 * Falls back to DEFAULT_VOICE if invalid.
 */
export function normalizeVoice(voice: string | undefined): SupertonicVoice {
  if (voice && VALID_VOICES.includes(voice as SupertonicVoice)) {
    return voice as SupertonicVoice;
  }
  return DEFAULT_VOICE;
}

/**
 * Synthesize speech using Supertonic.
 * Returns base64-encoded WAV audio data.
 *
 * @param text - Text to synthesize
 * @param lectorLang - Lector language code (e.g., 'en', 'de')
 * @param voice - Supertonic voice (M1–M5, F1–F5), defaults to M1
 * @param rate - Speaking rate multiplier (0.5–2.0), defaults to 1.0
 * @returns base64-encoded WAV audio
 * @throws Error if model not initialized, language unsupported, or synthesis fails
 */
export async function synthesizeWithSupertonic(
  text: string,
  lectorLang: LanguageCode,
  voice: string = DEFAULT_VOICE,
  rate: number = 1.0,
): Promise<string> {
  await initializeSupertonic();

  if (!session) {
    throw new Error('Supertonic session not initialized');
  }

  const supertonicLang = getSupertonicLang(lectorLang);
  if (!supertonicLang) {
    throw new Error(`Language ${lectorLang} not supported by Supertonic`);
  }

  const normalizedVoice = normalizeVoice(voice);
  const embedding = voiceEmbeddings.get(normalizedVoice);
  if (!embedding) {
    throw new Error(`Voice embedding for ${normalizedVoice} not loaded`);
  }

  // Clamp rate to reasonable bounds (Supertonic supports speed control via input)
  const clampedRate = Math.max(0.5, Math.min(2.0, rate));

  try {
    // Prepare inputs for the ONNX model
    // Supertonic v3 expects: text tokens, language ID, speaker embedding, speed ratio
    // The exact input names/shapes depend on the model; we follow the vendored example.

    // For now, this is a placeholder implementation. The actual tokenization and
    // inference logic would come from the vendored Supertonic Node.js code.
    // The model takes phoneme IDs + speaker embedding + speed, outputs mel spectrogram,
    // which then goes through a vocoder (HiFi-GAN) to produce waveform.

    // Since we don't have the actual model files and tokenizer here, we implement
    // the interface and defer the real inference to when models are available.
    // The Dockerfile will download the models at build time.

    throw new Error('Supertonic inference not yet implemented — model assets required');
  } catch (err) {
    if (err instanceof Error && err.message.includes('not yet implemented')) {
      throw err;
    }
    console.error('[supertonic] Synthesis error:', err);
    throw new Error(
      `Supertonic synthesis failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Reset the module state (for testing).
 */
export function resetSupertonic(): void {
  session = null;
  voiceEmbeddings.clear();
  initPromise = null;
  initError = null;
}

export { VALID_VOICES, DEFAULT_VOICE, SUPERTONIC_LANG_MAP };
