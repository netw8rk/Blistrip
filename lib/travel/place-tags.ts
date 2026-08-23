import type { NormalizedPlace, PlaceType } from "./types";

const TYPE_TAGS: Partial<Record<PlaceType, string[]>> = {
  restaurant: ["foodFocused", "casual"],
  cafe: ["foodFocused", "casual", "quiet"],
  bar: ["nightlife", "social"],
  nightclub: ["nightlife", "nightlifeFocused", "social"],
  museum: ["cultural", "historic"],
  landmark: ["historic", "architectural", "scenic"],
  church: ["historic", "architectural"],
  park: ["outdoor", "scenic"],
  attraction: ["popular"],
  shop: ["popular"],
  market: ["local", "foodFocused"],
  activity: ["outdoor"],
};

const GOOGLE_TYPE_TAGS: Record<string, string[]> = {
  tourist_attraction: ["popular", "touristy"],
  art_gallery: ["cultural"],
  performing_arts_theater: ["cultural"],
  night_club: ["nightlife", "nightlifeFocused"],
  park: ["outdoor"],
  hiking_area: ["outdoor", "scenic"],
  spa: ["quiet"],
  stadium: ["groupFriendly"],
};

export function deriveProviderTags(place: Pick<NormalizedPlace, "type" | "googleTypes" | "reviewCount" | "priceLevel">): string[] {
  const tags = new Set<string>(TYPE_TAGS[place.type] ?? []);
  for (const googleType of place.googleTypes ?? []) {
    for (const tag of GOOGLE_TYPE_TAGS[googleType] ?? []) tags.add(tag);
  }
  if ((place.reviewCount ?? 0) >= 4000) tags.add("popular");
  if ((place.reviewCount ?? 0) > 0 && (place.reviewCount ?? 0) < 200) tags.add("hiddenGem");
  if (place.priceLevel != null && place.priceLevel <= 1) tags.add("budgetFriendly");
  if (place.priceLevel != null && place.priceLevel >= 3) tags.add("upscale");
  return [...tags];
}
