# Supertonic TTS Integration Plan

## Goal
Add Supertonic TTS as a third voice engine option in Lector, running on the API backend (Bun/Hono), alongside existing Google Cloud TTS and browser TTS.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Next.js)                         │
│  Settings: [Managed/Google] [Supertonic] [Browser]              │
│  speak() → calls /api/tts with engine parameter                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API (Hono on Bun)                          │
│  POST /api/tts                                                  │
│    ├─ engine: 'google'  → Google Cloud TTS (existing)           │
│    ├─ engine: 'espeak'  → eSpeak NG subprocess (existing)       │
│    └─ engine: 'supertonic' → Supertonic ONNX Runtime (NEW)      │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### 1. Add Supertonic Dependencies to API

Add to `api/package.json`:
- `onnxruntime-node` (or `onnxruntime-web` for browser, but we need Node for API)
- Supertonic model assets (~400MB) - download at build/runtime

**Decision**: Use the Node.js implementation from `supertone-inc/supertonic` repo directly since there's no published npm package for Node.js. We'll vendor the necessary code.

### 2. Create Supertonic Engine Module

New file: `api/src/lib/supertonic.ts`
- Initialize ONNX Runtime session with Supertonic models
- Load voice styles (M1-M5, F1-F5)
- Map Lector language codes to Supertonic language codes
- Provide `synthesize(text, lang, voice, rate)` function

### 3. Extend TTS Route (`api/src/routes/tts.ts`)

- Add `engine` parameter to request body (default: 'google' for backward compat)
- Add Supertonic dispatch branch after Google/eSpeak
- Handle Supertonic-specific errors (model not loaded, unsupported language)
- No metering for Supertonic (zero marginal cost, like eSpeak)
- Cache Supertonic output in existing TTS cache

### 4. Update Client TTS Module (`src/lib/tts.ts`)

- Add `'supertonic'` to `TTSMode` type
- Add `getTTSMode()`/`setTTSMode()` support for 'supertonic'
- Update `speak()` to pass engine parameter to `/api/tts`
- Add Supertonic availability check (model loaded on server)

### 5. Update Settings UI (`src/app/settings/components/TTSSettings/index.tsx`)

- Add Supertonic button to Voice Engine selector
- Show Supertonic status (available/unavailable)
- Add voice selection for Supertonic (M1-M5, F1-F5)
- Only show for languages supported by Supertonic

### 6. Language Configuration

Add Supertonic voice mapping to each language manifest:
```typescript
// In languages/<code>/manifest.ts
supertonicVoice: 'M1',  // or F1, etc.
supertonicLang: 'en',   // Supertonic language code
```

Only add for languages supported by Supertonic (24 of 31 app languages).

### 7. Docker/Deployment Updates

- Add ONNX Runtime native dependencies to Dockerfile
- Download Supertonic models at build time or runtime
- Ensure model directory is accessible to API

## Language Mapping

| App Code | Supertonic Code | Supported |
|----------|-----------------|-----------|
| en       | en              | ✅        |
| de       | de              | ✅        |
| es       | es              | ✅        |
| fr       | fr              | ✅        |
| it       | it              | ✅        |
| pt       | pt              | ✅        |
| nl       | nl              | ✅        |
| pl       | pl              | ✅        |
| ru       | ru              | ✅        |
| ja       | ja              | ✅        |
| ko       | ko              | ✅        |
| zh       | zh              | ⚠️ (zh-CN) |
| ar       | ar              | ✅        |
| hi       | hi              | ✅        |
| tr       | tr              | ✅        |
| uk       | uk              | ✅        |
| cs       | cs              | ✅        |
| el       | el              | ✅        |
| fi       | fi              | ✅        |
| sv       | sv              | ✅        |
| hu       | hu              | ✅        |
| id       | id              | ✅        |
| nb       | nb              | ⚠️ (no)   |
| af       | af              | ❌        |
| bn       | bn              | ❌        |
| eo       | eo              | ❌        |
| grc      | grc             | ❌        |
| la       | la              | ❌        |

## API Changes

### Request Body
```typescript
interface SynthesizeRequest {
  text: string;
  rate?: number;
  language?: string;
  engine?: 'google' | 'supertonic' | 'espeak';  // NEW
  voice?: string;  // For Supertonic: 'M1'..'M5', 'F1'..'F5'
}
```

### Response
```typescript
// Success
{ audioContent: string (base64), contentType: 'audio/wav', cached?: boolean }

// Fallback (client should use browser TTS)
{ error: string, fallback: true }

// No audio possible
{ error: string, noAudio: true }
```

## Client Changes

### TTS Mode Type
```typescript
export type TTSMode = 'google' | 'supertonic' | 'browser';
```

### speak() Function
Pass `engine` parameter based on current mode:
- 'google' → engine: 'google'
- 'supertonic' → engine: 'supertonic'
- 'browser' → skip API, use browser TTS directly

## Settings UI Changes

```
Voice Engine
┌─────────────┬─────────────┬────────────────┐
│ Managed     │ Supertonic  │ Browser Built-in│
│ (Google)    │ (Local AI)  │                │
└─────────────┴─────────────┴────────────────┘

Supertonic Voice (when selected)
┌─────────────────────────────────┐
│ M1 (Male)        ▼              │
│ M2 (Male)                      │
│ M3 (Male)                      │
│ M4 (Male)                      │
│ M5 (Male)                      │
│ F1 (Female)                    │
│ F2 (Female)                    │
│ F3 (Female)                    │
│ F4 (Female)                    │
│ F5 (Female)                    │
└─────────────────────────────────┘
```

## Supertonic Model Setup

Models (~400MB) downloaded from Hugging Face:
- `supertone-inc/supertonic` (v2, 5 languages, 66M params)
- `supertone-inc/supertonic-3` (v3, 31 languages, 99M params) - **USE THIS**

Model structure:
```
assets/
  onnx/           # ONNX model files
  voice_styles/   # M1-M5, F1-F5 JSON files
```

## Error Handling

- Model not loaded → fallback to Google/browser
- Language not supported → fallback
- ONNX Runtime error → fallback, log error
- Timeout → fallback

## Testing

- Unit tests for Supertonic engine module
- API route tests for new engine parameter
- E2E tests for Supertonic voice selection and playback
- Verify fallback behavior when Supertonic unavailable

## Rollout

1. Deploy API with Supertonic (hidden behind feature flag initially)
2. Enable in settings for supported languages
3. Monitor error rates and latency
4. Make default for self-hosted deployments (no API key needed)

## Open Questions

1. **Model version**: Use supertonic-3 (31 languages) or supertonic-2 (5 languages)?
   - Recommendation: supertonic-3 for broader language support

2. **Default voice**: Which Supertonic voice per language?
   - Recommendation: M1 as default, let users choose

3. **Quality/speed settings**: Expose `steps` (5-12) and `speed` (0.7-2.0) in UI?
   - Start with defaults (steps=8, speed=1.05), add advanced settings later

4. **Model download**: At build time (baked in image) or runtime?
   - Build time for production, runtime with volume for development

5. **GPU acceleration**: ONNX Runtime supports CUDA/ROCm - enable in Docker?
   - CPU-only for now, GPU as future enhancement