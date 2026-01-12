/**
 * Client-side prompt safety checker to detect potentially problematic content
 * before sending to AI video generation APIs.
 */

// Categories of potentially flagged content
export interface SafetyCheckResult {
  isSafe: boolean;
  flaggedCategories: string[];
  severity: 'none' | 'warning' | 'high';
  suggestions: string[];
}

// Words and phrases that may trigger content filters
const VIOLENCE_PATTERNS = [
  /\b(kill|murder|death|dead|dying|blood|gore|violent|destroy|destru|explod|crush|smash|attack|weapon|gun|knife|stab|shoot|bomb|terror)\w*\b/gi,
  /\b(guerra|uccid|mort[eoi]|sangue|violen|distrugg|esplod|schiacc|attacc|arma|pistola|coltello|sparo|bomba)\w*\b/gi, // Italian
];

const ADULT_PATTERNS = [
  /\b(nude|naked|nsfw|porn|sexual|erotic|explicit|adult|xxx)\w*\b/gi,
  /\b(nud[oaie]|porn|sessual|erotic|esplicit)\w*\b/gi, // Italian
];

const HARMFUL_PATTERNS = [
  /\b(suicide|self.?harm|drug|overdose|illegal|hate|racist|discriminat)\w*\b/gi,
  /\b(suicid|autolesion|droga|overdose|illegal|odio|razzis|discrimin)\w*\b/gi, // Italian
];

const CREATURE_VIOLENCE_PATTERNS = [
  /\b(godzilla|monster|kaiju|giant).{0,30}(crush|destroy|smash|attack|stomp|rampage)\w*\b/gi,
  /\b(godzilla|mostro|kaiju|gigante).{0,30}(schiacc|distrugg|attacc|calpest)\w*\b/gi, // Italian
];

const DISASTER_PATTERNS = [
  /\b(catastrophe|disaster|apocalypse|explosion|collapse|debris|rubble|fragment|shatter)\w*\b/gi,
  /\b(catastrofe|disastro|apocalisse|esplosione|crollo|macerie|frantum|scheggi)\w*\b/gi, // Italian
];

export function checkPromptSafety(prompt: string): SafetyCheckResult {
  const lowerPrompt = prompt.toLowerCase();
  const flaggedCategories: string[] = [];
  let severity: 'none' | 'warning' | 'high' = 'none';
  const suggestions: string[] = [];
  
  // Check violence patterns
  const hasViolence = VIOLENCE_PATTERNS.some(p => p.test(prompt));
  if (hasViolence) {
    flaggedCategories.push('violence');
    severity = 'high';
    suggestions.push('Consider removing or rephrasing violent actions (crushing, destroying, attacking)');
  }
  
  // Check creature violence (more specific)
  const hasCreatureViolence = CREATURE_VIOLENCE_PATTERNS.some(p => p.test(prompt));
  if (hasCreatureViolence) {
    flaggedCategories.push('creature_violence');
    severity = 'high';
    suggestions.push('Giant creatures causing destruction often triggers content filters. Try describing the scene without direct destructive actions');
  }
  
  // Check disaster patterns
  const hasDisaster = DISASTER_PATTERNS.some(p => p.test(prompt));
  if (hasDisaster) {
    flaggedCategories.push('disaster');
    if (severity !== 'high') severity = 'warning';
    suggestions.push('Scenes with explosions, debris, or destruction may be flagged. Consider focusing on the aftermath or using gentler descriptions');
  }
  
  // Check adult content
  const hasAdult = ADULT_PATTERNS.some(p => p.test(prompt));
  if (hasAdult) {
    flaggedCategories.push('adult_content');
    severity = 'high';
    suggestions.push('Adult or explicit content is not allowed');
  }
  
  // Check harmful content
  const hasHarmful = HARMFUL_PATTERNS.some(p => p.test(prompt));
  if (hasHarmful) {
    flaggedCategories.push('harmful_content');
    severity = 'high';
    suggestions.push('This content may violate safety policies');
  }
  
  return {
    isSafe: flaggedCategories.length === 0,
    flaggedCategories,
    severity,
    suggestions: [...new Set(suggestions)], // Remove duplicates
  };
}

/**
 * Get display-friendly category names
 */
export function getCategoryDisplayName(category: string): string {
  const names: Record<string, string> = {
    violence: 'Violence',
    creature_violence: 'Creature Violence',
    disaster: 'Destruction/Disaster',
    adult_content: 'Adult Content',
    harmful_content: 'Harmful Content',
  };
  return names[category] || category;
}
