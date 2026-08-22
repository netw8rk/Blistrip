/**
 * Centralized travel images — all URLs verified to load via Unsplash CDN.
 * Use getImageUrl() so width/format params stay consistent.
 */

const PHOTOS = {
  heroParis: "1566902145833-0475c9f1a1bf",
  ctaMountains: "1476514525535-07fb3b4ae5f1",
  prague: "1600623471616-8c1966c91ff6",
  budapest: "1548013146-72479768bada",
  krakow: "1516550893923-42d28e5677af",
  vienna: "1516550893923-42d28e5677af",
  paris: "1502602898657-3e91760cbb34",
  barcelona: "1583422409516-2895a77efded",
  lisbon: "1570077188670-e3a8d69ac5ff",
  rome: "1552832230-c0197dd311b5",
  amsterdam: "1539037116277-4db20889f2d4",
  porto: "1524231757912-21f4fe3a7200",
  europeStreet: "1499856871958-5b9627545d1a",
  travelFlatlay: "1488646953014-85cb44e25828",
  travelersPlanning: "1586022045076-aee0a185180b",
  travelersExploring: "1501785888041-af3ef285b470",
  travelersEnjoying: "1506012787146-f92b2d7d6d96",
} as const;

export function getImageUrl(photoId: string, width = 800): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=90&dpr=2`;
}

export const images = {
  hero: getImageUrl(PHOTOS.heroParis, 1400),
  cta: getImageUrl(PHOTOS.ctaMountains, 1200),
  travelFlatlay: getImageUrl(PHOTOS.travelFlatlay, 600),
  howItWorks: {
    plan: getImageUrl(PHOTOS.travelersPlanning, 900),
    personalize: getImageUrl(PHOTOS.travelersExploring, 900),
    book: getImageUrl(PHOTOS.travelersEnjoying, 900),
  },
} as const;

const destinationPhotoMap: Record<string, string> = {
  prague: PHOTOS.prague,
  budapest: PHOTOS.budapest,
  krakow: PHOTOS.krakow,
  krakw: PHOTOS.krakow,
  vienna: PHOTOS.vienna,
  paris: PHOTOS.paris,
  barcelona: PHOTOS.barcelona,
  lisbon: PHOTOS.lisbon,
  rome: PHOTOS.rome,
  amsterdam: PHOTOS.amsterdam,
  porto: PHOTOS.porto,
};

export function getDestinationImage(destination: string, width = 800): string {
  const key = destination.toLowerCase().replace(/[^a-z]/g, "");
  const photoId = destinationPhotoMap[key] ?? PHOTOS.europeStreet;
  return getImageUrl(photoId, width);
}

export function getHeroDestinationImage(destination: string): string {
  return getDestinationImage(destination, 2400);
}

const PLACE_FALLBACK_PHOTOS = [
  PHOTOS.europeStreet,
  PHOTOS.travelersExploring,
  PHOTOS.travelersEnjoying,
  PHOTOS.ctaMountains,
  PHOTOS.travelersPlanning,
  "1469854523086-cc02fe5d8800",
  "1551882547-ff40c63ea4d4",
  "1414235077428-338989a2e8c0",
  "1517248135467-4c7edcad34c4",
  "1441974231531-c6227db76b6e",
  "1507525428034-b723cf961d3e",
  "1515542622106-78bda8ba0e5b",
  "1466978913421-dad2ebb25d34",
  "1523906834658-6e24cd238f8b",
] as const;

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Distinct stock photo per place so unknown cities don't reuse one image on every card. */
export function getPlaceFallbackImage(placeName: string, destination?: string, width = 800): string {
  const seed = `${placeName.trim().toLowerCase()}|${(destination ?? "").trim().toLowerCase()}`;
  const photoId = PLACE_FALLBACK_PHOTOS[hashSeed(seed) % PLACE_FALLBACK_PHOTOS.length];
  return getImageUrl(photoId, width);
}

export const popularDestinations = [
  { name: "Prague", country: "Czech Republic", photoId: PHOTOS.prague },
  { name: "Budapest", country: "Hungary", photoId: PHOTOS.budapest },
  { name: "Paris", country: "France", photoId: PHOTOS.paris },
  { name: "Barcelona", country: "Spain", photoId: PHOTOS.barcelona },
  { name: "Rome", country: "Italy", photoId: PHOTOS.rome },
] as const;

export function getPopularDestinationImage(photoId: string, width = 400): string {
  return getImageUrl(photoId, width);
}
