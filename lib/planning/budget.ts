import type { BudgetLevel } from "@/lib/knowledge/types";
import type { BudgetEstimate, EnhancedTripPlanningContext, StructuredItineraryDraft } from "./types";

const DAILY_COST: Record<BudgetLevel, { hotel: number; food: number; transport: number }> = {
  budget: { hotel: 45, food: 35, transport: 8 },
  moderate: { hotel: 90, food: 55, transport: 12 },
  premium: { hotel: 160, food: 85, transport: 18 },
  luxury: { hotel: 280, food: 140, transport: 30 },
};

const ACTIVITY_COST: Record<BudgetLevel, number> = {
  budget: 8,
  moderate: 18,
  premium: 35,
  luxury: 60,
};

export function estimateTripBudget(
  context: EnhancedTripPlanningContext,
  draft: StructuredItineraryDraft | null,
  _travelers = 1
): BudgetEstimate {
  const level = context.budget ?? "moderate";
  const days = draft?.duration ?? context.tripLength ?? 5;
  const daily = DAILY_COST[level];
  const travelerCount = parseTravelerCount(context.travelers);

  const activityCount =
    draft?.days.reduce(
      (sum, d) => sum + d.morning.length + d.afternoon.length + d.evening.length,
      0
    ) ?? days * 3;

  const accommodation = Math.round(daily.hotel * days * travelerCount);
  const food = Math.round(daily.food * days * travelerCount);
  const transportation = Math.round(daily.transport * days * travelerCount);
  const activities = Math.round(ACTIVITY_COST[level] * activityCount * travelerCount);
  const other = Math.round((accommodation + food) * 0.08);
  const total = accommodation + food + activities + transportation + other;

  const estimate: BudgetEstimate = {
    accommodation: { amount: accommodation, confidence: "estimated" },
    food: { amount: food, confidence: "estimated" },
    activities: { amount: activities, confidence: "estimated" },
    transportation: { amount: transportation, confidence: "estimated" },
    other: { amount: other, confidence: "estimated" },
    total,
  };

  if (context.budgetAmount && total > context.budgetAmount) {
    estimate.exceedsBudget = true;
    estimate.overage = total - context.budgetAmount;
    estimate.optimizationSuggestions = buildOptimizationSuggestions(context, estimate);
  }

  return estimate;
}

function parseTravelerCount(travelers?: string): number {
  if (!travelers) return 1;
  const lower = travelers.toLowerCase();
  if (lower.includes("solo")) return 1;
  if (lower.includes("couple")) return 2;
  if (lower.includes("family")) return 4;
  if (lower.includes("friends")) return 3;
  return 1;
}

function buildOptimizationSuggestions(
  context: EnhancedTripPlanningContext,
  estimate: BudgetEstimate
): string[] {
  const suggestions: string[] = [];
  const over = estimate.overage ?? 0;

  suggestions.push(
    `You're about $${over} over budget. Consider staying in a less central neighborhood for lower accommodation costs.`
  );
  suggestions.push("Swap paid attractions for free landmarks and walking tours.");
  if (context.tripLength && context.tripLength > 4) {
    suggestions.push(`Shortening the trip by 1 day would save roughly $${Math.round(estimate.accommodation.amount / context.tripLength)}.`);
  }
  suggestions.push("Choose local eateries over tourist-zone restaurants for meaningful food savings.");
  return suggestions.slice(0, 4);
}

export function optimizeBudgetBreakdown(
  breakdown: { accommodation: number; food: number; activities: number; transportation: number; other: number },
  targetBudget: number
): { breakdown: typeof breakdown; savings: number; tradeoffs: string[] } {
  const total =
    breakdown.accommodation +
    breakdown.food +
    breakdown.activities +
    breakdown.transportation +
    breakdown.other;

  if (total <= targetBudget) {
    return { breakdown, savings: 0, tradeoffs: [] };
  }

  const gap = total - targetBudget;
  const optimized = { ...breakdown };
  const tradeoffs: string[] = [];

  // Reduce accommodation ~15%
  const hotelSave = Math.min(Math.round(optimized.accommodation * 0.15), Math.ceil(gap * 0.4));
  optimized.accommodation -= hotelSave;
  if (hotelSave > 0) tradeoffs.push("Stay in a value neighborhood instead of the tourist center.");

  // Reduce activities ~20%
  const actSave = Math.min(Math.round(optimized.activities * 0.2), Math.ceil(gap * 0.35));
  optimized.activities -= actSave;
  if (actSave > 0) tradeoffs.push("Replace paid attractions with free alternatives.");

  // Reduce food ~10%
  const foodSave = Math.min(Math.round(optimized.food * 0.1), Math.ceil(gap * 0.25));
  optimized.food -= foodSave;
  if (foodSave > 0) tradeoffs.push("Mix casual local meals with fewer splurge dinners.");

  const savings = hotelSave + actSave + foodSave;
  return { breakdown: optimized, savings, tradeoffs };
}
