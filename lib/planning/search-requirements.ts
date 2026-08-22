import type { PlaceType } from "@/lib/travel/types";
import type { PreferenceScores, UserTripPreferences } from "./preferences";
import type { TripProfile } from "./trip-profile";

export interface SearchRequirement {
  id: string;
  category: string;
  query: string;
  placeType?: PlaceType;
  priority: number;
  slot: "morning" | "afternoon" | "evening" | "any";
}

type SearchableProfile = Pick<UserTripPreferences, "destination" | "scores" | "budgetLevel"> & {
  country?: string;
  state?: string;
};

export function buildSearchRequirements(profile: SearchableProfile | TripProfile): SearchRequirement[] {
  const place = [profile.destination, profile.state, profile.country].filter(Boolean).join(", ");
  const s: PreferenceScores = profile.scores;
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

  add("restaurants", "restaurant", "restaurants", s.food, "restaurant", "evening");
  add("cafes", "cafe", "cafes coffee", Math.max(s.food, s.relaxation), "cafe", "afternoon");
  add("markets", "market", "food markets", Math.max(s.food, s.localExperiences), "market", "morning");
  add("nightlife", "nightlife", "bars nightlife", s.nightlife, "bar", "evening");
  add("museums", "museum", "museums", Math.max(s.culture, s.history), "museum", "morning");
  add("historic", "historic_landmark", "historic landmarks", Math.max(s.history, s.architecture), "landmark", "morning");
  add("architecture", "architecture", "architecture landmarks churches", s.architecture, "landmark", "afternoon");
  add("parks", "park", "parks gardens", Math.max(s.nature, s.relaxation), "park", "afternoon");
  add("viewpoints", "viewpoint", "viewpoints scenic overlooks", Math.max(s.nature, s.adventure), "attraction", "morning");
  add("beaches", "beach", "beaches waterfront", s.beaches, "park", "afternoon");
  add("shopping", "shop", "shopping boutiques markets", s.shopping, "shop", "afternoon");
  add("adventure", "activity", "outdoor activities", s.adventure, "activity", "afternoon");

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

  if (requirements.length === 0) {
    requirements.push({
      id: "attractions",
      category: "attraction",
      query: `attractions in ${place}`,
      placeType: "attraction",
      priority: 7,
      slot: "morning",
    });
  }

  requirements.push({
    id: "hotels",
    category: "hotel",
    query: `${profile.budgetLevel === "low" ? "hostels guesthouses" : "hotels"} in ${place}`,
    placeType: "hotel",
    priority: 6,
    slot: "any",
  });

  return requirements
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 7);
}

export function formatSearchRequirementsLog(requirements: SearchRequirement[]): string {
  return [
    "SEARCH REQUIREMENTS",
    ...requirements.map(
      (item) => `  → ${item.id} [${item.category}] priority ${item.priority} · ${item.query}`
    ),
  ].join("\n");
}
