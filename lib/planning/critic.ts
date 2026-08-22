import type { TripPlan } from "@/types/trip";
import type { EnhancedTripPlanningContext } from "./types";
import { validateTripPlan } from "./validator";
import { validateAgentOutput, removeDuplicateItineraryItems } from "@/lib/ai/validator";
import {
  constrainItineraryToPool,
  type PlaceRetrievalResult,
} from "@/lib/travel/retrieve-places";
import type { UserTripPreferences } from "./preferences";
import { isOpenDuringSlot, type DaySlot } from "@/lib/travel/opening-hours";

const MAX_REPAIRS = 2;

export interface CriticResult {
  plan: Omit<TripPlan, "id" | "createdAt">;
  attempts: number;
  issues: string[];
  repaired: boolean;
}

export function runCriticRepairLoop(
  plan: Omit<TripPlan, "id" | "createdAt">,
  retrieval: PlaceRetrievalResult,
  prefs: UserTripPreferences,
  context: EnhancedTripPlanningContext,
  assembledDays: TripPlan["dailyItinerary"]
): CriticResult {
  let current = plan;
  const issues: string[] = [];
  let attempts = 0;

  while (attempts < MAX_REPAIRS) {
    current = removeDuplicateItineraryItems(current);
    const constrained = constrainItineraryToPool(current, retrieval, prefs);
    current = constrained.plan;
    current.dailyItinerary = mergeEmptyDays(current.dailyItinerary, assembledDays);
    current = dropClosedStops(current, retrieval);

    const tripCheck = validateTripPlan(
      { ...current, id: "critic", createdAt: new Date().toISOString() },
      context
    );
    const agentCheck = validateAgentOutput(current, context, null);
    const all = [...tripCheck.issues, ...agentCheck.issues];
    const blocking = all.filter((issue) => issue.severity === "error" || issue.code === "empty_day");

    if (blocking.length === 0) {
      return { plan: current, attempts, issues, repaired: attempts > 0 };
    }

    issues.push(...blocking.map((issue) => `${issue.code}: ${issue.message}`));
    attempts += 1;
    current.dailyItinerary = mergeEmptyDays(current.dailyItinerary, assembledDays);
  }

  current = constrainItineraryToPool(current, retrieval, prefs).plan;
  current.dailyItinerary = mergeEmptyDays(current.dailyItinerary, assembledDays);
  return { plan: current, attempts, issues, repaired: attempts > 0 };
}

function mergeEmptyDays(
  generated: TripPlan["dailyItinerary"],
  fallbackDays: TripPlan["dailyItinerary"]
): TripPlan["dailyItinerary"] {
  const byDay = new Map(fallbackDays.map((day) => [day.day, day]));
  return generated.map((day) => {
    const fallback = byDay.get(day.day);
    if (!fallback) return day;
    const hasStops = day.morning.length + day.afternoon.length + day.evening.length > 0;
    if (!hasStops) return fallback;
    return {
      ...day,
      morning: day.morning.length ? day.morning : fallback.morning,
      afternoon: day.afternoon.length ? day.afternoon : fallback.afternoon,
      evening: day.evening.length ? day.evening : fallback.evening,
    };
  });
}

function dropClosedStops(
  plan: Omit<TripPlan, "id" | "createdAt">,
  retrieval: PlaceRetrievalResult
): Omit<TripPlan, "id" | "createdAt"> {
  const hoursById = new Map<string, string[] | undefined>();
  for (const item of [...retrieval.ranked, ...retrieval.selected, ...retrieval.diningAndNightlife]) {
    if (item.place.providerPlaceId) hoursById.set(item.place.providerPlaceId, item.place.openingHours);
    hoursById.set(item.place.id, item.place.openingHours);
    hoursById.set(item.place.name.toLowerCase(), item.place.openingHours);
  }

  const keep = (slot: DaySlot, activities: TripPlan["dailyItinerary"][number]["morning"]) =>
    activities.filter((activity) => {
      if (activity.type === "experience") return true;
      const hours =
        (activity.providerPlaceId ? hoursById.get(activity.providerPlaceId) : undefined) ??
        hoursById.get(activity.name.toLowerCase());
      return isOpenDuringSlot(hours, slot);
    });

  return {
    ...plan,
    dailyItinerary: plan.dailyItinerary.map((day) => ({
      ...day,
      morning: keep("morning", day.morning),
      afternoon: keep("afternoon", day.afternoon),
      evening: keep("evening", day.evening),
    })),
  };
}
