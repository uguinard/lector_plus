// Supertonic TTS engine — local neural TTS served by a Python sidecar
// (`supertonic serve`), reached over HTTP at SUPERTONIC_URL (#307 §3.2c follow-on).
//
// Why a sidecar and not an in-process model: supertonic runs on onnxruntime,
// which publishes only glibc (manylinux) wheels. The API image is Alpine
// (musl), so Python cannot install or run there. The sidecar is a glibc base
// that speaks the OpenAI-compatible `supertonic serve` API (defined inline in
// docker-compose.yml); this module is the thin client. When SUPERTONIC_URL is
// unset, the engine is simply unavailable and the TTS route falls back.
//
// Supertonic-3 supports 31 ISO codes with 10 built-in voices (M1–M5, F1–F5).
// A Lector language not in that set (af, bn, eo, grc, la, nb, zh) must NOT
// declare 'supertonic' in its pack; the pack's `supertonicLang` is the ISO code
// sent to the engine. The code list itself lives in the shared language layer
// (languages/types.ts) so the manifest type and the registry test enforce it.

export const SUPERTONIC_VOICES = [
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
] as const;

export type SupertonicVoice = (typeof SUPERTONIC_VOICES)[number];

const DEFAULT_VOICE: SupertonicVoice = 'M1';

// Denoising steps: 5 (fast) to 12 (best). 8 is the engine's own default and the
// quality/speed point the plan settled on.
const DEFAULT_STEPS = 8;

// Speed bounds and default. The engine's own default is 1.05, so the app's
// neutral 1.0× rate maps there rather than to 1.0.
const MIN_SPEED = 0.7;
const MAX_SPEED = 2.0;
const NEUTRAL_SPEED = 1.05;

// A readiness probe (GET /v1/styles) is cheap but must not run per request at
// read-along rates, so its verdict is cached briefly.
const PROBE_TIMEOUT_MS = 2_000;
const STATUS_TTL_MS = 30_000;

// Synthesis is CPU inference plus, on a cold sidecar, the one-time chunk work.
// Generous so a long sentence never times out mid-render.
const SYNTH_TIMEOUT_MS = 120_000;

/** Base URL of the sidecar, without a trailing slash; null when unconfigured. */
function baseUrl(): string | null {
  const url = process.env.SUPERTONIC_URL?.trim();
  return url ? url.replace(/\/+$/, '') : null;
}

/** Whether a sidecar is configured at all (does not prove it is reachable). */
export function isSupertonicConfigured(): boolean {
  return baseUrl() !== null;
}

/** Validate a voice id against the built-ins; falls back to M1. */
export function normalizeVoice(voice: string | undefined): SupertonicVoice {
  return voice && (SUPERTONIC_VOICES as readonly string[]).includes(voice)
    ? (voice as SupertonicVoice)
    : DEFAULT_VOICE;
}

/**
 * Map the app's rate multiplier (1.0 ≈ normal) onto the engine's speed factor.
 * The neutral rate becomes the engine's own default (1.05) and the result is
 * clamped to the engine's documented 0.7–2.0 range.
 */
export function mapRateToSpeed(rate: number): number {
  const multiplier = Number.isFinite(rate) && rate > 0 ? rate : 1;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, multiplier * NEUTRAL_SPEED));
}

let lastError: Error | null = null;

/** The most recent failure, for route logging. Null until something fails. */
export function getSupertonicError(): Error | null {
  return lastError;
}

let cachedStatus: { at: number; available: boolean } | null = null;

/** Drop cached state. Tests call this between cases. */
export function resetSupertonic(): void {
  cachedStatus = null;
  lastError = null;
}

/**
 * Whether the sidecar is reachable and its model is loaded. Probes
 * GET /v1/styles, which only answers once the engine is up, and caches the
 * verdict for STATUS_TTL_MS so a burst of requests probes once.
 */
export async function isSupertonicAvailable(): Promise<boolean> {
  const url = baseUrl();
  if (!url) return false;

  const now = Date.now();
  if (cachedStatus && now - cachedStatus.at < STATUS_TTL_MS) return cachedStatus.available;

  let available = false;
  try {
    const response = await fetch(`${url}/v1/styles`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    available = response.ok;
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
    available = false;
  }
  cachedStatus = { at: now, available };
  return available;
}

export interface SupertonicSynthOptions {
  text: string;
  /** Engine ISO code from the pack's `supertonicLang` (not the Lector code). */
  lang: string;
  /** Built-in voice id (M1–M5, F1–F5); invalid values fall back to M1. */
  voice: string;
  /** App rate multiplier; mapped onto the engine's speed factor. */
  rate: number;
}

/**
 * Synthesize via the sidecar. Returns base64-encoded 44.1 kHz WAV. Throws on
 * any failure (unconfigured, unreachable, non-2xx, empty audio) so the caller
 * can fall back; the last error is available via getSupertonicError().
 */
export async function synthesizeWithSupertonic(opts: SupertonicSynthOptions): Promise<string> {
  const url = baseUrl();
  if (!url) throw new Error('SUPERTONIC_URL is not configured');

  const body = {
    text: opts.text,
    voice: normalizeVoice(opts.voice),
    lang: opts.lang,
    steps: DEFAULT_STEPS,
    speed: mapRateToSpeed(opts.rate),
    response_format: 'wav',
  };

  let response: Response;
  try {
    response = await fetch(`${url}/v1/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SYNTH_TIMEOUT_MS),
    });
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
    throw new Error(`Supertonic request failed: ${lastError.message}`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    lastError = new Error(
      `Supertonic returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
    );
    throw lastError;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    lastError = new Error('Supertonic returned empty audio');
    throw lastError;
  }
  return Buffer.from(bytes).toString('base64');
}
