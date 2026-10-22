// ============================================================
// Central destination image resolver — TravelEase
// Single source of truth for locally bundled artwork used by
// Home.jsx, Explore.jsx and PackageCard.jsx.
// Assets generated/converted by tools/generate_interest_images.ps1
// and the user-supplied 10 editorial destination images
// (converted to WebP in src/assets/destinations/).
// ============================================================

// 10 editorial destination assets (WebP)
import heroKerala from '../assets/destinations/hero-kerala-backwaters.webp';
import exploreHero from '../assets/destinations/explore-himalayan-hero.webp';
import keralaBackwaters from '../assets/destinations/kerala-backwaters.webp';
import munnarTea from '../assets/destinations/munnar-tea-estates.webp';
import goaSunset from '../assets/destinations/goa-coast-sunset.webp';
import andamanBeach from '../assets/destinations/andaman-radhanagar-beach.webp';
import kashmirDalLake from '../assets/destinations/kashmir-dal-lake.webp';
import manaliSnow from '../assets/destinations/manali-solang-valley.webp';
import jaipurPalace from '../assets/destinations/jaipur-heritage-palace.webp';
import jaisalmerDesert from '../assets/destinations/jaisalmer-golden-desert.webp';

// Interest artwork (from tools/generate_interest_images.ps1)
import adventureImg from '../assets/interests/adventure.jpg';
import backwatersImg from '../assets/interests/backwaters.jpg';
import beachImg from '../assets/interests/beach.jpg';
import foodImg from '../assets/interests/food.jpg';
import heritageImg from '../assets/interests/heritage.jpg';
import hillStationImg from '../assets/interests/hill-station.jpg';
import natureImg from '../assets/interests/nature.jpg';
import nightlifeImg from '../assets/interests/nightlife.jpg';
import photographyImg from '../assets/interests/photography.jpg';
import shoppingImg from '../assets/interests/shopping.jpg';
import spiritualImg from '../assets/interests/spiritual.jpg';
import wellnessImg from '../assets/interests/wellness.jpg';

export const HERO_ASSETS = {
  homeHero: heroKerala,
  exploreHero: exploreHero,
};

export const INTEREST_IMAGES = {
  adventure: adventureImg,
  backwaters: backwatersImg,
  beach: beachImg,
  food: foodImg,
  heritage: heritageImg,
  'hill-station': hillStationImg,
  nature: natureImg,
  nightlife: nightlifeImg,
  photography: photographyImg,
  shopping: shoppingImg,
  spiritual: spiritualImg,
  wellness: wellnessImg,
};

export const DESTINATION_IMAGE_MAP = {
  // Kerala belt
  kerala: keralaBackwaters,
  alleppey: keralaBackwaters,
  alappuzha: keralaBackwaters,
  kumarakom: keralaBackwaters,
  kovalam: keralaBackwaters,
  // Tea hills / forest
  munnar: munnarTea,
  wayanad: munnarTea,
  ooty: munnarTea,
  coorg: munnarTea,
  kodagu: munnarTea,
  darjeeling: munnarTea,
  // Coastal
  goa: goaSunset,
  pondicherry: goaSunset,
  gokarna: goaSunset,
  andaman: andamanBeach,
  lakshadweep: andamanBeach,
  // Snowy
  kashmir: kashmirDalLake,
  srinagar: kashmirDalLake,
  gulmarg: kashmirDalLake,
  pahalgam: kashmirDalLake,
  manali: manaliSnow,
  shimla: manaliSnow,
  himachal: manaliSnow,
  ladakh: manaliSnow,
  leh: manaliSnow,
  sikkim: manaliSnow,
  gangtok: manaliSnow,
  // Desert / heritage
  jaipur: jaipurPalace,
  udaipur: jaipurPalace,
  rajasthan: jaipurPalace,
  jodhpur: jaipurPalace,
  jaisalmer: jaisalmerDesert,
  pushkar: jaisalmerDesert,
  delhi: heritageImg,
  agra: heritageImg,
  hampi: heritageImg,
  mysore: heritageImg,
  // Other
  varanasi: spiritualImg,
  rishikesh: adventureImg,
  haridwar: spiritualImg,
  mumbai: nightlifeImg,
  bangalore: natureImg,
};

// Rotation pool so unknown destinations don't repeat one generic image
const FALLBACK_ROTATION = [
  keralaBackwaters,
  jaipurPalace,
  goaSunset,
  kashmirDalLake,
  munnarTea,
  manaliSnow,
  andamanBeach,
  jaisalmerDesert,
  natureImg,
  heritageImg,
  hillStationImg,
];

/** Deterministic hash → consistent, varied image per destination name. */
function getDeterministicFallback(seedString = '') {
  let hash = 0;
  const s = String(seedString);
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) % FALLBACK_ROTATION.length;
  }
  return FALLBACK_ROTATION[Math.abs(hash) % FALLBACK_ROTATION.length];
}

/**
 * Resolves destination artwork by name, state, or category/theme.
 */
export function getDestinationImage(nameOrLocation = '', category = '') {
  const normalized = String(nameOrLocation).toLowerCase().trim();
  const normCategory = String(category).toLowerCase().trim();

  // 1. Direct / partial keyword match in DESTINATION_IMAGE_MAP
  for (const [key, imgPath] of Object.entries(DESTINATION_IMAGE_MAP)) {
    if (normalized.includes(key)) {
      return imgPath;
    }
  }

  // 2. Match by category/interest
  for (const [interestKey, imgPath] of Object.entries(INTEREST_IMAGES)) {
    if (normCategory.includes(interestKey) || normalized.includes(interestKey)) {
      return imgPath;
    }
  }

  // 3. Keyword heuristics
  const hay = normalized + ' ' + normCategory;
  if (/beach|island|islands|coast|sea|lagoon/.test(hay)) return andamanBeach;
  if (/backwater|houseboat|house boat/.test(hay)) return keralaBackwaters;
  if (/snow|himalaya|peak|trek|mountain|valley/.test(hay)) return manaliSnow;
  if (/fort|palace|desert|royal|mahal/.test(hay)) return jaipurPalace;
  if (/tea|hill|mist|forest|wildlife/.test(hay)) return munnarTea;
  if (/temple|ghat|ashram|spiritual/.test(hay)) return spiritualImg;

  // 4. Deterministic varied fallback
  return getDeterministicFallback(normalized || normCategory || 'travelease');
}

/**
 * Resolves package card image.
 * API-supplied pkg.images[0].image_url ALWAYS wins; local artwork is fallback.
 */
export function resolvePackageImage(pkg, backendBaseUrl = '') {
  const apiImageUrl = pkg?.images?.[0]?.image_url || pkg?.cover_image_url || pkg?.image_url;

  if (apiImageUrl && typeof apiImageUrl === 'string' && apiImageUrl.trim() !== '') {
    // Relative backend path (e.g. "uploads/x.jpg") → prefix base if provided
    if (!apiImageUrl.startsWith('http') && !apiImageUrl.startsWith('/') && !apiImageUrl.startsWith('data:')) {
      return backendBaseUrl ? `${backendBaseUrl.replace(/\/$/, '')}/${apiImageUrl}` : `/${apiImageUrl}`;
    }
    return apiImageUrl;
  }

  return getDestinationImage(
    (typeof pkg?.destination === 'object' ? pkg?.destination?.name : pkg?.destination) ||
      pkg?.location || pkg?.title || pkg?.name || '',
    pkg?.category || pkg?.package_type || pkg?.theme || ''
  );
}
