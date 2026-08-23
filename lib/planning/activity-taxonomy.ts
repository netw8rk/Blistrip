import type { NormalizedPlace, PlaceType } from "@/lib/travel/types";

export type InterestCategory =
  | "culture"
  | "food"
  | "entertainment"
  | "outdoor"
  | "exploration"
  | "experience";

export type ActivityKind =
  | "museum"
  | "gallery"
  | "historical_site"
  | "architecture"
  | "landmark"
  | "neighborhood"
  | "cafe"
  | "bakery"
  | "restaurant"
  | "food_market"
  | "tasting"
  | "bar"
  | "nightclub"
  | "live_music"
  | "theater"
  | "park"
  | "viewpoint"
  | "hiking"
  | "waterfront"
  | "shopping"
  | "market"
  | "tour"
  | "adventure"
  | "other";

export interface PlaceTaxonomy {
  primaryKind: ActivityKind;
  secondaryKinds: ActivityKind[];
  interestCategory: InterestCategory;
  tags: string[];
}

const TYPE_KIND: Partial<Record<PlaceType, ActivityKind>> = {
  restaurant: "restaurant",
  cafe: "cafe",
  bar: "bar",
  nightclub: "nightclub",
  museum: "museum",
  landmark: "landmark",
  church: "architecture",
  park: "park",
  attraction: "landmark",
  shop: "shopping",
  market: "food_market",
  activity: "adventure",
  tour: "tour",
  experience: "neighborhood",
};

const KIND_INTEREST: Record<ActivityKind, InterestCategory> = {
  museum: "culture",
  gallery: "culture",
  historical_site: "culture",
  architecture: "culture",
  landmark: "culture",
  neighborhood: "exploration",
  cafe: "food",
  bakery: "food",
  restaurant: "food",
  food_market: "food",
  tasting: "food",
  bar: "entertainment",
  nightclub: "entertainment",
  live_music: "entertainment",
  theater: "entertainment",
  park: "outdoor",
  viewpoint: "outdoor",
  hiking: "outdoor",
  waterfront: "outdoor",
  shopping: "exploration",
  market: "exploration",
  tour: "experience",
  adventure: "experience",
  other: "exploration",
};

const GOOGLE_KIND: Record<string, ActivityKind> = {
  bakery: "bakery",
  art_gallery: "gallery",
  performing_arts_theater: "theater",
  concert_hall: "live_music",
  night_club: "nightclub",
  historical_landmark: "historical_site",
  church: "architecture",
  cathedral: "architecture",
  hiking_area: "hiking",
  national_park: "park",
  marina: "waterfront",
  market: "food_market",
  grocery_store: "food_market",
  winery: "tasting",
  brewery: "tasting",
};

export function interestForKind(kind: ActivityKind): InterestCategory {
  return KIND_INTEREST[kind];
}

export function classifyPlace(place: {
  name?: string;
  type?: PlaceType | string;
  category?: string;
  googleTypes?: string[];
  tags?: string[];
}): PlaceTaxonomy {
  const googleTypes = place.googleTypes ?? [];
  const haystack = `${place.name ?? ""} ${place.category ?? ""} ${googleTypes.join(" ")}`.toLowerCase();
  const secondary = new Set<ActivityKind>();

  let primary: ActivityKind | undefined;
  for (const googleType of googleTypes) {
    const kind = GOOGLE_KIND[googleType];
    if (kind) {
      if (!primary) primary = kind;
      else secondary.add(kind);
    }
  }

  if (!primary) primary = TYPE_KIND[(place.type as PlaceType) || "other"] ?? "other";

  if (/\b(bakery|patisserie|pastry|boulangerie)\b/.test(haystack)) {
    primary = place.type === "cafe" || primary === "cafe" || primary === "bakery" ? "bakery" : primary;
    secondary.add("bakery");
  }
  if (/\b(viewpoint|overlook|lookout|panorama|observation)\b/.test(haystack)) {
    if (place.type === "park" || place.type === "attraction" || place.type === "landmark") primary = "viewpoint";
    secondary.add("viewpoint");
  }
  if (/\b(waterfront|harbor|harbour|promenade|riverfront|embankment)\b/.test(haystack)) {
    secondary.add("waterfront");
  }
  if (/\b(live music|jazz|concert)\b/.test(haystack) && (place.type === "bar" || place.type === "nightclub")) {
    primary = "live_music";
  }
  if (/\b(food hall|food market|market)\b/.test(haystack) && place.type !== "shop") {
    if (place.type === "market" || place.type === "attraction") primary = "food_market";
    secondary.add("food_market");
  }

  if (primary !== "other") secondary.delete(primary);

  return {
    primaryKind: primary,
    secondaryKinds: [...secondary],
    interestCategory: KIND_INTEREST[primary],
    tags: place.tags ?? [],
  };
}

export function foodExpressionKinds(): ActivityKind[] {
  return ["bakery", "cafe", "food_market", "restaurant", "tasting"];
}

export function cultureExpressionKinds(): ActivityKind[] {
  return ["historical_site", "architecture", "landmark", "museum", "gallery"];
}

export function entertainmentExpressionKinds(): ActivityKind[] {
  return ["bar", "live_music", "nightclub", "theater"];
}
