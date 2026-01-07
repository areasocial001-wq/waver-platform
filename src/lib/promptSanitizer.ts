/**
 * Sanitizes prompts to remove watermark-related words that AI models refuse to process.
 * Returns a cleaned prompt focused on text/subtitle removal.
 */

const FORBIDDEN_WORDS = [
  "watermark",
  "watermarks",
  "logo",
  "logos",
  "brand",
  "brands",
  "branding",
  "copyright",
  "copyrighted",
  "trademark",
  "trademarks",
  "™",
  "®",
  "©",
];

const FORBIDDEN_PATTERNS = [
  /water\s*mark/gi,
  /water-mark/gi,
  /\blog[oa]s?\b/gi,
  /\bbrand(ing|s)?\b/gi,
  /copy\s*right/gi,
  /trade\s*mark/gi,
];

export function sanitizeRemovalPrompt(prompt: string): { 
  sanitized: string; 
  wasModified: boolean;
  removedTerms: string[];
} {
  let sanitized = prompt;
  const removedTerms: string[] = [];

  // Check for forbidden words
  for (const word of FORBIDDEN_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    if (regex.test(sanitized)) {
      removedTerms.push(word);
      sanitized = sanitized.replace(regex, "");
    }
  }

  // Check for forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    const matches = sanitized.match(pattern);
    if (matches) {
      removedTerms.push(...matches);
      sanitized = sanitized.replace(pattern, "");
    }
  }

  // Clean up extra spaces
  sanitized = sanitized.replace(/\s+/g, " ").trim();

  // If prompt becomes too short or empty after sanitization, use default
  if (sanitized.length < 10) {
    sanitized = "Remove all visible text, subtitles, and captions from this image. Keep the background and all visual elements intact. Make the result look natural.";
  }

  // Ensure prompt focuses on allowed content
  if (!sanitized.toLowerCase().includes("text") && 
      !sanitized.toLowerCase().includes("subtitle") &&
      !sanitized.toLowerCase().includes("caption")) {
    sanitized = `${sanitized} Focus on removing text overlays, subtitles, and captions only.`;
  }

  return {
    sanitized: sanitized.trim(),
    wasModified: removedTerms.length > 0,
    removedTerms: [...new Set(removedTerms)], // Remove duplicates
  };
}

/**
 * Checks if a prompt contains watermark-related terms
 */
export function hasWatermarkTerms(prompt: string): boolean {
  for (const word of FORBIDDEN_WORDS) {
    if (prompt.toLowerCase().includes(word.toLowerCase())) {
      return true;
    }
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(prompt)) {
      return true;
    }
  }
  return false;
}
