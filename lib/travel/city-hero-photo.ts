import type { NormalizedPlace, PlaceType } from "./types";

const REJECT_TYPES = new Set<PlaceType | string>([
  "restaurant",
  "cafe",
  "bar",
  "nightclub",
  "hotel",
  "hostel",
  "apartment",
  "museum",
  "shop",
  "market",
  "activity",
  "tour",
]);

const REJECT_GOOGLE_TYPES = new Set([
  "restaurant",
  "cafe",
  "bar",
  "night_club",
  "hotel",
  "lodging",
  "museum",
  "art_gallery",
  "shopping_mall",
  "store",
  "bakery",
  "meal_takeaway",
  "meal_delivery",
  "food",
  "supermarket",
  "spa",
  "zoo",
  "aquarium",
  "amusement_park",
  "stadium",
]);

const REJECT_NAME =
  /\b(restaurant|ristorante|trattoria|cafe|café|coffee|bistro|bar|pub|club|hotel|hostel|museum|gallery|spa|kitchen|pizzeria|sushi|steakhouse|brewery|winery|bakery|diner)\b/i;

const CITYSCAPE_NAME =
  /\b(skyline|cityscape|downtown|old town|old city|main square|town square|plaza|piazza|platz|boulevard|promenade|waterfront|harbor|harbour|bridge|tower|castle|cathedral|basilica|city hall|observation|lookout|viewpoint|overlook|panorama|street|avenue|quartier|district|centro|centro historico|historic center|historic centre)\b/i;

const PARK_CITY_VIEW =
  /\b(viewpoint|overlook|lookout|promenade|waterfront|skyline|square|plaza|piazza)\b/i;

export function cityHeroQueries(destinationLabel: string): string[] {
  const place = destinationLabel.trim();
  const key = place.toLowerCase().replace(/[^a-z]/g, "");
  if (key === "prague" || key === "praha") {
    return [
      "Charles Bridge Prague",
      "Prague Castle Vltava river view",
      "Prague Old Town Square skyline",
    ];
  }
  return [`${place} skyline`, `${place} cityscape downtown`, `${place} old town streets`];
}

export function isCityscapePlace(place: {
  name: string;
  type: PlaceType | string;
  category?: string;
  googleTypes?: string[];
}): boolean {
  if (!place.name) return false;
  if (REJECT_TYPES.has(place.type)) return false;
  if (place.googleTypes?.some((type) => REJECT_GOOGLE_TYPES.has(type))) return false;
  if (REJECT_NAME.test(place.name)) return false;

  if (place.type === "park") return PARK_CITY_VIEW.test(place.name);

  const haystack = `${place.name} ${place.category ?? ""} ${(place.googleTypes ?? []).join(" ")}`;
  if (CITYSCAPE_NAME.test(haystack)) return true;
  if (place.type === "landmark" || place.type === "church") return true;

  return false;
}

const PRAGUE_LANDMARK =
  /\b(charles bridge|karl[uů]v most|prague castle|pražský hrad|old town square|starom[eě]stsk[eé] n[aá]m[eě]st[ií]|st\.?\s*vitus|mal[aá]\s*strana)\b/i;

export function scoreCityscapePlace(place: NormalizedPlace): number {
  let score = place.rating ?? 0;
  const name = place.name;
  if (PRAGUE_LANDMARK.test(name)) score += 28;
  if (/\b(skyline|cityscape)\b/i.test(name)) score += 24;
  if (/\b(downtown|old town|old city)\b/i.test(name)) score += 12;
  if (/\b(square|plaza|piazza|platz|bridge|street|boulevard)\b/i.test(name)) score += 8;
  if (place.type === "landmark") score += 8;
  if (place.type === "church") score += 4;
  return score;
}

export function pickCityHeroPhoto(places: NormalizedPlace[]): string | undefined {
  const scored = places
    .filter((place) => place.photoUrls?.[0] && isCityscapePlace(place))
    .sort((a, b) => scoreCityscapePlace(b) - scoreCityscapePlace(a));
  return scored[0]?.photoUrls?.[0];
}
