import type { TripPlannerInput } from "@/types/trip";
import { nightlyStayLabel, nightlyToPrefLevel, parseNightlyBudget } from "./nightly-budget";
import { parseRegionFromLabel } from "./confirmed-destination";
import { slotBudgets } from "./slot-fit";

export type PreferenceScore = number;

export interface PreferenceScores {
  nightlife: PreferenceScore;
  food: PreferenceScore;
  history: PreferenceScore;
  architecture: PreferenceScore;
  culture: PreferenceScore;
  nature: PreferenceScore;
  adventure: PreferenceScore;
  shopping: PreferenceScore;
  beaches: PreferenceScore;
  relaxation: PreferenceScore;
  localExperiences: PreferenceScore;
}

export interface UserTripPreferences {
  destination: string;
  country?: string;
  destinationLabel?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  dates?: { start: string; end: string };
  tripLength: number;
  flexibleDates: boolean;
  budgetLevel: "low" | "moderate" | "high";
  budgetLabel: string;
  budgetAmount: number;
  travelers: string;
  travelStyle: string;
  pace: "slow" | "balanced" | "packed";
  walkingTolerance: "low" | "medium" | "high";
  localVsTouristy: "local" | "mixed" | "touristy";
  scores: PreferenceScores;
  selectedInterests: string[];
  dislikes: string[];
  dietary: string[];
  cuisineHints: string[];
  notes?: string;
}

const INTEREST_TO_SCORE: Record<string, keyof PreferenceScores> = {
  nightlife: "nightlife",
  history: "history",
  food: "food",
  culture: "culture",
  nature: "nature",
  beaches: "beaches",
  adventure: "adventure",
  relaxation: "relaxation",
  shopping: "shopping",
  sports: "adventure",
  architecture: "architecture",
  "local experiences": "localExperiences",
};

const PACE_MAP: Record<string, UserTripPreferences["pace"]> = {
  "Slow and relaxed": "slow",
  Balanced: "balanced",
  "Pack everything in": "packed",
};

export function buildUserPreferences(
  input: TripPlannerInput,
  resolved?: {
    destination?: string;
    country?: string;
    tripLength?: number;
    dislikes?: string[];
    latitude?: number;
    longitude?: number;
    label?: string;
  }
): UserTripPreferences {
  const selected = input.interests.map((i) => i.toLowerCase());
  const notes = [input.additionalNotes, input.destinationDescription].filter(Boolean).join(" ");
  const scores = emptyScores();

  for (const interest of selected) {
    const key = INTEREST_TO_SCORE[interest];
    if (key) scores[key] = 9;
  }

  applyNoteSignals(notes, scores, selected);

  const pace = PACE_MAP[input.pace] ?? "balanced";
  const localVsTouristy = deriveLocalPreference(selected, notes, input.travelStyle);
  const walkingTolerance = deriveWalkingTolerance(pace, notes, input.travelStyle);
  const budgetAmount = parseNightlyBudget(input.budget, input.customBudget);
  const budgetLevel = nightlyToPrefLevel(budgetAmount);

  const dietary = parseDietary(notes);
  const cuisineHints = parseCuisineHints(notes, dietary);
  const dislikes = parseDislikes(notes, [...(resolved?.dislikes ?? [])]);
  if (dislikes.includes("museums")) scores.culture = Math.min(scores.culture, 2);
  if (dislikes.includes("nightlife")) scores.nightlife = 1;

  let tripLength = resolved?.tripLength;
  if (!tripLength && input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    tripLength = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (86400000)) + 1);
  }

  return {
    destination: input.destination || resolved?.destination || "",
    country: input.destinationCountry || resolved?.country,
    destinationLabel: input.destinationLabel || resolved?.label,
    state: input.destinationState || parseRegionFromLabel(input.destinationLabel || resolved?.label).state,
    latitude: input.destinationLatitude ?? resolved?.latitude,
    longitude: input.destinationLongitude ?? resolved?.longitude,
    dates:
      input.startDate && input.endDate
        ? { start: input.startDate, end: input.endDate }
        : undefined,
    tripLength: tripLength || 5,
    flexibleDates: input.flexibleDates,
    budgetLevel,
    budgetLabel: nightlyStayLabel(input.budget, input.customBudget),
    budgetAmount,
    travelers: input.travelers,
    travelStyle: input.travelStyle,
    pace,
    walkingTolerance,
    localVsTouristy,
    scores,
    selectedInterests: input.interests,
    dislikes: [...new Set(dislikes)],
    dietary,
    cuisineHints,
    notes: input.additionalNotes,
  };
}

export function diningSearchPhrase(prefs: Pick<UserTripPreferences, "dietary" | "cuisineHints">): string {
  return [prefs.dietary[0], prefs.cuisineHints[0], "restaurants"].filter(Boolean).join(" ");
}

const CUISINE_HINTS = [
  "italian",
  "thai",
  "mexican",
  "japanese",
  "sushi",
  "seafood",
  "chinese",
  "indian",
  "korean",
  "french",
  "spanish",
  "vietnamese",
  "mediterranean",
  "ramen",
  "bbq",
  "pizza",
  "brunch",
  "tapas",
];

export function parseDislikes(notes: string, existing: string[] = []): string[] {
  const found = [...existing];
  if (/\bhate\s+museums?|\bno\s+museums?|\bdon'?t\s+(like|want)\s+museums?/i.test(notes)) found.push("museums");
  if (/\bno\s+nightlife|\bhate\s+nightlife|\bnot\s+into\s+nightlife|\bno\s+clubs?/i.test(notes)) found.push("nightlife");
  if (/\bhate\s+crowds?|\bavoid\s+tourists?|\bno\s+tourist\s+traps?/i.test(notes)) found.push("crowds");
  if (/\bno\s+shopping|\bhate\s+shopping/i.test(notes)) found.push("shopping");
  if (/\bno\s+long\s+walks?|\blimited\s+mobility|\bwheelchair/i.test(notes)) found.push("long walks");
  if (/\btoo\s+expensive|\bno\s+luxury|\bavoid\s+expensive/i.test(notes)) found.push("expensive");
  if (/\bearly\s+mornings?|\bdon'?t\s+want\s+to\s+wake\s+up\s+early/i.test(notes)) found.push("early mornings");
  return [...new Set(found)];
}

export function parseDietary(notes: string): string[] {
  if (!notes) return [];
  const found: string[] = [];
  if (/\bvegan\b/i.test(notes)) found.push("vegan");
  if (/\bvegetarian\b/i.test(notes)) found.push("vegetarian");
  if (/\bgluten[-\s]?free\b/i.test(notes)) found.push("gluten-free");
  if (/\bhalal\b/i.test(notes)) found.push("halal");
  if (/\bkosher\b/i.test(notes)) found.push("kosher");
  return found;
}

export function parseCuisineHints(notes: string, dietary: string[] = []): string[] {
  if (!notes) return [];
  const meatHeavy = new Set(["bbq", "seafood"]);
  return CUISINE_HINTS.filter((hint) => {
    if ((dietary.includes("vegan") || dietary.includes("vegetarian")) && meatHeavy.has(hint)) {
      return false;
    }
    return new RegExp(`\\b${hint}\\b`, "i").test(notes);
  });
}

export function slotTargets(prefs: UserTripPreferences): {
  morning: number;
  afternoon: number;
  evening: number;
} {
  const budgets = slotBudgets(prefs);
  return {
    morning: budgets.morning.max,
    afternoon: budgets.afternoon.max,
    evening: budgets.evening.max,
  };
}

export function activitiesPerDay(prefs: UserTripPreferences): number {
  const slots = slotTargets(prefs);
  return slots.morning + slots.afternoon + slots.evening;
}

export function maxWalkKm(prefs: UserTripPreferences): number {
  if (prefs.walkingTolerance === "low") return 1.2;
  if (prefs.walkingTolerance === "high") return 4;
  return 2.2;
}

export function formatPreferencesLog(prefs: UserTripPreferences): string {
  const lines = [
    "USER PREFERENCES",
    `  destination: ${prefs.destinationLabel || [prefs.destination, prefs.country].filter(Boolean).join(", ")}`,
    prefs.latitude != null && prefs.longitude != null
      ? `  coordinates: ${prefs.latitude.toFixed(4)}, ${prefs.longitude.toFixed(4)}`
      : "",
    `  duration: ${prefs.tripLength} days`,
    `  stay budget: ${prefs.budgetLabel} · ${prefs.budgetLevel}`,
    `  party: ${prefs.travelers}`,
    `  style: ${prefs.travelStyle}`,
    `  pace: ${prefs.pace}`,
    `  walking: ${prefs.walkingTolerance}`,
    `  local vs touristy: ${prefs.localVsTouristy}`,
    `  nightlife: ${prefs.scores.nightlife}/10`,
    `  food: ${prefs.scores.food}/10`,
    `  history: ${prefs.scores.history}/10`,
    `  architecture: ${prefs.scores.architecture}/10`,
    `  culture: ${prefs.scores.culture}/10`,
    `  nature: ${prefs.scores.nature}/10`,
    `  adventure: ${prefs.scores.adventure}/10`,
    `  shopping: ${prefs.scores.shopping}/10`,
    `  local experiences: ${prefs.scores.localExperiences}/10`,
  ];
  if (prefs.dislikes.length) lines.push(`  avoid: ${prefs.dislikes.join(", ")}`);
  if (prefs.dietary.length) lines.push(`  dietary: ${prefs.dietary.join(", ")}`);
  if (prefs.cuisineHints.length) lines.push(`  cuisine: ${prefs.cuisineHints.join(", ")}`);
  return lines.filter(Boolean).join("\n");
}

function emptyScores(): PreferenceScores {
  return {
    nightlife: 2,
    food: 2,
    history: 2,
    architecture: 2,
    culture: 2,
    nature: 2,
    adventure: 2,
    shopping: 2,
    beaches: 2,
    relaxation: 2,
    localExperiences: 2,
  };
}

function applyNoteSignals(notes: string, scores: PreferenceScores, selected: string[]) {
  if (!notes) return;
  if (/\blocal\b|\boff the beaten|\bhidden gem/i.test(notes)) scores.localExperiences = Math.max(scores.localExperiences, 8);
  if (/\bwalk\b|\bwalkable\b/i.test(notes) && !/\bno\s+long\s+walks/i.test(notes)) {
    scores.nature = Math.max(scores.nature, selected.includes("nature") ? scores.nature : 5);
  }
}

function deriveLocalPreference(
  selected: string[],
  notes: string,
  travelStyle: string
): UserTripPreferences["localVsTouristy"] {
  if (selected.includes("local experiences") || /\blocal\b|\bhidden gem|\boff the beaten/i.test(notes)) {
    return "local";
  }
  if (travelStyle === "Backpacker") return "local";
  if (travelStyle === "Luxury") return "touristy";
  return "mixed";
}

function deriveWalkingTolerance(
  pace: UserTripPreferences["pace"],
  notes: string,
  travelStyle: string
): UserTripPreferences["walkingTolerance"] {
  if (/\bno\s+long\s+walks|\blimited\s+mobility|\bwheelchair/i.test(notes)) return "low";
  if (pace === "slow" || travelStyle === "Luxury") return "low";
  if (pace === "packed" || travelStyle === "Backpacker") return "high";
  return "medium";
}
