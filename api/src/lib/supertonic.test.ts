import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  isSupertonicAvailable,
  isSupertonicConfigured,
  mapRateToSpeed,
  normalizeVoice,
  resetSupertonic,
  synthesizeWithSupertonic,
} from './supertonic';

// The engine is an HTTP sidecar, so these tests drive a fake fetch and a
// configured SUPERTONIC_URL. No database is touched.
const originalFetch = globalThis.fetch;
const previousUrl = process.env.SUPERTONIC_URL;

beforeEach(() => {
  process.env.SUPERTONIC_URL = 'http://supertonic.test:7788';
  resetSupertonic();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetSupertonic();
  if (previousUrl === undefined) delete process.env.SUPERTONIC_URL;
  else process.env.SUPERTONIC_URL = previousUrl;
});

describe('supertonic client config', () => {
  test('is unconfigured when SUPERTONIC_URL is unset', () => {
    delete process.env.SUPERTONIC_URL;
    expect(isSupertonicConfigured()).toBe(false);
  });

  test('normalizes an unknown voice to M1', () => {
    expect(normalizeVoice('F3')).toBe('F3');
    expect(normalizeVoice('X9')).toBe('M1');
    expect(normalizeVoice(undefined)).toBe('M1');
  });

  test('maps the neutral rate to the engine default and clamps the range', () => {
    expect(mapRateToSpeed(1)).toBeCloseTo(1.05);
    expect(mapRateToSpeed(9)).toBe(2); // clamped to the engine's max
    expect(mapRateToSpeed(0.01)).toBe(0.7); // clamped to the engine's min
    expect(mapRateToSpeed(Number.NaN)).toBeCloseTo(1.05);
  });
});

describe('supertonic availability', () => {
  test('is unavailable without a URL and never fetches', async () => {
    delete process.env.SUPERTONIC_URL;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw new Error('must not fetch');
    }) as unknown as typeof fetch;

    expect(await isSupertonicAvailable()).toBe(false);
    expect(calls).toBe(0);
  });

  test('probes /v1/styles and caches the verdict', async () => {
    let calls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls++;
      expect(String(input)).toBe('http://supertonic.test:7788/v1/styles');
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    expect(await isSupertonicAvailable()).toBe(true);
    expect(await isSupertonicAvailable()).toBe(true);
    expect(calls).toBe(1); // second call is served from the TTL cache
  });

  test('a probe error reads as unavailable', async () => {
    globalThis.fetch = (async () => {
      throw new Error('connection refused');
    }) as unknown as typeof fetch;
    expect(await isSupertonicAvailable()).toBe(false);
  });
});

describe('supertonic synthesis', () => {
  test('posts the mapped request and returns base64 audio', async () => {
    const captured: { url: string; body: Record<string, unknown> } = { url: '', body: {} };
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      captured.url = String(input);
      captured.body = JSON.parse(String(init?.body));
      return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
    }) as unknown as typeof fetch;

    const audio = await synthesizeWithSupertonic({
      text: 'Hallo',
      lang: 'de',
      voice: 'F2',
      rate: 1,
    });

    expect(audio).toBe(Buffer.from([1, 2, 3, 4]).toString('base64'));
    expect(captured.url).toBe('http://supertonic.test:7788/v1/tts');
    expect(captured.body).toMatchObject({
      text: 'Hallo',
      lang: 'de',
      voice: 'F2',
      steps: 8,
      response_format: 'wav',
    });
    expect(captured.body.speed).toBeCloseTo(1.05);
  });

  test('throws without a configured URL', async () => {
    delete process.env.SUPERTONIC_URL;
    await expect(
      synthesizeWithSupertonic({ text: 'x', lang: 'en', voice: 'M1', rate: 1 }),
    ).rejects.toThrow('SUPERTONIC_URL is not configured');
  });

  test('throws on a non-2xx response', async () => {
    globalThis.fetch = (async () =>
      new Response('boom', { status: 500 })) as unknown as typeof fetch;
    await expect(
      synthesizeWithSupertonic({ text: 'x', lang: 'en', voice: 'M1', rate: 1 }),
    ).rejects.toThrow('Supertonic returned 500');
  });

  test('throws on empty audio', async () => {
    globalThis.fetch = (async () =>
      new Response(new Uint8Array([]), { status: 200 })) as unknown as typeof fetch;
    await expect(
      synthesizeWithSupertonic({ text: 'x', lang: 'en', voice: 'M1', rate: 1 }),
    ).rejects.toThrow('empty audio');
  });
});
