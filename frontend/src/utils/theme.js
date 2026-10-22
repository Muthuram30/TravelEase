// ============================================================
// TravelEase Destination-Aware Adaptive Theme Engine
// ============================================================

export const THEMES = {
  MONSOON_FOREST: 'monsoon-forest',
  COASTAL_SEA: 'coastal-sea',
  COASTAL_SUNSET: 'coastal-sunset',
  ALPINE_SNOW: 'alpine-snow',
  NEUTRAL_FALLBACK: 'neutral-fallback',
  // User-selectable themes
  DEFAULT: 'default',
  KERALA_GREEN: 'kerala-green'
};

export const THEME_LABELS = {
  [THEMES.MONSOON_FOREST]: 'Monsoon & Forest (Kerala)',
  [THEMES.COASTAL_SEA]: 'Coastal & Marine (Goa / Coast)',
  [THEMES.COASTAL_SUNSET]: 'Coastal Sunset (Evening)',
  [THEMES.ALPINE_SNOW]: 'Alpine & Snow (Himalayas)',
  [THEMES.NEUTRAL_FALLBACK]: 'Classic Editorial (Neutral)',
  [THEMES.DEFAULT]: 'Ocean Blue (Default)',
  [THEMES.KERALA_GREEN]: 'Kerala Green (Nature)'
};

/**
 * Resolves theme variant using deliberate priority rules:
 * Rule 1: Snow, glacier, alpine winter, or snow mountain -> alpine-snow
 * Rule 2: Kerala beach-specific trip -> coastal-sea; Kerala nature/backwaters/hills -> monsoon-forest
 * Rule 3: Explicit beach / coastal / island / marine -> coastal-sea (or coastal-sunset if mood selected)
 * Rule 4: Explicit destination theme_variant matching known themes
 * Rule 5: Fallback to neutral-fallback
 */
export function resolveDestinationTheme(destinationOrPackage = {}, preferredMood = null) {
  if (!destinationOrPackage) return THEMES.NEUTRAL_FALLBACK;

  const dest = destinationOrPackage.destination || destinationOrPackage;
  const envCat = (dest.environment_category || dest.environment || '').toLowerCase();
  const themeVar = (dest.theme_variant || '').toLowerCase();
  const name = (dest.name || dest.destination || '').toLowerCase();
  const region = (dest.region || dest.state || '').toLowerCase();
  const tags = Array.isArray(destinationOrPackage.tags)
    ? destinationOrPackage.tags.map(t => (t.tag_slug || t.tag_name || '').toLowerCase())
    : [];

  // Rule 1: Snow / glacier / alpine / mountain
  if (
    envCat.includes('snow') ||
    envCat.includes('alpine') ||
    themeVar.includes('ice') ||
    tags.some(t => t.includes('snow') || t.includes('ski') || t.includes('alpine')) ||
    name.includes('gulmarg') ||
    name.includes('ladakh') ||
    name.includes('manali') ||
    name.includes('spiti')
  ) {
    return THEMES.ALPINE_SNOW;
  }

  // Rule 2 & 4: Kerala resolution (Beach vs Backwaters/Forest)
  const isKerala = region.includes('kerala') || name.includes('kerala') || name.includes('alleppey') || name.includes('munnar') || name.includes('kochi') || name.includes('kovalam') || name.includes('varkala');
  const isBeachOrCoast = envCat.includes('beach') || envCat.includes('coast') || themeVar.includes('ocean') || tags.some(t => t.includes('beach') || t.includes('coastal')) || name.includes('kovalam') || name.includes('varkala') || name.includes('goa') || name.includes('andaman');

  if (isKerala && isBeachOrCoast) {
    return preferredMood === 'sunset' ? THEMES.COASTAL_SUNSET : THEMES.COASTAL_SEA;
  }

  if (
    isKerala ||
    envCat.includes('backwater') ||
    envCat.includes('forest') ||
    themeVar.includes('monsoon') ||
    tags.some(t => t.includes('backwater') || t.includes('ayurveda') || t.includes('forest'))
  ) {
    return THEMES.MONSOON_FOREST;
  }

  // Rule 3: Explicit coastal/marine
  if (isBeachOrCoast) {
    return preferredMood === 'sunset' ? THEMES.COASTAL_SUNSET : THEMES.COASTAL_SEA;
  }

  // Rule 4: Check explicit database theme_variant mapping
  if (themeVar === 'monsoon_green' || themeVar === 'monsoon-forest') return THEMES.MONSOON_FOREST;
  if (themeVar === 'ocean_blue' || themeVar === 'coastal-sea') return THEMES.COASTAL_SEA;
  if (themeVar === 'sunset_orange' || themeVar === 'coastal-sunset') return THEMES.COASTAL_SUNSET;
  if (themeVar === 'ice_blue' || themeVar === 'alpine-snow') return THEMES.ALPINE_SNOW;

  // Rule 5: Neutral fallback
  return THEMES.NEUTRAL_FALLBACK;
}

/**
 * Apply theme to document element
 */
export function applyTheme(themeName) {
  if (typeof document === 'undefined') return;
  const validTheme = Object.values(THEMES).includes(themeName) ? themeName : THEMES.NEUTRAL_FALLBACK;
  document.documentElement.setAttribute('data-theme', validTheme);
  document.body.setAttribute('data-theme', validTheme);
}
