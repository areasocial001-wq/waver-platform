/**
 * Lightweight client-side language detector for the TTS composer.
 *
 * Strategy:
 *   1. Script detection (CJK, Hangul, Hiragana/Katakana) – very reliable for
 *      ja/zh/ko vs Latin.
 *   2. Stop-word / function-word frequency scoring for the Latin-script
 *      languages we support (it / en / es / fr / de / pt / pl).
 *   3. Diacritic boosters for ambiguous short texts (e.g. "ñ" → es, "ß" → de).
 *
 * Supports exactly the codes listed in SUPPORTED_LANGUAGES:
 *   it, en, es, fr, de, pt, pl, ja, zh, ko
 *
 * The detector is intentionally cheap so it can run on every keystroke
 * (debounced by the caller). It returns `null` when confidence is too low
 * (very short text or ties), so the UI can keep the user's last choice.
 */

export type SupportedLangCode =
  | "it"
  | "en"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "pl"
  | "ja"
  | "zh"
  | "ko";

export interface LanguageDetectionResult {
  langCode: SupportedLangCode;
  /** 0..1 — relative score of the winner over the runner-up. */
  confidence: number;
}

const STOP_WORDS: Record<Exclude<SupportedLangCode, "ja" | "zh" | "ko">, string[]> = {
  it: [
    "il", "lo", "la", "i", "gli", "le", "un", "una", "uno", "e", "ed", "che",
    "di", "del", "della", "dei", "delle", "a", "al", "alla", "in", "nel",
    "nella", "con", "per", "su", "sul", "sulla", "non", "è", "sono", "sei",
    "siamo", "siete", "questa", "questo", "quella", "quello", "ciao",
    "anche", "ma", "però", "molto", "tutto", "tutti", "fare", "essere",
  ],
  en: [
    "the", "a", "an", "and", "or", "but", "of", "in", "on", "at", "to",
    "for", "with", "is", "are", "was", "were", "be", "been", "being",
    "this", "that", "these", "those", "it", "its", "as", "by", "from",
    "have", "has", "had", "do", "does", "did", "you", "your", "we", "they",
    "not", "if", "then", "than", "so", "what", "which", "who", "how",
  ],
  es: [
    "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o", "pero",
    "de", "del", "en", "con", "por", "para", "sin", "sobre", "que", "es",
    "son", "está", "están", "ser", "estar", "este", "esta", "estos", "estas",
    "se", "no", "más", "muy", "como", "pero", "porque", "también", "hola",
    "qué", "cómo", "cuando", "donde", "yo", "tú", "él", "ella", "nosotros",
  ],
  fr: [
    "le", "la", "les", "un", "une", "des", "et", "ou", "mais", "de", "du",
    "au", "aux", "dans", "avec", "pour", "sans", "sur", "que", "qui",
    "est", "sont", "être", "avoir", "ce", "cette", "ces", "ne", "pas",
    "plus", "très", "comme", "aussi", "bonjour", "salut", "vous", "nous",
    "ils", "elles", "je", "tu", "il", "elle", "où", "quand", "comment",
    "pourquoi", "alors", "donc",
  ],
  de: [
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen",
    "einem", "einer", "und", "oder", "aber", "von", "zu", "im", "in",
    "mit", "für", "auf", "ist", "sind", "war", "waren", "sein", "haben",
    "hat", "nicht", "auch", "sehr", "wie", "so", "wenn", "dann", "weil",
    "ich", "du", "wir", "ihr", "sie", "es", "hallo", "guten", "tag",
    "über", "noch", "schon",
  ],
  pt: [
    "o", "a", "os", "as", "um", "uma", "uns", "umas", "e", "ou", "mas",
    "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "com",
    "por", "para", "sem", "sobre", "que", "é", "são", "está", "estão",
    "ser", "estar", "este", "esta", "estes", "estas", "isso", "isto",
    "não", "muito", "como", "também", "olá", "obrigado", "obrigada",
    "você", "vocês", "eu", "ele", "ela", "nós", "porque",
  ],
  pl: [
    "i", "w", "na", "z", "do", "to", "że", "się", "nie", "jest", "są",
    "być", "ma", "mam", "ten", "ta", "to", "te", "ci", "tym", "tej",
    "który", "która", "które", "ale", "lub", "albo", "oraz", "jak",
    "tak", "bardzo", "dużo", "mało", "dzień", "dobry", "cześć", "ja",
    "ty", "my", "wy", "oni", "one", "po", "od", "przez", "dla",
  ],
};

/**
 * Distinctive characters / digraphs that strongly hint at a specific language
 * even in very short text.
 */
const DIACRITIC_HINTS: Array<{ pattern: RegExp; lang: SupportedLangCode; weight: number }> = [
  { pattern: /[ąćęłńóśźż]/i, lang: "pl", weight: 4 },
  { pattern: /ß/i,            lang: "de", weight: 4 },
  { pattern: /ñ/i,            lang: "es", weight: 3 },
  { pattern: /[¡¿]/,           lang: "es", weight: 3 },
  { pattern: /ç/i,             lang: "fr", weight: 2 },
  { pattern: /œ/i,             lang: "fr", weight: 3 },
  { pattern: /[àâêîôûœ]/i,    lang: "fr", weight: 1 },
  { pattern: /ã/i,             lang: "pt", weight: 3 },
  { pattern: /õ/i,             lang: "pt", weight: 3 },
  { pattern: /[äöü]/i,         lang: "de", weight: 1 },
  { pattern: /[èéìòù]/i,       lang: "it", weight: 1 },
];

function detectByScript(text: string): SupportedLangCode | null {
  // Hiragana or Katakana → Japanese
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return "ja";
  // Hangul → Korean
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) return "ko";
  // CJK Unified Ideographs without kana/hangul → Chinese
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  return null;
}

export function detectLanguage(rawText: string): LanguageDetectionResult | null {
  const text = rawText.trim();
  if (text.length < 12) return null;

  const scriptHit = detectByScript(text);
  if (scriptHit) {
    return { langCode: scriptHit, confidence: 1 };
  }

  const lower = text.toLowerCase();
  const tokens = lower.match(/[a-zA-Zàâäçèéêëìíîïñòóôöùúûüýÿœæßąćęłńóśźż]+/g) ?? [];
  if (tokens.length < 3) return null;

  const scores: Record<string, number> = {};
  for (const lang of Object.keys(STOP_WORDS) as Array<keyof typeof STOP_WORDS>) {
    const set = new Set(STOP_WORDS[lang]);
    let hits = 0;
    for (const t of tokens) if (set.has(t)) hits++;
    // Normalize by token count so longer texts don't dominate single short words
    scores[lang] = hits / Math.sqrt(tokens.length);
  }

  // Apply diacritic boosters
  for (const hint of DIACRITIC_HINTS) {
    if (hint.pattern.test(text)) {
      scores[hint.lang] = (scores[hint.lang] ?? 0) + hint.weight * 0.05;
    }
  }

  const ranked = Object.entries(scores)
    .map(([lang, score]) => ({ lang: lang as SupportedLangCode, score }))
    .sort((a, b) => b.score - a.score);

  const winner = ranked[0];
  const runnerUp = ranked[1];
  if (!winner || winner.score === 0) return null;

  // Confidence = relative gap over runner-up, clamped to [0,1]
  const gap = runnerUp ? (winner.score - runnerUp.score) / Math.max(winner.score, 0.0001) : 1;
  const confidence = Math.max(0, Math.min(1, gap));

  // Require a small minimum signal to avoid flapping on ties
  if (winner.score < 0.3 || confidence < 0.15) return null;

  return { langCode: winner.lang, confidence };
}
