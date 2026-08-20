import type { TripPlan } from "@/types/trip";
import type {
  EnhancedTripPlanningContext,
  StructuredItineraryDraft,
  ValidationIssue,
  ValidationResult,
} from "./types";

const PACE_MAX_ACTIVITIES: Record<string, number> = {
  slow: 4,
  balanced: 6,
  packed: 8,
};

export function validateStructuredItinerary(
  draft: StructuredItineraryDraft,
  context: EnhancedTripPlanningContext
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const seenNames = new Set<string>();
  const maxPerDay = PACE_MAX_ACTIVITIES[context.pace ?? "balanced"] ?? 6;

  for (const day of draft.days) {
    const activities = [...day.morning, ...day.afternoon, ...day.evening];

    if (activities.length > maxPerDay) {
      issues.push({
        code: "overpacked_day",
        message: `Day ${day.day} has ${activities.length} activities — too many for a ${context.pace} pace.`,
        severity: "error",
        day: day.day,
      });
    }

    if (activities.length === 0) {
      issues.push({
        code: "empty_day",
        message: `Day ${day.day} has no activities scheduled.`,
        severity: "warning",
        day: day.day,
      });
    }

    for (const act of activities) {
      const key = act.name.toLowerCase();
      if (seenNames.has(key)) {
        issues.push({
          code: "duplicate_attraction",
          message: `"${act.name}" appears more than once in the itinerary.`,
          severity: "error",
          day: day.day,
        });
      }
      seenNames.add(key);
    }

    // Geographic spread check
    const withCoords = activities.filter((a) => a.latitude && a.longitude);
    if (withCoords.length >= 2) {
      let maxDist = 0;
      for (let i = 1; i < withCoords.length; i++) {
        const dist = haversineSimple(
          withCoords[i - 1].latitude!,
          withCoords[i - 1].longitude!,
          withCoords[i].latitude!,
          withCoords[i].longitude!
        );
        maxDist = Math.max(maxDist, dist);
      }
      if (maxDist > 5) {
        issues.push({
          code: "geographic_spread",
          message: `Day ${day.day} spans a wide area (~${maxDist.toFixed(1)}km) — consider grouping nearby stops.`,
          severity: "warning",
          day: day.day,
        });
      }
    }
  }

  if (context.destination && draft.destination.toLowerCase() !== context.destination.toLowerCase()) {
    issues.push({
      code: "destination_mismatch",
      message: `Itinerary destination (${draft.destination}) doesn't match requested ${context.destination}.`,
      severity: "error",
    });
  }

  if (context.dislikes.includes("museums")) {
    const museumCount = draft.days.reduce(
      (sum, d) =>
        sum +
        [...d.morning, ...d.afternoon, ...d.evening].filter(
          (a) => a.type === "museum"
        ).length,
      0
    );
    if (museumCount > 0) {
      issues.push({
        code: "contradictory_preference",
        message: `User dislikes museums but ${museumCount} museum stop(s) remain.`,
        severity: "error",
      });
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  return { valid: errors.length === 0, issues };
}

export function validateTripPlan(
  plan: TripPlan,
  context?: EnhancedTripPlanningContext
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const seenNames = new Set<string>();

  for (const day of plan.dailyItinerary) {
    const slots = [...day.morning, ...day.afternoon, ...day.evening];
    for (const act of slots) {
      const key = act.name.toLowerCase();
      if (seenNames.has(key)) {
        issues.push({
          code: "duplicate_attraction",
          message: `"${act.name}" appears more than once.`,
          severity: "warning",
          day: day.day,
        });
      }
      seenNames.add(key);
    }
  }

  if (context?.budgetAmount && plan.estimatedBudget > context.budgetAmount * 1.15) {
    issues.push({
      code: "budget_exceeded",
      message: `Estimated budget ($${plan.estimatedBudget}) exceeds user's $${context.budgetAmount} limit.`,
      severity: "warning",
    });
  }

  const breakdownTotal =
    plan.budgetBreakdown.accommodation +
    plan.budgetBreakdown.food +
    plan.budgetBreakdown.activities +
    plan.budgetBreakdown.transportation +
    plan.budgetBreakdown.other;

  if (Math.abs(breakdownTotal - plan.estimatedBudget) > plan.estimatedBudget * 0.2) {
    issues.push({
      code: "budget_inconsistent",
      message: "Budget breakdown doesn't align with estimated total.",
      severity: "warning",
    });
  }

  const errors = issues.filter((i) => i.severity === "error");
  return { valid: errors.length === 0, issues };
}

function haversineSimple(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function repairItineraryDuplicates(draft: StructuredItineraryDraft): StructuredItineraryDraft {
  const seen = new Set<string>();
  const days = draft.days.map((day) => {
    const filterSlot = (activities: typeof day.morning) =>
      activities.filter((a) => {
        const key = a.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return {
      ...day,
      morning: filterSlot(day.morning),
      afternoon: filterSlot(day.afternoon),
      evening: filterSlot(day.evening),
    };
  });

  return { ...draft, days };
}
