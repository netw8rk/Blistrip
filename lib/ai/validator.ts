import type { TripPlan, ItineraryActivity } from "@/types/trip";
import type { EnhancedTripPlanningContext, ValidationIssue, ValidationResult } from "@/lib/planning/types";
import type { RetrievedContext } from "@/lib/knowledge/types";
import { haversineKm } from "@/lib/planning/geo";

export function validateAgentOutput(
  plan: Omit<TripPlan, "id" | "createdAt">,
  context: EnhancedTripPlanningContext,
  retrieved: RetrievedContext | null
): ValidationResult {
  const issues: ValidationIssue[] = [];

  validateDestination(plan, context, issues);
  validateDailyItinerary(plan, context, issues);
  validatePlaceSources(plan, issues);
  validateBudget(plan, context, issues);
  validateDuplicates(plan, issues);
  validateGeography(plan, issues);
  validateAgainstKnowledgeBase(plan, retrieved, issues);

  const errors = issues.filter((i) => i.severity === "error");
  return { valid: errors.length === 0, issues };
}

function validateDestination(
  plan: Omit<TripPlan, "id" | "createdAt">,
  context: EnhancedTripPlanningContext,
  issues: ValidationIssue[]
) {
  if (!plan.destination) {
    issues.push({ code: "missing_destination", message: "Plan has no destination.", severity: "error" });
    return;
  }

  if (context.destination && plan.destination.toLowerCase() !== context.destination.toLowerCase()) {
    issues.push({
      code: "destination_mismatch",
      message: `Plan destination "${plan.destination}" doesn't match requested "${context.destination}".`,
      severity: "error",
    });
  }
}

function validateDailyItinerary(
  plan: Omit<TripPlan, "id" | "createdAt">,
  context: EnhancedTripPlanningContext,
  issues: ValidationIssue[]
) {
  if (!plan.dailyItinerary || plan.dailyItinerary.length === 0) {
    issues.push({ code: "missing_itinerary", message: "Plan has no daily itinerary.", severity: "error" });
    return;
  }

  const maxPerDay = context.pace === "slow" ? 4 : context.pace === "packed" ? 8 : 6;

  for (const day of plan.dailyItinerary) {
    const activities = [...(day.morning || []), ...(day.afternoon || []), ...(day.evening || [])];

    if (activities.length === 0) {
      issues.push({
        code: "empty_day",
        message: `Day ${day.day} has no activities.`,
        severity: "warning",
        day: day.day,
      });
    }

    if (activities.length > maxPerDay) {
      issues.push({
        code: "overpacked_day",
        message: `Day ${day.day} has ${activities.length} activities (max ${maxPerDay} for ${context.pace} pace).`,
        severity: "warning",
        day: day.day,
      });
    }
  }
}

function validatePlaceSources(
  plan: Omit<TripPlan, "id" | "createdAt">,
  issues: ValidationIssue[]
) {
  let unverifiedCount = 0;

  const checkSource = (name: string, source?: string) => {
    if (!source || source === "ai_suggested") {
      unverifiedCount++;
    }
  };

  for (const hotel of plan.hotelRecommendations || []) {
    checkSource(hotel.name, hotel.source);
  }

  for (const restaurant of plan.restaurants || []) {
    checkSource(restaurant.name, restaurant.source);
  }

  for (const activity of plan.activities || []) {
    checkSource(activity.name, activity.source);
  }

  for (const day of plan.dailyItinerary || []) {
    const allActivities: ItineraryActivity[] = [
      ...(day.morning || []),
      ...(day.afternoon || []),
      ...(day.evening || []),
    ];
    for (const act of allActivities) {
      checkSource(act.name, act.source);
    }
  }

  if (unverifiedCount > 0) {
    issues.push({
      code: "unverified_places",
      message: `${unverifiedCount} place(s) have no verified source (provider/knowledge base). These may be AI-generated.`,
      severity: "warning",
    });
  }
}

function validateBudget(
  plan: Omit<TripPlan, "id" | "createdAt">,
  context: EnhancedTripPlanningContext,
  issues: ValidationIssue[]
) {
  if (!plan.budgetBreakdown) {
    issues.push({ code: "missing_budget", message: "Plan has no budget breakdown.", severity: "warning" });
    return;
  }

  const total =
    plan.budgetBreakdown.accommodation +
    plan.budgetBreakdown.food +
    plan.budgetBreakdown.activities +
    plan.budgetBreakdown.transportation +
    plan.budgetBreakdown.other;

  if (context.budgetAmount && total > context.budgetAmount * 1.2) {
    issues.push({
      code: "budget_exceeded",
      message: `Budget breakdown ($${total}) exceeds user budget ($${context.budgetAmount}) by more than 20%.`,
      severity: "warning",
    });
  }

  if (plan.estimatedBudget && Math.abs(total - plan.estimatedBudget) > plan.estimatedBudget * 0.3) {
    issues.push({
      code: "budget_inconsistent",
      message: `Budget breakdown total ($${total}) doesn't match estimated budget ($${plan.estimatedBudget}).`,
      severity: "warning",
    });
  }
}

function validateDuplicates(
  plan: Omit<TripPlan, "id" | "createdAt">,
  issues: ValidationIssue[]
) {
  const seen = new Set<string>();

  for (const day of plan.dailyItinerary || []) {
    const allActivities: ItineraryActivity[] = [
      ...(day.morning || []),
      ...(day.afternoon || []),
      ...(day.evening || []),
    ];
    for (const act of allActivities) {
      const key = act.name.toLowerCase().trim();
      if (seen.has(key)) {
        issues.push({
          code: "duplicate_itinerary_item",
          message: `"${act.name}" appears multiple times in the itinerary.`,
          severity: "error",
          day: day.day,
        });
      }
      seen.add(key);
    }
  }
}

function validateGeography(
  plan: Omit<TripPlan, "id" | "createdAt">,
  issues: ValidationIssue[]
) {
  for (const day of plan.dailyItinerary || []) {
    const activities: ItineraryActivity[] = [
      ...(day.morning || []),
      ...(day.afternoon || []),
      ...(day.evening || []),
    ];

    const withCoords = activities.filter((a) => a.latitude && a.longitude);
    if (withCoords.length < 2) continue;

    for (let i = 1; i < withCoords.length; i++) {
      const dist = haversineKm(
        withCoords[i - 1].latitude!,
        withCoords[i - 1].longitude!,
        withCoords[i].latitude!,
        withCoords[i].longitude!
      );
      if (dist > 10) {
        issues.push({
          code: "excessive_travel",
          message: `Day ${day.day}: ${withCoords[i - 1].name} → ${withCoords[i].name} is ~${dist.toFixed(1)}km apart.`,
          severity: "warning",
          day: day.day,
        });
      }
    }
  }
}

function validateAgainstKnowledgeBase(
  plan: Omit<TripPlan, "id" | "createdAt">,
  retrieved: RetrievedContext | null,
  issues: ValidationIssue[]
) {
  if (!retrieved?.destination) return;

  const destCity = retrieved.destination.city.toLowerCase();
  const planDest = plan.destination?.toLowerCase();

  if (planDest && planDest !== destCity) {
    issues.push({
      code: "kb_destination_mismatch",
      message: `Knowledge base is for "${retrieved.destination.city}" but plan targets "${plan.destination}".`,
      severity: "warning",
    });
  }
}

export function removeDuplicateItineraryItems(
  plan: Omit<TripPlan, "id" | "createdAt">
): Omit<TripPlan, "id" | "createdAt"> {
  const seen = new Set<string>();
  const dailyItinerary = (plan.dailyItinerary || []).map((day) => {
    const filterSlot = (activities: ItineraryActivity[]) =>
      activities.filter((a) => {
        const key = a.name.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return {
      ...day,
      morning: filterSlot(day.morning || []),
      afternoon: filterSlot(day.afternoon || []),
      evening: filterSlot(day.evening || []),
    };
  });
  return { ...plan, dailyItinerary };
}
