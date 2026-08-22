import type { TripPlannerInput } from "@/types/trip";
import {
  buildUserPreferences,
  type PreferenceScores,
  type UserTripPreferences,
} from "./preferences";

export interface TripProfile {
  destination: string;
  country?: string;
  state?: string;
  label?: string;
  latitude?: number;
  longitude?: number;
  dates?: { start: string; end: string };
  tripLength: number;
  travelers: string;
  travelerCount: number;
  budgetLevel: UserTripPreferences["budgetLevel"];
  budgetAmount: number;
  budgetLabel: string;
  travelStyle: string;
  interests: string[];
  scores: PreferenceScores;
  pace: UserTripPreferences["pace"];
  walkingTolerance: UserTripPreferences["walkingTolerance"];
  localVsTouristy: UserTripPreferences["localVsTouristy"];
  preferredStartHour: number;
  preferredEndHour: number;
  dislikes: string[];
  dietary: string[];
  notes?: string;
  prefs: UserTripPreferences;
}

const TRAVELER_COUNT: Record<string, number> = {
  Solo: 1,
  Couple: 2,
  Friends: 3,
  Family: 4,
};

export function buildTripProfile(
  input: TripPlannerInput,
  resolved?: { destination?: string; country?: string; tripLength?: number; dislikes?: string[] }
): TripProfile {
  const prefs = buildUserPreferences(input, resolved);
  const notes = [input.additionalNotes, input.destinationDescription].filter(Boolean).join(" ");

  return {
    destination: prefs.destination,
    country: prefs.country,
    state: prefs.state,
    label: prefs.destinationLabel,
    latitude: prefs.latitude,
    longitude: prefs.longitude,
    dates: prefs.dates,
    tripLength: prefs.tripLength,
    travelers: prefs.travelers,
    travelerCount: TRAVELER_COUNT[prefs.travelers] ?? 2,
    budgetLevel: prefs.budgetLevel,
    budgetAmount: prefs.budgetAmount,
    budgetLabel: prefs.budgetLabel,
    travelStyle: prefs.travelStyle,
    interests: prefs.selectedInterests,
    scores: prefs.scores,
    pace: prefs.pace,
    walkingTolerance: prefs.walkingTolerance,
    localVsTouristy: prefs.localVsTouristy,
    preferredStartHour: prefs.pace === "slow" ? 10 : prefs.pace === "packed" ? 8 : 9,
    preferredEndHour: prefs.pace === "slow" ? 20 : 22,
    dislikes: prefs.dislikes,
    dietary: parseDietary(notes),
    notes: prefs.notes,
    prefs,
  };
}

export function formatTripProfileLog(profile: TripProfile): string {
  return [
    "TRIP PROFILE",
    `  destination: ${profile.label || [profile.destination, profile.state, profile.country].filter(Boolean).join(", ")}`,
    profile.latitude != null && profile.longitude != null
      ? `  coordinates: ${profile.latitude.toFixed(4)}, ${profile.longitude.toFixed(4)}`
      : "",
    `  duration: ${profile.tripLength} days`,
    `  travelers: ${profile.travelers} (${profile.travelerCount})`,
    `  budget: ${profile.budgetLevel} (${profile.budgetLabel})`,
    `  style: ${profile.travelStyle}`,
    `  pace: ${profile.pace} (${profile.preferredStartHour}:00–${profile.preferredEndHour}:00)`,
    `  walking: ${profile.walkingTolerance}`,
    `  local vs touristy: ${profile.localVsTouristy}`,
    `  interests: ${profile.interests.join(", ") || "(none)"}`,
    `  nightlife: ${profile.scores.nightlife}/10 food: ${profile.scores.food}/10 history: ${profile.scores.history}/10`,
    profile.dislikes.length ? `  avoid: ${profile.dislikes.join(", ")}` : "",
    profile.dietary.length ? `  dietary: ${profile.dietary.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function parseDietary(notes: string): string[] {
  const found: string[] = [];
  if (/\bvegan\b/i.test(notes)) found.push("vegan");
  if (/\bvegetarian\b/i.test(notes)) found.push("vegetarian");
  if (/\bgluten[-\s]?free\b/i.test(notes)) found.push("gluten-free");
  if (/\bhalal\b/i.test(notes)) found.push("halal");
  if (/\bkosher\b/i.test(notes)) found.push("kosher");
  return found;
}
