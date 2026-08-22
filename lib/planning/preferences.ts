import type { TripPlannerInput } from "@/types/trip";
import { parseBudgetRange } from "@/lib/utils";
import { parseRegionFromLabel } from "./confirmed-destination";

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
  resolved?: { destination?: string; country?: string; tripLength?: number; dislikes?: string[] }
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
  const budgetAmount = parseBudgetRange(input.budget, input.customBudget);
  const budgetLevel = budgetAmount < 800 ? "low" : budgetAmount < 2500 ? "moderate" : "high";

  const dislikes = [...(resolved?.dislikes ?? [])];
  if (/\bhate\s+museums?|\bno\s+museums?/i.test(notes)) {
    dislikes.push("museums");
    scores.culture = Math.min(scores.culture, 2);
  }
  if (/\bno\s+nightlife|\bhate\s+nightlife|\bnot\s+into\s+nightlife/i.test(notes)) {
    dislikes.push("nightlife");
    scores.nightlife = 1;
  }

  let tripLength = resolved?.tripLength;
  if (!tripLength && input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    tripLength = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (86400000)) + 1);
  }

  return {
    destination: input.destination || resolved?.destination || "",
    country: input.destinationCountry || resolved?.country,
    destinationLabel: input.destinationLabel,
    state: input.destinationState || parseRegionFromLabel(input.destinationLabel).state,
    latitude: input.destinationLatitude,
    longitude: input.destinationLongitude,
    dates:
      input.startDate && input.endDate
        ? { start: input.startDate, end: input.endDate }
        : undefined,
    tripLength: tripLength || 5,
    flexibleDates: input.flexibleDates,
    budgetLevel,
    budgetLabel: input.budget,
    budgetAmount,
    travelers: input.travelers,
    travelStyle: input.travelStyle,
    pace,
    walkingTolerance,
    localVsTouristy,
    scores,
    selectedInterests: input.interests,
    dislikes: [...new Set(dislikes)],
    notes: input.additionalNotes,
  };
}

export function activitiesPerDay(prefs: UserTripPreferences): number {
  if (prefs.pace === "slow") return 3;
  if (prefs.pace === "packed") return 6;
  return 4;
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
    `  budget: ${prefs.budgetLevel} (${prefs.budgetLabel})`,
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
