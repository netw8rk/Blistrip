import type { PlaceType } from "@/lib/travel/types";
import { diningSearchPhrase, type PreferenceScores, type UserTripPreferences } from "./preferences";
import type { TripProfile } from "./trip-profile";

export interface SearchRequirement {
  id: string;
  category: string;
  query: string;
  placeType?: PlaceType;
  priority: number;
  slot: "morning" | "afternoon" | "evening" | "any";
  minRating?: number;
}

type SearchableProfile = Pick<UserTripPreferences, "destination" | "scores" | "budgetLevel"> & {
  country?: string;
  state?: string;
  dietary?: string[];
  cuisineHints?: string[];
  interests?: string[];
  selectedInterests?: string[];
};

const DAYTIME_QUERY_IDS = [
  "museums",
  "historic",
  "architecture",
  "parks",
  "viewpoints",
  "beaches",
  "shopping",
  "adventure",
  "food-halls",
  "culture-arts",
  "relaxation",
  "local",
  "sports",
];

export function buildSearchRequirements(profile: SearchableProfile | TripProfile): SearchRequirement[] {
  const place = [profile.destination, profile.state, profile.country].filter(Boolean).join(", ");
  const s: PreferenceScores = profile.scores;
  const dietary = "dietary" in profile ? profile.dietary ?? [] : [];
  const cuisineHints =
    "prefs" in profile ? profile.prefs.cuisineHints : profile.cuisineHints ?? [];
  const restaurantQuery = diningSearchPhrase({ dietary, cuisineHints });
  const requirements: SearchRequirement[] = [];

  const add = (
    id: string,
    category: string,
    query: string,
    score: number,
    placeType: PlaceType | undefined,
    slot: SearchRequirement["slot"]
  ) => {
    if (score < 6) return;
    requirements.push({
      id,
      category,
      query: `${query} in ${place}`,
      placeType,
      priority: Math.round(score),
      slot,
    });
  };

  add("restaurants", "restaurant", restaurantQuery, s.food, "restaurant", "evening");
  add("cafes", "cafe", "cafes coffee", Math.max(s.food, s.relaxation), "cafe", "afternoon");
  add("food-halls", "restaurant", "food halls", Math.max(s.food, s.localExperiences), "restaurant", "morning");
  add("nightlife", "nightlife", "bars nightlife", s.nightlife, "bar", "evening");
  add("museums", "museum", "museums", Math.max(s.culture, s.history), "museum", "morning");
  add("historic", "historic_landmark", "historic landmarks", Math.max(s.history, s.architecture), "landmark", "morning");
  add("architecture", "architecture", "architecture landmarks churches", s.architecture, "landmark", "afternoon");
  add("parks", "park", "parks gardens", Math.max(s.nature, s.relaxation), "park", "afternoon");
  add("viewpoints", "viewpoint", "viewpoints scenic overlooks", Math.max(s.nature, s.adventure), "attraction", "morning");
  add("beaches", "beach", "beaches waterfront", s.beaches, "park", "afternoon");
  add("shopping", "shop", "shopping boutiques malls", s.shopping, "shop", "afternoon");
  add("adventure", "activity", "hiking trails outdoor adventures", s.adventure, "activity", "afternoon");
  add("culture-arts", "museum", "art galleries theaters live music", s.culture, "museum", "afternoon");
  add("relaxation", "park", "spas wellness gardens", s.relaxation, "park", "afternoon");
  add("local", "attraction", "local neighborhoods hidden gems", s.localExperiences, "attraction", "afternoon");

  const interestList = (
    "interests" in profile ? profile.interests : profile.selectedInterests ?? []
  ).map((item) => item.toLowerCase());
  if (interestList.includes("sports") || s.adventure >= 8) {
    add("sports", "activity", "stadiums sports venues", Math.max(s.adventure, 8), "activity", "afternoon");
  }
  if (s.nightlife >= 7) {
    add("live-music", "nightlife", "live music venues", s.nightlife, "bar", "evening");
  }

  if (s.localExperiences >= 7 && !requirements.some((item) => item.id === "nightlife")) {
    requirements.push({
      id: "local-pubs",
      category: "local",
      query: `local neighborhood pubs in ${place}`,
      placeType: "bar",
      priority: 7,
      slot: "evening",
    });
  }

  const hasDaytimeInterest = requirements.some((item) => DAYTIME_QUERY_IDS.includes(item.id));
  if (!hasDaytimeInterest && s.food < 6) {
    requirements.push({
      id: "attractions",
      category: "attraction",
      query: `attractions in ${place}`,
      placeType: "attraction",
      priority: 4,
      slot: "morning",
    });
  }

  requirements.push({
    id: "hotels",
    category: "hotel",
    query: `${profile.budgetLevel === "low" ? "hostels guesthouses" : "hotels"} in ${place}`,
    placeType: "hotel",
    priority: 5,
    slot: "any",
  });

  const ranked = [...requirements].sort((a, b) => b.priority - a.priority);
  const kept: SearchRequirement[] = [];
  for (const item of ranked) {
    if (item.id === "hotels" || kept.filter((entry) => entry.id !== "hotels").length < 10) {
      kept.push(item);
    }
  }
  return kept.sort((a, b) => b.priority - a.priority);
}

export function buildTopRatedCatalogRequirements(
  profile: SearchableProfile | TripProfile
): SearchRequirement[] {
  const place = [profile.destination, profile.state, profile.country].filter(Boolean).join(", ");
  const catalogs: Array<[string, string, string, PlaceType]> = [
    ["catalog-restaurants", "restaurant", "top rated restaurants", "restaurant"],
    ["catalog-bars", "bar", "top rated bars", "bar"],
    ["catalog-cafes", "cafe", "top rated cafes", "cafe"],
    ["catalog-parks", "park", "top rated parks", "park"],
    ["catalog-attractions", "attraction", "top rated attractions", "attraction"],
  ];

  return catalogs.map(([id, category, query, placeType]) => ({
    id,
    category,
    query: `${query} in ${place}`,
    placeType,
    priority: 3,
    slot: "any" as const,
    minRating: 4.2,
  }));
}

export function formatSearchRequirementsLog(requirements: SearchRequirement[]): string {
  return [
    "SEARCH REQUIREMENTS",
    ...requirements.map(
      (item) => `  → ${item.id} [${item.category}] priority ${item.priority} · ${item.query}`
    ),
  ].join("\n");
}
