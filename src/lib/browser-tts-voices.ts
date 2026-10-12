// Curated browser TTS voices from Readium Speech project
// Quality tiers: veryHigh > high > normal > low > veryLow
// Only languages with 'google' in pronunciation.audio are included (en, fr, de, es, zh, ja).
// Latin (la) has audio: 'none' and is intentionally excluded.

export type VoiceQuality = 'veryHigh' | 'high' | 'normal' | 'low' | 'veryLow';

export interface RecommendedVoice {
  /** Canonical voice name (e.g. "Emma") */
  name: string;
  /** Alternative names this voice may appear as across browsers/OS */
  altNames?: string[];
  /** Native voice identifiers (voiceURI substrings) for fuzzy matching */
  nativeID?: string[];
  /** Quality tier */
  quality: VoiceQuality;
  /** Browser/engine this voice primarily comes from */
  engine: 'Edge' | 'Chrome' | 'Apple' | 'Windows' | 'Other';
  /** BCP 47 language tag this voice is for */
  lang: string;
  /** Apple voices use simple localized names (e.g. "Samantha", "Daniel") */
  localizedName?: 'apple';
}

/** Quality sort order: veryHigh (5) > high (4) > normal (3) > low (2) > veryLow (1) */
const QUALITY_ORDER: Record<VoiceQuality, number> = {
  veryHigh: 5,
  high: 4,
  normal: 3,
  low: 2,
  veryLow: 1,
};

/** Curated voice lists per language (subset of Readium Speech data) */
const CURATED_VOICES: Record<string, RecommendedVoice[]> = {
  en: [
    // veryHigh - Edge voices (Microsoft Neural)
    {
      name: 'Emma',
      altNames: ['Microsoft Emma'],
      nativeID: ['Microsoft Emma'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'en-US',
    },
    {
      name: 'Ava',
      altNames: ['Microsoft Ava'],
      nativeID: ['Microsoft Ava'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'en-US',
    },
    {
      name: 'Andrew',
      altNames: ['Microsoft Andrew'],
      nativeID: ['Microsoft Andrew'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'en-US',
    },
    {
      name: 'Brian',
      altNames: ['Microsoft Brian'],
      nativeID: ['Microsoft Brian'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'en-GB',
    },
    {
      name: 'Jenny',
      altNames: ['Microsoft Jenny'],
      nativeID: ['Microsoft Jenny'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'en-US',
    },
    {
      name: 'Aria',
      altNames: ['Microsoft Aria'],
      nativeID: ['Microsoft Aria'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'en-US',
    },
    {
      name: 'Michelle',
      altNames: ['Microsoft Michelle'],
      nativeID: ['Microsoft Michelle'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'en-US',
    },
    {
      name: 'Ana',
      altNames: ['Microsoft Ana'],
      nativeID: ['Microsoft Ana'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'en-US',
    },
    {
      name: 'Guy',
      altNames: ['Microsoft Guy'],
      nativeID: ['Microsoft Guy'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'en-US',
    },
    {
      name: 'Eric',
      altNames: ['Microsoft Eric'],
      nativeID: ['Microsoft Eric'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'en-US',
    },
    {
      name: 'Steffan',
      altNames: ['Microsoft Steffan'],
      nativeID: ['Microsoft Steffan'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'en-GB',
    },
    {
      name: 'Christopher',
      altNames: ['Microsoft Christopher'],
      nativeID: ['Microsoft Christopher'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'en-US',
    },
    {
      name: 'Roger',
      altNames: ['Microsoft Roger'],
      nativeID: ['Microsoft Roger'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'en-GB',
    },

    // high - Chrome/Google voices
    {
      name: 'Google US English',
      altNames: ['Google US English Female', 'Google US English Male'],
      nativeID: ['Google US English'],
      quality: 'high',
      engine: 'Chrome',
      lang: 'en-US',
    },
    {
      name: 'Google UK English',
      altNames: ['Google UK English Female', 'Google UK English Male'],
      nativeID: ['Google UK English'],
      quality: 'high',
      engine: 'Chrome',
      lang: 'en-GB',
    },

    // normal - Windows SAPI voices
    {
      name: 'Zira',
      altNames: ['Microsoft Zira'],
      nativeID: ['Microsoft Zira'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'en-US',
    },
    {
      name: 'David',
      altNames: ['Microsoft David'],
      nativeID: ['Microsoft David'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'en-US',
    },
    {
      name: 'Mark',
      altNames: ['Microsoft Mark'],
      nativeID: ['Microsoft Mark'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'en-US',
    },
    {
      name: 'Hazel',
      altNames: ['Microsoft Hazel'],
      nativeID: ['Microsoft Hazel'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'en-GB',
    },
    {
      name: 'Susan',
      altNames: ['Microsoft Susan'],
      nativeID: ['Microsoft Susan'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'en-GB',
    },
    {
      name: 'George',
      altNames: ['Microsoft George'],
      nativeID: ['Microsoft George'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'en-GB',
    },
    // high - Apple voices (macOS/iOS)
    {
      name: 'Samantha',
      altNames: [],
      nativeID: ['com.apple.speech.synthesis.voice.samantha'],
      quality: 'high',
      engine: 'Apple',
      lang: 'en-US',
      localizedName: 'apple',
    },
    {
      name: 'Daniel',
      altNames: [],
      nativeID: ['com.apple.speech.synthesis.voice.daniel'],
      quality: 'high',
      engine: 'Apple',
      lang: 'en-GB',
      localizedName: 'apple',
    },
    {
      name: 'Karen',
      altNames: [],
      nativeID: ['com.apple.speech.synthesis.voice.karen'],
      quality: 'high',
      engine: 'Apple',
      lang: 'en-AU',
      localizedName: 'apple',
    },
    {
      name: 'Moira',
      altNames: [],
      nativeID: ['com.apple.speech.synthesis.voice.moira'],
      quality: 'high',
      engine: 'Apple',
      lang: 'en-IE',
      localizedName: 'apple',
    },
    {
      name: 'Tessa',
      altNames: [],
      nativeID: ['com.apple.speech.synthesis.voice.tessa'],
      quality: 'high',
      engine: 'Apple',
      lang: 'en-ZA',
      localizedName: 'apple',
    },
  ],
  fr: [
    // veryHigh - Edge voices
    {
      name: 'Vivienne',
      altNames: ['Microsoft Vivienne'],
      nativeID: ['Microsoft Vivienne'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'fr-FR',
    },
    {
      name: 'Denise',
      altNames: ['Microsoft Denise'],
      nativeID: ['Microsoft Denise'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'fr-FR',
    },
    {
      name: 'Remy',
      altNames: ['Microsoft Remy'],
      nativeID: ['Microsoft Remy'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'fr-FR',
    },
    {
      name: 'Henri',
      altNames: ['Microsoft Henri'],
      nativeID: ['Microsoft Henri'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'fr-FR',
    },
    {
      name: 'Eloise',
      altNames: ['Microsoft Eloise'],
      nativeID: ['Microsoft Eloise'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'fr-FR',
    },

    // high - Chrome voices
    {
      name: 'Google français',
      altNames: ['Google Français', 'Google French'],
      nativeID: ['Google français'],
      quality: 'high',
      engine: 'Chrome',
      lang: 'fr-FR',
    },

    // normal - Windows SAPI voices
    {
      name: 'Julie',
      altNames: ['Microsoft Julie'],
      nativeID: ['Microsoft Julie'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'fr-FR',
    },
    {
      name: 'Hortence',
      altNames: ['Microsoft Hortence'],
      nativeID: ['Microsoft Hortence'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'fr-FR',
    },
    {
      name: 'Paul',
      altNames: ['Microsoft Paul'],
      nativeID: ['Microsoft Paul'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'fr-FR',
    },
    {
      name: 'Caroline',
      altNames: ['Microsoft Caroline'],
      nativeID: ['Microsoft Caroline'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'fr-CA',
    },
    {
      name: 'Claude',
      altNames: ['Microsoft Claude'],
      nativeID: ['Microsoft Claude'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'fr-CA',
    },
    // high - Apple voices (macOS/iOS)
    {
      name: 'Thomas',
      altNames: [],
      nativeID: ['com.apple.speech.synthesis.voice.thomas'],
      quality: 'high',
      engine: 'Apple',
      lang: 'fr-FR',
      localizedName: 'apple',
    },
    {
      name: 'Amelie',
      altNames: ['Amélie'],
      nativeID: ['com.apple.speech.synthesis.voice.amelie'],
      quality: 'high',
      engine: 'Apple',
      lang: 'fr-CA',
      localizedName: 'apple',
    },
  ],
  de: [
    // veryHigh - Edge voices
    {
      name: 'Seraphina',
      altNames: ['Microsoft Seraphina'],
      nativeID: ['Microsoft Seraphina'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'de-DE',
    },
    {
      name: 'Amala',
      altNames: ['Microsoft Amala'],
      nativeID: ['Microsoft Amala'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'de-DE',
    },
    {
      name: 'Katja',
      altNames: ['Microsoft Katja'],
      nativeID: ['Microsoft Katja'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'de-DE',
    },
    {
      name: 'Florian',
      altNames: ['Microsoft Florian'],
      nativeID: ['Microsoft Florian'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'de-DE',
    },
    {
      name: 'Conrad',
      altNames: ['Microsoft Conrad'],
      nativeID: ['Microsoft Conrad'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'de-DE',
    },
    {
      name: 'Killian',
      altNames: ['Microsoft Killian'],
      nativeID: ['Microsoft Killian'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'de-DE',
    },

    // high - Chrome voices
    {
      name: 'Google Deutsch',
      altNames: ['Google German'],
      nativeID: ['Google Deutsch'],
      quality: 'high',
      engine: 'Chrome',
      lang: 'de-DE',
    },

    // normal - Windows SAPI voices
    {
      name: 'Hedda',
      altNames: ['Microsoft Hedda'],
      nativeID: ['Microsoft Hedda'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'de-DE',
    },
    {
      name: 'Stefan',
      altNames: ['Microsoft Stefan'],
      nativeID: ['Microsoft Stefan'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'de-DE',
    },
    // high - Apple voices (macOS/iOS)
    {
      name: 'Anna',
      altNames: [],
      nativeID: ['com.apple.speech.synthesis.voice.anna'],
      quality: 'high',
      engine: 'Apple',
      lang: 'de-DE',
      localizedName: 'apple',
    },
    {
      name: 'Yannick',
      altNames: [],
      nativeID: ['com.apple.speech.synthesis.voice.yannick'],
      quality: 'high',
      engine: 'Apple',
      lang: 'de-DE',
      localizedName: 'apple',
    },
  ],
  es: [
    // veryHigh - Edge voices
    {
      name: 'Elvira',
      altNames: ['Microsoft Elvira'],
      nativeID: ['Microsoft Elvira'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'es-ES',
    },
    {
      name: 'Alvaro',
      altNames: ['Microsoft Alvaro'],
      nativeID: ['Microsoft Alvaro'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'es-ES',
    },
    {
      name: 'Dalia',
      altNames: ['Microsoft Dalia'],
      nativeID: ['Microsoft Dalia'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'es-ES',
    },
    {
      name: 'Jorge',
      altNames: ['Microsoft Jorge'],
      nativeID: ['Microsoft Jorge'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'es-ES',
    },
    {
      name: 'Elena',
      altNames: ['Microsoft Elena'],
      nativeID: ['Microsoft Elena'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'es-ES',
    },
    {
      name: 'Tomas',
      altNames: ['Microsoft Tomas'],
      nativeID: ['Microsoft Tomas'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'es-ES',
    },

    // high - Chrome voices
    {
      name: 'Google español',
      altNames: ['Google Spanish', 'Google español (España)', 'Google español (Estados Unidos)'],
      nativeID: ['Google español'],
      quality: 'high',
      engine: 'Chrome',
      lang: 'es-ES',
    },
    {
      name: 'Google US Spanish',
      altNames: ['Google Spanish (US)'],
      nativeID: ['Google US Spanish'],
      quality: 'high',
      engine: 'Chrome',
      lang: 'es-US',
    },

    // normal - Windows SAPI voices
    {
      name: 'Helena',
      altNames: ['Microsoft Helena'],
      nativeID: ['Microsoft Helena'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'es-ES',
    },
    {
      name: 'Laura',
      altNames: ['Microsoft Laura'],
      nativeID: ['Microsoft Laura'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'es-ES',
    },
    {
      name: 'Pablo',
      altNames: ['Microsoft Pablo'],
      nativeID: ['Microsoft Pablo'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'es-ES',
    },
    {
      name: 'Sabina',
      altNames: ['Microsoft Sabina'],
      nativeID: ['Microsoft Sabina'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'es-MX',
    },
    {
      name: 'Raul',
      altNames: ['Microsoft Raul'],
      nativeID: ['Microsoft Raul'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'es-MX',
    },
    // high - Apple voices (macOS/iOS)
    {
      name: 'Monica',
      altNames: ['Mónica'],
      nativeID: ['com.apple.speech.synthesis.voice.monica'],
      quality: 'high',
      engine: 'Apple',
      lang: 'es-ES',
      localizedName: 'apple',
    },
    {
      name: 'Jorge',
      altNames: [],
      nativeID: ['com.apple.speech.synthesis.voice.jorge'],
      quality: 'high',
      engine: 'Apple',
      lang: 'es-MX',
      localizedName: 'apple',
    },
    {
      name: 'Paulina',
      altNames: [],
      nativeID: ['com.apple.speech.synthesis.voice.paulina'],
      quality: 'high',
      engine: 'Apple',
      lang: 'es-MX',
      localizedName: 'apple',
    },
  ],
  zh: [
    // veryHigh - Edge voices (Mandarin)
    {
      name: 'Xiaoxiao',
      altNames: ['Microsoft Xiaoxiao'],
      nativeID: ['Microsoft Xiaoxiao'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'zh-CN',
    },
    {
      name: 'Xiaoyi',
      altNames: ['Microsoft Xiaoyi'],
      nativeID: ['Microsoft Xiaoyi'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'zh-CN',
    },
    {
      name: 'Yunxi',
      altNames: ['Microsoft Yunxi'],
      nativeID: ['Microsoft Yunxi'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'zh-CN',
    },
    {
      name: 'Yunxia',
      altNames: ['Microsoft Yunxia'],
      nativeID: ['Microsoft Yunxia'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'zh-CN',
    },
    {
      name: 'Yunjian',
      altNames: ['Microsoft Yunjian'],
      nativeID: ['Microsoft Yunjian'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'zh-CN',
    },
    {
      name: 'Yunyang',
      altNames: ['Microsoft Yunyang'],
      nativeID: ['Microsoft Yunyang'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'zh-CN',
    },

    // high - Chrome voices
    {
      name: 'Google 普通话',
      altNames: ['Google Mandarin', 'Google Chinese (China)'],
      nativeID: ['Google 普通话'],
      quality: 'high',
      engine: 'Chrome',
      lang: 'cmn-CN',
    },
    {
      name: 'Google 國語',
      altNames: ['Google Taiwanese Mandarin'],
      nativeID: ['Google 國語'],
      quality: 'high',
      engine: 'Chrome',
      lang: 'zh-TW',
    },

    // normal - Windows SAPI voices
    {
      name: 'Huihui',
      altNames: ['Microsoft Huihui'],
      nativeID: ['Microsoft Huihui'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'zh-CN',
    },
    {
      name: 'Yaoyao',
      altNames: ['Microsoft Yaoyao'],
      nativeID: ['Microsoft Yaoyao'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'zh-CN',
    },
    {
      name: 'Kangkang',
      altNames: ['Microsoft Kangkang'],
      nativeID: ['Microsoft Kangkang'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'zh-CN',
    },
    // high - Apple voices (macOS/iOS)
    {
      name: 'Ting-Ting',
      altNames: ['Tingting'],
      nativeID: ['com.apple.speech.synthesis.voice.ting-ting'],
      quality: 'high',
      engine: 'Apple',
      lang: 'zh-CN',
      localizedName: 'apple',
    },
    {
      name: 'Sin-ji',
      altNames: ['Sinji'],
      nativeID: ['com.apple.speech.synthesis.voice.sin-ji'],
      quality: 'high',
      engine: 'Apple',
      lang: 'zh-HK',
      localizedName: 'apple',
    },
    {
      name: 'Mei-Jia',
      altNames: ['Meijia'],
      nativeID: ['com.apple.speech.synthesis.voice.mei-jia'],
      quality: 'high',
      engine: 'Apple',
      lang: 'zh-TW',
      localizedName: 'apple',
    },
  ],
  ja: [
    // veryHigh - Edge voices
    {
      name: 'Nanami',
      altNames: ['Microsoft Nanami'],
      nativeID: ['Microsoft Nanami'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'ja-JP',
    },
    {
      name: 'Keita',
      altNames: ['Microsoft Keita'],
      nativeID: ['Microsoft Keita'],
      quality: 'veryHigh',
      engine: 'Edge',
      lang: 'ja-JP',
    },

    // high - Chrome voices
    {
      name: 'Google 日本語',
      altNames: ['Google Japanese'],
      nativeID: ['Google 日本語'],
      quality: 'high',
      engine: 'Chrome',
      lang: 'ja-JP',
    },

    // normal - Windows SAPI voices
    {
      name: 'Ayumi',
      altNames: ['Microsoft Ayumi'],
      nativeID: ['Microsoft Ayumi'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'ja-JP',
    },
    {
      name: 'Haruka',
      altNames: ['Microsoft Haruka'],
      nativeID: ['Microsoft Haruka'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'ja-JP',
    },
    {
      name: 'Ichiro',
      altNames: ['Microsoft Ichiro'],
      nativeID: ['Microsoft Ichiro'],
      quality: 'normal',
      engine: 'Windows',
      lang: 'ja-JP',
    },
    // high - Apple voices (macOS/iOS)
    {
      name: 'Kyoko',
      altNames: [],
      nativeID: ['com.apple.speech.synthesis.voice.kyoko'],
      quality: 'high',
      engine: 'Apple',
      lang: 'ja-JP',
      localizedName: 'apple',
    },
  ],
};

/**
 * Check if a browser voice matches a recommended voice.
 * Uses name, altNames, nativeID, and voiceURI for fuzzy matching.
 * Apple voices use simple localized names (e.g. "Samantha", "Daniel").
 */
export function matchVoice(
  browserVoice: SpeechSynthesisVoice,
  recommended: RecommendedVoice,
): boolean {
  const names = [
    recommended.name,
    ...(recommended.altNames ?? []),
    ...(recommended.nativeID ?? []),
  ];

  // Direct name match
  if (names.some((n) => browserVoice.name === n)) {
    return true;
  }

  // voiceURI match (e.g. "com.apple.speech.synthesis.voice.samantha")
  if (browserVoice.voiceURI && names.some((n) => browserVoice.voiceURI!.includes(n))) {
    return true;
  }

  // Apple voices: simple localized names
  if (recommended.localizedName === 'apple' && browserVoice.name === recommended.name) {
    return true;
  }

  return false;
}

/**
 * Get recommended voices for a language, sorted by quality (best first).
 * Filters to only voices available in the current browser.
 */
export function getRecommendedVoices(
  languageCode: string,
  availableVoices: SpeechSynthesisVoice[] = [],
): RecommendedVoice[] {
  const recommended = CURATED_VOICES[languageCode] ?? [];

  if (availableVoices.length === 0) {
    // Return all curated voices if we don't have browser voices yet
    return [...recommended].sort((a, b) => QUALITY_ORDER[b.quality] - QUALITY_ORDER[a.quality]);
  }

  // Filter to only voices that exist in the browser
  const matched = recommended.filter((rec) =>
    availableVoices.some((browserVoice) => matchVoice(browserVoice, rec)),
  );

  // Deduplicate by label (name)
  const seen = new Set<string>();
  const deduped = matched.filter((v) => {
    if (seen.has(v.name)) return false;
    seen.add(v.name);
    return true;
  });

  // Sort by quality
  return deduped.sort((a, b) => QUALITY_ORDER[b.quality] - QUALITY_ORDER[a.quality]);
}

/**
 * Get the best available recommended voice for a language.
 * Returns the highest-quality voice that exists in the browser.
 */
export function getBestRecommendedVoice(
  languageCode: string,
  availableVoices: SpeechSynthesisVoice[] = [],
): SpeechSynthesisVoice | undefined {
  const recommended = getRecommendedVoices(languageCode, availableVoices);
  if (recommended.length === 0) return undefined;

  const best = recommended[0];
  return availableVoices.find((v) => matchVoice(v, best));
}

/**
 * Format a recommended voice for display in the selector.
 * e.g. "Emma (veryHigh, Edge)"
 */
export function formatVoiceLabel(voice: RecommendedVoice): string {
  return `${voice.name} (${voice.quality}, ${voice.engine})`;
}
