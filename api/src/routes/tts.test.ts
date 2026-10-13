import '../test-guard';
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { db } from '../db';
import { getLanguageConfig } from '../lib/languages';
import { resetSupertonic } from '../lib/supertonic';
import { resetTtsCache } from '../lib/tts-cache';
import app from './tts';

const originalFetch = globalThis.fetch;
const previousApiKey = process.env.GOOGLE_CLOUD_API_KEY;
const previousTtsCache = process.env.TTS_CACHE;
const previousSupertonicUrl = process.env.SUPERTONIC_URL;

function ttsUsage(): number | null {
  const row = db
    .prepare(
      "SELECT value FROM usage_counters WHERE userId = 'local' AND metric = 'ttsCharsPerMonth'",
    )
    .get() as { value: number } | undefined;
  return row?.value ?? null;
}

beforeEach(() => {
  process.env.GOOGLE_CLOUD_API_KEY = 'google-test-key';
  // Default to no sidecar; the Supertonic block sets one per case.
  delete process.env.SUPERTONIC_URL;
  resetSupertonic();
  db.prepare(
    "DELETE FROM usage_counters WHERE userId = 'local' AND metric = 'ttsCharsPerMonth'",
  ).run();
  db.prepare("DELETE FROM settings WHERE userId = 'local' AND key = 'targetLanguage'").run();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetSupertonic();
  db.prepare("DELETE FROM settings WHERE userId = 'local' AND key = 'targetLanguage'").run();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  resetSupertonic();
  if (previousApiKey === undefined) delete process.env.GOOGLE_CLOUD_API_KEY;
  else process.env.GOOGLE_CLOUD_API_KEY = previousApiKey;
  if (previousTtsCache === undefined) delete process.env.TTS_CACHE;
  else process.env.TTS_CACHE = previousTtsCache;
  if (previousSupertonicUrl === undefined) delete process.env.SUPERTONIC_URL;
  else process.env.SUPERTONIC_URL = previousSupertonicUrl;
  resetTtsCache();
});

describe('TTS route request boundaries', () => {
  test('returns 413 before provider fetch or usage reservation for an oversized body', async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      throw new Error('oversized TTS bodies must not reach Google');
    }) as unknown as typeof fetch;

    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello', padding: 'x'.repeat(33 * 1024) }),
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: 'TTS request is too large',
      fallback: true,
    });
    expect(fetchCalls).toBe(0);
    expect(ttsUsage()).toBeNull();
  });

  test("rejects text beyond Google's 5,000-byte content limit before fetch or metering", async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      throw new Error('over-limit TTS text must not reach Google');
    }) as unknown as typeof fetch;

    // 2,501 two-byte UTF-8 characters = 5,002 bytes despite only 2,501 JS chars.
    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'é'.repeat(2_501) }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Text is too long (max 5,000 bytes)',
      fallback: true,
    });
    expect(fetchCalls).toBe(0);
    expect(ttsUsage()).toBeNull();
  });

  test('accepts exactly 5,000 UTF-8 bytes and preserves character metering', async () => {
    const captured: { request: Request | null } = { request: null };
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      captured.request = new Request(input, init);
      return Response.json({ audioContent: 'encoded-audio' });
    }) as unknown as typeof fetch;

    const text = 'é'.repeat(2_500);
    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      audioContent: 'encoded-audio',
      contentType: 'audio/mp3',
    });
    expect(captured.request?.url).toContain(
      'https://texttospeech.googleapis.com/v1/text:synthesize?key=google-test-key',
    );
    expect(JSON.parse((await captured.request?.text()) ?? '{}').input.text).toBe(text);
    expect(ttsUsage()).toBe(2_500);
  });

  test('resolves an omitted language from settings and clamps the speaking rate', async () => {
    db.prepare('INSERT INTO settings (userId, key, value) VALUES (?, ?, ?)').run(
      'local',
      'targetLanguage',
      '"de"',
    );
    const captured: { request: Request | null } = { request: null };
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      captured.request = new Request(input, init);
      return Response.json({ audioContent: 'ZGV1dHNjaA==' });
    }) as unknown as typeof fetch;

    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'sprachroute', rate: 99 }),
    });
    const requestBody = JSON.parse((await captured.request?.text()) ?? '{}');
    const german = getLanguageConfig('de');

    expect(response.status).toBe(200);
    expect(requestBody.voice).toMatchObject({
      languageCode: german.ttsCode,
      name: german.ttsVoice,
    });
    expect(requestBody.audioConfig.speakingRate).toBe(4);
  });

  test('refunds usage when the provider returns no audio content', async () => {
    globalThis.fetch = (async () => Response.json({})) as unknown as typeof fetch;

    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'missing-audio-route' }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'No audio content returned',
      fallback: true,
    });
    expect(ttsUsage()).toBe(0);
  });
});

describe('TTS caching (#226)', () => {
  const synthesize = (text: string) =>
    app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

  test('replays of the same tuple are served from cache: one Google call, metered once', async () => {
    delete process.env.TTS_CACHE;
    resetTtsCache();
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      return Response.json({ audioContent: 'Y2FjaGVkLWF1ZGlv' }); // "cached-audio"
    }) as unknown as typeof fetch;

    const first = await synthesize('kandelaar');
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      audioContent: 'Y2FjaGVkLWF1ZGlv',
      contentType: 'audio/mp3',
    });
    expect(fetchCalls).toBe(1);
    expect(ttsUsage()).toBe('kandelaar'.length);

    // The replay must not need the Google key at all — drop it to prove the
    // request never leaves the cache.
    delete process.env.GOOGLE_CLOUD_API_KEY;
    const second = await synthesize('kandelaar');
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({
      audioContent: 'Y2FjaGVkLWF1ZGlv',
      contentType: 'audio/mp3',
      cached: true,
    });
    expect(fetchCalls).toBe(1);
    expect(ttsUsage()).toBe('kandelaar'.length);
  });

  test('failed synthesis is not cached and the retry re-fetches', async () => {
    delete process.env.TTS_CACHE;
    resetTtsCache();
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      if (fetchCalls === 1) {
        return Response.json({ error: { message: 'boom' } }, { status: 500 });
      }
      return Response.json({ audioContent: 'aGVyc3RlbA==' });
    }) as unknown as typeof fetch;

    const failed = await synthesize('herstelbaar');
    expect(failed.status).toBe(500);
    expect(ttsUsage()).toBe(0); // reserved, then refunded

    const retried = await synthesize('herstelbaar');
    expect(retried.status).toBe(200);
    expect(await retried.json()).toEqual({
      audioContent: 'aGVyc3RlbA==',
      contentType: 'audio/mp3',
    });
    expect(fetchCalls).toBe(2);
  });

  test('TTS_CACHE=0 keeps every request on the synthesis path', async () => {
    process.env.TTS_CACHE = '0';
    resetTtsCache();
    try {
      let fetchCalls = 0;
      globalThis.fetch = (async () => {
        fetchCalls++;
        return Response.json({ audioContent: 'b25nZWNhY2hl' });
      }) as unknown as typeof fetch;

      expect((await synthesize('ongecached')).status).toBe(200);
      expect((await synthesize('ongecached')).status).toBe(200);
      expect(fetchCalls).toBe(2);
      expect(ttsUsage()).toBe('ongecached'.length * 2);
    } finally {
      delete process.env.TTS_CACHE;
      resetTtsCache();
    }
  });
});

// eSpeak NG engine branch (#307 §3.2c) — Esperanto's only voice, synthesized
// through the real binary. Skipped when espeak-ng isn't installed locally;
// CI installs it (see .github/workflows/ci.yml api-tests) so the branch is
// always exercised there, and the production image bakes it in (Dockerfile
// runner stage).
const hasEspeak = Bun.which('espeak-ng') !== null;

describe.skipIf(!hasEspeak)('TTS espeak engine (#307)', () => {
  test('eo synthesizes WAV via espeak-ng — no Google call, no key, no metering', async () => {
    delete process.env.GOOGLE_CLOUD_API_KEY; // espeak must not need it
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      throw new Error('espeak languages must never reach Google');
    }) as unknown as typeof fetch;

    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Saluton, kiel vi fartas?', language: 'eo' }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as { audioContent: string; contentType: string };
    expect(data.contentType).toBe('audio/wav');
    // Real synthesis: decodes to a RIFF/WAVE container with actual audio in it.
    const wav = Buffer.from(data.audioContent, 'base64');
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(wav.byteLength).toBeGreaterThan(1_000);

    expect(fetchCalls).toBe(0);
    // Unmetered on every tier — synthesis is zero-marginal-cost (#307 §3.2c).
    expect(ttsUsage()).toBeNull();
  });

  test('the espeak rate maps the client multiplier onto words-per-minute', async () => {
    // 0.5× of 175 wpm ≈ 88 wpm vs 1.5× ≈ 263 wpm: the slow clip must carry
    // more samples for the same sentence. Compare real output sizes.
    const synth = async (rate: number) => {
      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'La ĝardeno estas bela kaj granda', language: 'eo', rate }),
      });
      expect(res.status).toBe(200);
      const { audioContent } = (await res.json()) as { audioContent: string };
      return Buffer.from(audioContent, 'base64').byteLength;
    };

    const slow = await synth(0.5);
    const fast = await synth(1.5);
    expect(slow).toBeGreaterThan(fast);
  });

  test('an espeak-only language resolves from settings like any other', async () => {
    db.prepare('INSERT INTO settings (userId, key, value) VALUES (?, ?, ?)').run(
      'local',
      'targetLanguage',
      '"eo"',
    );

    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'bonan tagon' }), // language omitted → settings
    });

    expect(response.status).toBe(200);
    expect(((await response.json()) as { contentType: string }).contentType).toBe('audio/wav');
  });
});

// Supertonic engine branch (#307 §3.2c follow-on) — a Python sidecar reached
// over HTTP at SUPERTONIC_URL. Driven with a fake fetch, so the branch is
// exercised without a live engine.
function fakeWav() {
  const wav = new Uint8Array(44);
  wav.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  wav.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
  return wav;
}

describe('TTS supertonic engine (#307)', () => {
  test('a reachable sidecar synthesizes WAV, unmetered, without touching Google', async () => {
    process.env.SUPERTONIC_URL = 'http://sidecar:7788';
    const captured: { tts?: Record<string, unknown> } = {};
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v1/styles')) return new Response('{}', { status: 200 });
      if (url.endsWith('/v1/tts')) {
        captured.tts = JSON.parse(String(init?.body));
        return new Response(fakeWav(), { status: 200 });
      }
      throw new Error(`sidecar request must not reach ${url}`);
    }) as unknown as typeof fetch;

    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Guten Morgen', language: 'de', engine: 'supertonic' }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as { audioContent: string; contentType: string };
    expect(data.contentType).toBe('audio/wav');
    expect(Buffer.from(data.audioContent, 'base64').subarray(0, 4).toString('ascii')).toBe('RIFF');
    // The pack's German supertonicLang and default voice travel as-is.
    expect(captured.tts).toMatchObject({ text: 'Guten Morgen', lang: 'de', voice: 'M1' });
    // Unmetered on every tier, and Google is never called (the mock throws).
    expect(ttsUsage()).toBeNull();
  });

  test('an unreachable sidecar falls back to the browser voice, not to Google', async () => {
    // No SUPERTONIC_URL (cleared in beforeEach).
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      throw new Error('no engine must be fetched');
    }) as unknown as typeof fetch;

    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'bonjou', language: 'de', engine: 'supertonic' }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Supertonic is unavailable', fallback: true });
    expect(fetchCalls).toBe(0);
    expect(ttsUsage()).toBeNull();
  });

  test('a repeated tuple is served from cache: one sidecar call', async () => {
    process.env.SUPERTONIC_URL = 'http://sidecar:7788';
    delete process.env.TTS_CACHE;
    resetTtsCache();
    let ttsCalls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/v1/styles')) return new Response('{}', { status: 200 });
      if (url.endsWith('/v1/tts')) {
        ttsCalls++;
        return new Response(fakeWav(), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const synthesize = () =>
      app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'herhaal my', language: 'de', engine: 'supertonic' }),
      });

    expect((await synthesize()).status).toBe(200);
    const second = await synthesize();
    expect(second.status).toBe(200);
    expect(((await second.json()) as { cached?: boolean }).cached).toBe(true);
    expect(ttsCalls).toBe(1);
  });

  test('a pack without supertonicLang never reaches the sidecar', async () => {
    // zh declares no Supertonic; a stray supertonic request must not probe it.
    process.env.SUPERTONIC_URL = 'http://sidecar:7788';
    const urls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      throw new Error('no upstream in this test');
    }) as unknown as typeof fetch;

    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '你好', language: 'zh', engine: 'supertonic' }),
    });

    // zh lists google only, so the supertonic branch is skipped and the request
    // takes the Google path instead.
    expect(response.status).toBe(500);
    expect(urls.some((url) => url.includes('sidecar'))).toBe(false);
  });
});
