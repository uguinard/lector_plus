import { Button } from '@/components/ui/button';
import {
  getTTSMode,
  isGoogleTTSConfigured,
  setTTSMode,
  speak,
  TTSMode,
  getRecommendedVoices,
  getBestVoice,
  formatVoiceLabel,
  setPreferredVoice,
  getCurrentVoiceName,
  waitForVoices as loadVoices,
} from '@/lib/tts';
import { lectorMode } from '@/lib/api-base';
import { getEntitlements } from '@/lib/data-layer';
import { useActiveLanguage } from '@/utils/hooks';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { SETTINGS_KEYS } from '../../constants';
import type { RecommendedVoice } from '@/lib/browser-tts-voices';

export default function TTSSettings() {
  const [ttsSpeed, setTTSSpeed] = useState(1);
  const activeLang = useActiveLanguage();
  const [currentTTSMode, setCurrentTTSMode] = useState<TTSMode>('browser');
  const [googleTTSAvailable, setGoogleTTSAvailable] = useState<boolean | null>(null);
  const [managedTTSIncluded, setManagedTTSIncluded] = useState<boolean | null>(null);

  // Voice selector state
  const [recommendedVoices, setRecommendedVoices] = useState<RecommendedVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [loadingVoices, setLoadingVoices] = useState(false);

  // Languages without a Google voice (eo) always speak through the server's
  // self-hosted eSpeak NG engine — no engine choice, no plan gating, no
  // browser fallback (#307 §3.2c). The picker below absents itself.
  const noAudio = activeLang.pronunciation.audio === 'none';
  const espeakOnly =
    activeLang.pronunciation.audio !== 'none' && !activeLang.pronunciation.audio.includes('google');

  useEffect(() => {
    const init = async () => {
      setCurrentTTSMode(getTTSMode());
      setTTSSpeed(parseFloat(localStorage.getItem(SETTINGS_KEYS.TTS_SPEED) || '1.0'));

      // eSpeak-only languages skip the managed-voice probe entirely: the
      // Google mode/upsell UI is hidden, and probing /api/tts would just
      // synthesize a throwaway espeak clip.
      if (espeakOnly) return;

      if (lectorMode() === 'cloud') {
        const entitlements = await getEntitlements();
        const allowance = entitlements?.limits.ttsCharsPerMonth;
        if (allowance === 0) {
          // Free and Free+BYOK always use the browser voice. Clear a stale
          // managed preference left by a lapsed paid subscription so every
          // future Speak action stays local without a doomed API request.
          setManagedTTSIncluded(false);
          setGoogleTTSAvailable(false);
          setCurrentTTSMode('browser');
          setTTSMode('browser');
          return;
        }
        setManagedTTSIncluded(allowance === null || typeof allowance === 'number');
      }

      // Paid cloud and self-hosted deployments still verify that managed TTS
      // is configured before enabling it.
      setGoogleTTSAvailable(await isGoogleTTSConfigured());
    };

    void init();
  }, [espeakOnly]);

  // Load browser voices when component mounts or language/mode changes
  useEffect(() => {
    if (currentTTSMode !== 'browser') return;

    const load = async () => {
      setLoadingVoices(true);
      try {
        const voices = await loadVoices();

        // Get curated voices for the active language
        const recommended = getRecommendedVoices(activeLang.code, voices);
        setRecommendedVoices(recommended);

        // Restore saved preference or pick best available
        const saved = getCurrentVoiceName(activeLang.code);
        let voiceName = saved;
        if (!voiceName && recommended.length > 0) {
          const best = getBestVoice(activeLang.code, voices);
          voiceName = best?.name;
        }
        setSelectedVoiceName(voiceName ?? '');
      } finally {
        setLoadingVoices(false);
      }
    };

    void load();
  }, [currentTTSMode, activeLang.code]);

  const handleTTSModeChanged = (ttsMode: TTSMode) => {
    setCurrentTTSMode(ttsMode);
    setTTSMode(ttsMode);
  };

  const handleTTSSpeedChanged = (e: ChangeEvent<HTMLInputElement>) => {
    const newVal = parseFloat(e.target.value);

    setTTSSpeed(newVal);
    localStorage.setItem(SETTINGS_KEYS.TTS_SPEED, `${newVal}`);
  };

  const handleVoiceChange = (voiceName: string) => {
    setSelectedVoiceName(voiceName);
    setPreferredVoice(voiceName, activeLang.code);
    // Test the new voice immediately
    speak(activeLang.testPhrase, ttsSpeed);
  };

  const handleRefreshVoices = useCallback(async () => {
    setLoadingVoices(true);
    try {
      const voices = await loadVoices();
      const recommended = getRecommendedVoices(activeLang.code, voices);
      setRecommendedVoices(recommended);
      if (recommended.length > 0 && !selectedVoiceName) {
        const best = getBestVoice(activeLang.code, voices);
        if (best) {
          setSelectedVoiceName(best.name);
          setPreferredVoice(best.name, activeLang.code);
        }
      }
    } finally {
      setLoadingVoices(false);
    }
  }, [activeLang.code, selectedVoiceName]);

  const testSpeaking = useCallback(() => {
    // Every pack carries a sample sentence — no per-language switch needed.
    speak(activeLang.testPhrase, ttsSpeed);
  }, [activeLang, ttsSpeed]);

  if (noAudio) {
    return (
      <section className="panel space-y-4 p-6" data-testid="tts-settings">
        <h2 className="text-lg font-semibold text-foreground">Text-to-Speech</h2>
        <p className="text-xs text-muted-foreground" data-testid="no-audio-note">
          {activeLang.name} has no synthesized voice. Pronunciation is disputed, so Lector stays
          silent.
        </p>
      </section>
    );
  }

  return (
    <section className="panel space-y-4 p-6" data-testid="tts-settings">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Text-to-Speech</h2>
        {espeakOnly ? (
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Synthesized voice</span>
          </div>
        ) : (
          googleTTSAvailable !== null && (
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  googleTTSAvailable ? 'bg-primary' : 'bg-yellow-500'
                }`}
              />
              <span className="text-sm text-muted-foreground">
                {managedTTSIncluded === false
                  ? 'Browser voice · Free'
                  : googleTTSAvailable
                    ? 'Managed voice available'
                    : 'Using browser voice'}
              </span>
            </div>
          )
        )}
      </div>

      {espeakOnly ? (
        <p className="text-xs text-muted-foreground" data-testid="espeak-voice-note">
          {activeLang.name} is spoken by eSpeak NG, a synthesized voice hosted by Lector — the only
          text-to-speech engine that exists for {activeLang.name}. It sounds robotic but pronounces
          every word exactly, and it&apos;s included on every plan.
        </p>
      ) : (
        <div>
          <label className="block text-sm font-medium text-foreground">Voice Engine</label>
<p className="mb-2 text-xs text-muted-foreground">
              {managedTTSIncluded === false
                ? 'Browser speech stays free and works across reading, practice, and dictation. Cloud adds a consistent managed voice.'
                : 'Piper (offline, high quality) available; managed voices offer more consistent pronunciation; your browser voice is always available.'}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={!googleTTSAvailable}
              onClick={() => handleTTSModeChanged('google')}
              variant={currentTTSMode === 'google' ? 'default' : 'secondary'}
            >
              Managed voice
            </Button>
            <Button
              onClick={() => handleTTSModeChanged('piper')}
              variant={currentTTSMode === 'piper' ? 'default' : 'secondary'}
            >
              Piper (offline)
            </Button>
            <Button
              onClick={() => handleTTSModeChanged('browser')}
              variant={currentTTSMode === 'browser' ? 'default' : 'secondary'}
            >
              Browser Built-in
            </Button>
          </div>
          {managedTTSIncluded === false && (
            <p className="mt-3 rounded-lg border border-border bg-[var(--primary-soft)] p-3 text-xs text-foreground">
              Want Lector&apos;s managed voice?{' '}
              <a href="/subscribe" className="font-semibold text-primary hover:underline">
                Upgrade to Cloud
              </a>
              . Adding your own AI key does not change audio because voice usage is hosted by
              Lector.
            </p>
          )}
        </div>
      )}

      {currentTTSMode === 'browser' && !espeakOnly && (
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-foreground">Browser Voice</label>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefreshVoices}
              disabled={loadingVoices}
            >
              {loadingVoices ? 'Loading…' : 'Refresh voices'}
            </Button>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            Curated high-quality voices for {activeLang.name}. Install additional voices in your OS
            settings if needed.
          </p>
          {loadingVoices ? (
            <p className="text-xs text-muted-foreground">Loading voices…</p>
          ) : recommendedVoices.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No recommended voices found — install a voice pack in OS settings{' '}
              <Button variant="link" size="sm" className="h-auto p-0" onClick={handleRefreshVoices}>
                Refresh
              </Button>
            </p>
          ) : (
            <select
              value={selectedVoiceName}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="browser-voice-select"
            >
              {recommendedVoices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {formatVoiceLabel(voice)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div>
        <Button onClick={testSpeaking}>Test Voice</Button>
      </div>

      <div>
        <label className="mb-2 flex items-center justify-between text-sm font-medium text-foreground">
          <span>Speech Speed</span>
          <span className="font-mono text-muted-foreground">{ttsSpeed.toFixed(1)}x</span>
        </label>
        <input
          type="range"
          min="0.5"
          max="1.5"
          step="0.1"
          value={ttsSpeed}
          onChange={handleTTSSpeedChanged}
          className="w-full accent-blue-500"
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>0.5x (Slow)</span>
          <span>1.0x</span>
          <span>1.5x (Fast)</span>
        </div>
      </div>
    </section>
  );
}
