# Piper TTS Integration Plan

## Goal
Add Piper TTS as a new managed voice option ("piper" mode) alongside existing "google" and "browser" modes. Piper runs as a subprocess (like eSpeak NG) with models bundled in the Docker image, providing high-quality offline TTS for self-hosted deployments without API keys.

## Scope
- **In scope**: Docker image (piper binary + models), language manifests (piper voice mapping), API route (piper synthesis + dispatch), client TTS settings (new mode), client TTS library (piper mode handling)
- **Out of scope**: Streaming audio, per-user voice selection, model management UI, non-Docker deployments

## Architecture

### Docker Image (Dockerfile)
- Add `piper` binary installation in runner stage (from GitHub releases or build from source)
- Download Piper voice models at build time for supported languages
- Models stored in `/app/piper-models/` (read-only, baked into image)

### Language Manifests (`languages/<code>/manifest.ts`)
- Add optional `piperVoice` field mapping language → Piper model name (e.g., `en_US-lessac-medium`)
- Only languages with Piper models get this field

### API Route (`api/src/routes/tts.ts`)
- New `synthesizeWithPiper(text, voice, rate)` function using `Bun.spawn` (mirrors eSpeak pattern)
- Engine dispatch: languages with `piperVoice` in manifest can use Piper
- New TTS mode "piper" added to client → API contract
- Piper synthesis: unmetered, uncached (like eSpeak), no API key required

### Client Settings (`src/app/settings/components/TTSSettings/index.tsx`)
- Add "piper" to `TTSMode` type
- Show Piper option when active language has `piperVoice` configured
- Piper mode available in self-hosted without API key; in cloud mode, still available but Google remains default

### Client TTS Library (`src/lib/tts.ts`)
- Add "piper" to `TTSMode` type
- `speak()` dispatches to server with `mode: 'piper'` when selected
- Server returns base64 WAV (like eSpeak), client plays via `Audio` element

## Implementation Tasks

### 1. Dockerfile - Install Piper + Models
- [ ] Add piper binary installation in runner stage (download from GitHub releases)
- [ ] Create build arg `PIPER_MODELS` to specify which voice models to download (default: high-quality subset)
- [ ] Download `.onnx` + `.onnx.json` model files for each voice at build time
- [ ] Store models in `/app/piper-models/{voice}/`

### 2. Language Manifests - Add Piper Voice Mapping
- [ ] Add optional `piperVoice?: string` field to `LanguageConfig` type (`languages/types.ts`)
- [ ] Populate `piperVoice` for languages with good Piper models (start: en, de, es, fr, it, pt, nl, pl, ru, zh, ja, ko, af, nb, sv, fi, cs, hu, tr, el, hi, bn, id, ar, uk)
- [ ] Model naming: use Piper's standard names (e.g., `en_US-lessac-medium`, `de_DE-thorsten-medium`)

### 3. API Route - Piper Synthesis + Dispatch
- [ ] Add `synthesizeWithPiper(text, voice, rate)` function using `Bun.spawn(['piper', '--model', modelPath, '--output_raw'], { stdin: 'pipe', stdout: 'pipe' })`
- [ ] Map client `rate` (0.25–4.0) to Piper's `--length_scale` (inverse: 1.0/rate, clamped)
- [ ] Engine dispatch logic: if language has `piperVoice` and mode is "piper", call Piper
- [ ] Return `{ audioContent: base64Wav, contentType: 'audio/wav' }` (uncached, unmetered)
- [ ] Add `piper` to allowed TTS modes in request validation

### 4. Client TTS Settings - New Mode UI
- [ ] Extend `TTSMode` type: `'google' | 'browser' | 'piper'`
- [ ] In TTSSettings: show Piper radio button when `langConfig.piperVoice` exists
- [ ] Label: "Piper (offline, high quality)" with note "Runs locally, no API key needed"
- [ ] Persist mode in localStorage (`lector-tts-mode`)

### 5. Client TTS Library - Piper Mode Handling
- [ ] Extend `TTSMode` type to include `'piper'`
- [ ] In `speak()`: when mode is "piper", call server with `{ text, rate, language, mode: 'piper' }`
- [ ] Server response handling: play base64 WAV via `Audio` element (same as eSpeak path)
- [ ] Update `getTTSMode()`/`setTTSMode()` to handle new value

## Data Flow

```
User selects "Piper" in settings
       ↓
localStorage.setItem('lector-tts-mode', 'piper')
       ↓
speak(text, rate) called
       ↓
mode === 'piper' → apiFetch('/api/tts', { text, rate, language, mode: 'piper' })
       ↓
API: resolve language → get piperVoice from manifest
       ↓
Bun.spawn(piper --model /app/piper-models/{voice}/model.onnx --length_scale X --output_raw)
       ↓
stdin: text → stdout: raw WAV → base64 → JSON response
       ↓
Client: new Audio('data:audio/wav;base64,...').play()
```

## Failure Modes & Handling
- **Piper binary missing**: Log error, return `{ error: 'Piper not installed', fallback: true }` → client falls back to browser TTS
- **Model file missing**: Log error, return fallback
- **Piper process fails**: Log stderr, return fallback
- **Text too long**: Piper has no hard limit but enforce reasonable cap (5000 chars like Google)
- **Rate mapping**: Clamp `--length_scale` to Piper's valid range (0.5–2.0)

## Rollout / Migration
- No migration needed: new mode is additive, defaults unchanged
- Self-hosted users see Piper option immediately after image update
- Cloud users see Piper option but Google remains default
- Existing `lector-tts-mode` values ("google", "browser") still work

## Validation
- [ ] Unit test: `synthesizeWithPiper` produces valid WAV for sample text
- [ ] E2E test: Select Piper in settings → speak test phrase → audio plays
- [ ] E2E test: Switch language → Piper option appears/disappears correctly
- [ ] E2E test: Piper failure → browser TTS fallback works
- [ ] Docker build: Image size increase acceptable (<200MB for ~15 models)
- [ ] Runtime: Piper subprocess completes within 2s for typical sentence

## Open Questions
1. **Model selection**: Start with ~15 high-quality models or all 60+? Recommend: curated subset (en_US-lessac-medium, de_DE-thorsten-medium, es_ES-carlfm-x_low, fr_FR-siwis-medium, it_IT-riccardo-x_low, pt_PT-tugão-medium, nl_NL-clara-medium, pl_PL-darkman-medium, ru_RU-irina-medium, zh_CN-huayan-medium, ja_JP-kurumi-medium, ko_KR-hui-medium, af_ZA-mokone-medium, nb_NO-talesynn-medium, sv_SE-nst-medium) — covers major languages, ~150MB total.

2. **Rate mapping**: Piper uses `--length_scale` (1.0 = normal, lower = faster). Map client rate 0.25–4.0 → length_scale 2.0–0.5 (inverse, clamped). Confirm formula: `length_scale = 1.0 / rate` clamped to [0.5, 2.0].

3. **Cloud mode behavior**: Should Piper be available in cloud mode? Yes — self-hosted users on cloud-mode deployments still benefit. But default remains Google.