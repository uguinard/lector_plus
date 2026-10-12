# Browser TTS Voice Selector — Implementation Plan

## Goal
Add a curated voice selector to the TTS settings that shows only high-quality browser voices for the active language, using the Readium Speech project's curated voice lists as the quality filter.

## Background
- Current TTS settings only offer "Managed voice" (Google Cloud) and "Browser Built-in" as radio buttons
- No voice selection UI exists for browser TTS
- Browser `speechSynthesis.getVoices()` returns all OS voices (many low-quality/novelty)
- Readium Speech project curates voices by quality (veryHigh → veryLow) across 46 languages
- All 6 target languages (en, fr, de, es, zh, ja) have excellent `veryHigh` quality Microsoft Edge voices + `high` quality Google Chrome voices

## Curated Voice Data (from readium/speech JSON)

| Language | ttsCode | Top veryHigh Voices (Edge) | High Voices (Chrome) | Normal Voices (Windows) |
|----------|---------|---------------------------|---------------------|------------------------|
| English  | en-US   | Emma, Ava, Andrew, Brian, Jenny, Aria, Michelle, Ana, Guy, Eric, Steffan, Christopher, Roger | Google US/UK English | Zira, David, Mark, Hazel, Susan, George |
| French   | fr-FR   | Vivienne, Denise, Remy, Henri, Eloise | Google français | Julie, Hortence, Paul, Caroline, Claude |
| German   | de-DE   | Seraphina, Amala, Katja, Florian, Conrad, Killian | Google Deutsch | Hedda, Katja, Stefan |
| Spanish  | es-ES   | Elvira, Alvaro, Dalia, Jorge, Elena, Tomas | Google español (ES/US) | Helena, Laura, Pablo, Sabina, Raul |
| Chinese  | cmn-CN  | Xiaoxiao, Xiaoyi, Yunxi, Yunxia, Yunjian, Yunyang | Google 普通话/國語 | Huihui, Yaoyao, Kangkang |
| Japanese | ja-JP   | Nanami, Keita | Google 日本語 | Ayumi, Haruka, Ichiro |

## Architecture

### Data Layer
Create `src/lib/browser-tts-voices.ts`:
- Embed curated voice lists for the 6 languages (subset of readium/speech data)
- Export `getRecommendedVoices(languageCode: string): RecommendedVoice[]`
- Filter logic: match by `name` + `altNames` + `nativeID` against `SpeechSynthesisVoice.name` and `voiceURI`
- Sort by quality: `veryHigh` > `high` > `normal` > `low` > `veryLow`
- Deduplicate by label

### Settings Component
Modify `src/app/settings/components/TTSSettings/index.tsx`:
- Add state: `availableVoices: SpeechSynthesisVoice[]`, `recommendedVoices: RecommendedVoice[]`, `selectedVoiceName: string`
- On mount/language change: call `waitForVoices()` → `getAvailableVoices()` → filter to recommended
- When `currentTTSMode === 'browser'`: render `<select>` with recommended voices
- Option format: `"{label} ({quality})"` e.g., "Emma (veryHigh, Edge)"
- On change: `setPreferredVoice(name)`, test with `speak(testPhrase)`
- Show "No recommended voices found — install voice pack in OS settings" if empty

### Voice Matching Strategy
```typescript
function matchVoice(browserVoice: SpeechSynthesisVoice, recommended: RecommendedVoice): boolean {
  const names = [recommended.name, ...(recommended.altNames ?? []), ...(recommended.nativeID ?? [])];
  return names.some(n => 
    browserVoice.name === n || 
    browserVoice.voiceURI?.includes(n) ||
    (recommended.localizedName === 'apple' && browserVoice.name === recommended.name) // Apple voices use simple names
  );
}
```

### Persistence
- Key: `lector-tts-voice-${languageCode}` (per-language, not global)
- Migration: read old global `lector-tts-voice`, write per-language, delete global

## Files to Create/Modify

### New File
- `src/lib/browser-tts-voices.ts` — curated voice data + matching logic

### Modified Files
- `src/app/settings/components/TTSSettings/index.tsx` — voice selector UI
- `src/lib/tts.ts` — add `getRecommendedVoices()` export, update `getCurrentVoiceName()` to accept language param

## Edge Cases
1. **Voices load async** — use `waitForVoices()` + `voiceschanged` listener
2. **No recommended voices available** — show install hint, fall back to `getAvailableVoices()` (all voices)
3. **Voice name changes across browsers** — use `altNames` + `nativeID` for fuzzy matching
4. **Language switch** — re-fetch voices, restore per-language preference
5. **User installs new voice pack** — add "Refresh voices" button triggering `waitForVoices()`

## Validation
- Test on macOS (Apple voices), Windows (Edge/Chrome/SAPI), Linux (speech-dispatcher)
- Verify selection persists across reloads and language switches
- Verify "Test Voice" button uses selected voice
- Verify fallback to all voices when no recommended match

## Out of Scope
- Voice preview without speaking (requires audio context)
- Gender/quality filter UI (curated list already filtered)
- Cloud TTS voice selection (managed by server)
- Latin (la) — `audio: 'none'` by design