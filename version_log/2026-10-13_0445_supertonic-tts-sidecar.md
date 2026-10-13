# Supertonic TTS: sidecar HTTP client

Date: 2026-10-13 04:45

## Context

Supertonic was added to the TTS engine dispatch as an in-process ONNX engine,
but the Settings "Supertonic (Local AI)" button stayed disabled and, when
enabled, speech fell back to the browser with a warning that the models were
not installed.

Investigation found three independent defects:

1. **Unfinished inference.** `api/src/lib/supertonic.ts` was a stub:
   `synthesizeWithSupertonic()` always threw
   `"Supertonic inference not yet implemented — model assets required"`. No
   tokenizer, no ONNX sessions, no vocoder — none of the vendored Node.js
   engine was ever ported.
2. **Broken model fetch.** The Dockerfile downloaded
   `huggingface.co/supertone-inc/supertonic-3/onnx/model.onnx`. The org is
   wrong and there is no single `model.onnx`: the real repo (`Supertone/
   supertonic-3`, or the archive `supertone-oss-archive/supertonic-3`) ships
   four ONNX files (`duration_predictor`, `text_encoder`, `vector_estimator`,
   `vocoder`), `tts.json`, `unicode_indexer.json`, a root `config.json`, and ten
   `voice_styles/*.json`. So the assets the stub wanted could never appear.
3. **Wrong language.** The `zh` manifest declared a Supertonic voice, but
   Supertonic-3 supports no Chinese among its 31 codes.

Plan chosen with the user: **B1 — a Python sidecar.** The `supertonic` package
(runs on `onnxruntime`, which publishes only glibc/manylinux wheels) cannot
install on the Alpine (musl) app image. A separate `python:3.12-slim` container
serving `supertonic serve` over HTTP keeps the app image unchanged and the
engine out of process. This supersedes the in-process/vendored approach (A) and
the embedded-Python approach (B2).

## Files affected

- `api/src/lib/supertonic.ts` — rewritten as an HTTP client.
- `api/src/routes/tts.ts` — async Supertonic branch; explicit-engine gating;
  `fallback: true` on unavailability/failure; WAV caching.
- `api/package.json` — removed `onnxruntime-node`.
- `Dockerfile` — removed the model stage, its `COPY`, and `libgomp`/`libstdc++`.
- `docker-compose.yml`, `deploy/docker-compose.yml` — added the `supertonic`
  sidecar, `supertonic-cache` volume, and `SUPERTONIC_URL`.
- `deploy/.env.example` — documented `SUPERTONIC_URL`.
- `languages/types.ts` — `SUPERTONIC_LANGUAGE_CODES`, `supertonicLang`,
  `supertonicVoice`.
- `languages/zh/manifest.ts` — removed Supertonic.
- `languages/registry.test.ts` — conformance test for `supertonicLang`.
- `src/app/settings/components/TTSSettings/index.tsx` — warning text and button
  gating.
- `api/src/lib/supertonic.test.ts` — new unit tests.
- `api/src/routes/tts.test.ts` — Supertonic route tests.
- `README.md`, `deploy/README.md` — feature and deploy docs.
- `api/bun.lock` — regenerated.

## Before vs After

Availability:

```ts
// Before — in-process session; the probe looked for a file that never existed
export function isSupertonicAvailable(): boolean {
  return session !== null && voiceEmbeddings.size === VALID_VOICES.length;
}
const ONNX_MODEL_PATH = path.join(ASSETS_DIR, 'onnx', 'model.onnx');

// After — HTTP probe against the sidecar, cached briefly
export async function isSupertonicAvailable(): Promise<boolean> {
  const url = baseUrl();
  if (!url) return false;
  // GET {url}/v1/styles, cached for STATUS_TTL_MS
}
```

Synthesis:

```ts
// Before
throw new Error('Supertonic inference not yet implemented — model assets required');

// After
const response = await fetch(`${url}/v1/tts`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text, voice, lang, steps: 8, speed, response_format: 'wav' }),
  signal: AbortSignal.timeout(SYNTH_TIMEOUT_MS),
});
return Buffer.from(await response.arrayBuffer()).toString('base64');
```

Route dispatch:

```ts
// Before: availability checked synchronously; failures fell through to Google
if (!isSupertonicAvailable()) { /* let the next engine try */ }
// could silently return a Google voice the learner did not pick

// After: async, explicit-engine only, predictable fallback
if (requestedEngine === 'supertonic' && audio.includes('supertonic')) {
  if (!(await isSupertonicAvailable())) {
    return c.json({ error: 'Supertonic is unavailable', fallback: true }, 503);
  }
  // ...synthesize, cache, or
  return c.json({ error: 'Speech synthesis failed', fallback: true }, 502);
}
```

Compose (inline Dockerfile so the server copy stays two files):

```yaml
supertonic:
  image: lector-supertonic:latest
  build:
    context: .
    dockerfile_inline: |
      FROM python:3.12-slim
      RUN pip install --no-cache-dir 'supertonic[serve]'
      EXPOSE 7788
      CMD ["supertonic", "serve", "--host", "0.0.0.0", "--port", "7788"]
  command: ["sh", "-c", "supertonic download && exec supertonic serve --host 0.0.0.0 --port 7788"]
  volumes: [supertonic-cache:/root/.cache]
```

## Reasoning

- **Sidecar over in-process.** `onnxruntime` has no musl wheel, so Python cannot
  run in the Alpine image. A glibc sidecar is the only realistic host, and it
  mirrors the existing `ollama` service. It also keeps the ~400 MB model and the
  heavy Python stack out of the app image, following the repo's runtime-fetch
  philosophy (#438).
- **Long-lived process, not per-call subprocess.** A per-request `supertonic`
  invocation would reload a 400 MB model each time. `supertonic serve` holds the
  model warm; the API is a thin HTTP client.
- **Explicit-engine only.** All 21 Supertonic-capable packs list `google` first.
  Treating an omitted `engine` as "try Supertonic" contradicted the pack order.
  Restricting the branch to `engine === 'supertonic'` also keeps the user's
  engine choice honest: a failure returns `fallback: true` (browser), never a
  different server voice.
- **Unmetered.** Like eSpeak, Supertonic runs on the operator's CPU with zero
  marginal cost, so it bypasses `ttsCharsPerMonth`. Output is cached like Google.
- **Rate mapping.** The app's neutral rate is 1.0× and the engine's default
  speed is 1.05, so `mapRateToSpeed(1.0) = 1.05`, clamped to the engine's
  0.7–2.0 range.
- **Shared language list.** `SUPERTONIC_LANGUAGE_CODES` lives in
  `languages/types.ts` so the registry test can reject a pack that claims a
  language the engine cannot read, without importing from `api/` into the shared
  layer. The type is left as `string` on `LanguageConfig` because manifests are
  plain object literals that would each need `as const`, matching how `ttsVoice`
  is typed.

## Risks and side effects

- **Docker Compose ≥ 2.24 required** for `build.dockerfile_inline`. If an older
  Compose is used, `docker compose up` fails on the sidecar's build. Update
  Compose, or replace the inline build with a prebuilt image. `lector` does not
  gate on the sidecar's health, so a slow model download does not hold up the
  app; the API degrades to Google/browser speech until the engine answers.
- **First start is slow.** The ~400 MB model downloads into the
  `supertonic-cache` volume before `supertonic serve` starts (hence the 600 s
  healthcheck `start_period`). Later starts are fast. Removing the volume forces
  a re-download.
- **Upstream project is archived.** `supertone-inc/supertonic-py` is archived
  ("development and support have ended"). The pinned PyPI package and the
  open-weight models still work, and because the boundary is HTTP, a maintained
  fork or a different engine can replace the sidecar without touching the Lector
  API. `supertonic serve` binds `0.0.0.0` inside the compose network only; do not
  publish port 7788.
- **Not exercised end to end here.** No live `supertonic serve` was run in this
  environment, so the route tests use a fake fetch. The first real deployment
  should confirm a 200 with `audio/wav` for a supported language.
- **Reversible.** Set `SUPERTONIC_URL` empty (or drop the `supertonic` service)
  to run with Google/browser speech only. Nothing else in the stack depends on
  it.
