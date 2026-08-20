import type { TripPlan, ItineraryActivity } from "@/types/trip";
import type { EnhancedTripPlanningContext, PlanningMode, StructuredItineraryDraft } from "./types";
import { buildEnhancedPlanningContext } from "./context";
import { optimizeBudgetBreakdown } from "./budget";
import { runPlanningPipeline } from "./engine";
import type { TripPlannerInput } from "@/types/trip";
import { draftToDailyItinerary } from "./merge";

export interface EditResult {
  tripPlan: TripPlan;
  changesSummary: string;
  intent: PlanningMode;
  draft?: StructuredItineraryDraft;
}

export async function applyTripEdit(
  tripPlan: TripPlan,
  message: string
): Promise<EditResult> {
  const input = tripPlan.plannerInput ?? createFallbackInput(tripPlan);
  const context = buildEnhancedPlanningContext(input, {
    userMessage: message,
    existingPlan: tripPlan,
  });

  const intent = context.mode;

  if (intent === "live_data_query") {
    return {
      tripPlan,
      changesSummary:
        "Live hotel, flight, and availability data isn't connected yet. I can optimize your plan using Blistrip's curated knowledge and estimated costs instead.",
      intent,
    };
  }

  switch (intent) {
    case "itinerary_edit":
      return applyItineraryEdit(tripPlan, message, context);
    case "budget_optimization":
      return applyBudgetOptimization(tripPlan, context);
    case "preference_change":
      return applyPreferenceChange(tripPlan, message, input, context);
    case "trip_optimization":
    case "recommendation":
    case "destination_discovery":
    case "specific_destination":
    default:
      return applyPartialRegeneration(tripPlan, input, context, message);
  }
}

function applyItineraryEdit(
  tripPlan: TripPlan,
  message: string,
  _context: EnhancedTripPlanningContext
): EditResult {
  const moveMatch = message.match(/\bmove\s+(.+?)\s+to\s+day\s+(\d+)\b/i);
  if (moveMatch) {
    const activityName = moveMatch[1].trim();
    const targetDay = parseInt(moveMatch[2], 10);
    const updated = moveActivityToDay(tripPlan, activityName, targetDay);
    return {
      tripPlan: updated,
      changesSummary: `Moved "${activityName}" to day ${targetDay}. Other days unchanged.`,
      intent: "itinerary_edit",
    };
  }

  return {
    tripPlan,
    changesSummary: "Couldn't parse the edit — try 'Move [activity] to day [number]'.",
    intent: "itinerary_edit",
  };
}

function moveActivityToDay(tripPlan: TripPlan, activityName: string, targetDay: number): TripPlan {
  const itinerary = tripPlan.dailyItinerary.map((d) => ({
    ...d,
    morning: [...d.morning],
    afternoon: [...d.afternoon],
    evening: [...d.evening],
  }));

  let moved: ItineraryActivity | null = null;

  for (const day of itinerary) {
    for (const slot of ["morning", "afternoon", "evening"] as const) {
      const idx = day[slot].findIndex((a) =>
        a.name.toLowerCase().includes(activityName.toLowerCase())
      );
      if (idx >= 0) {
        moved = day[slot].splice(idx, 1)[0];
        break;
      }
    }
    if (moved) break;
  }

  if (!moved) return tripPlan;

  let target = itinerary.find((d) => d.day === targetDay);
  if (!target) {
    target = { day: targetDay, title: `Day ${targetDay}`, morning: [], afternoon: [], evening: [] };
    itinerary.push(target);
    itinerary.sort((a, b) => a.day - b.day);
  }

  target.morning.push(moved);

  return { ...tripPlan, dailyItinerary: itinerary };
}

function applyBudgetOptimization(
  tripPlan: TripPlan,
  context: EnhancedTripPlanningContext
): EditResult {
  const target = context.budgetAmount ?? tripPlan.estimatedBudget * 0.85;
  const { breakdown, savings, tradeoffs } = optimizeBudgetBreakdown(
    tripPlan.budgetBreakdown,
    target
  );

  const newTotal =
    breakdown.accommodation +
    breakdown.food +
    breakdown.activities +
    breakdown.transportation +
    breakdown.other;

  return {
    tripPlan: {
      ...tripPlan,
      estimatedBudget: newTotal,
      budgetBreakdown: breakdown,
      tripSummary: `${tripPlan.tripSummary} Budget optimized — saved ~$${savings}. ${tradeoffs.join(" ")}`,
    },
    changesSummary: `Reduced estimated budget by ~$${savings}. ${tradeoffs.join(" ")}`,
    intent: "budget_optimization",
  };
}

async function applyPreferenceChange(
  tripPlan: TripPlan,
  message: string,
  input: TripPlannerInput,
  context: EnhancedTripPlanningContext
): Promise<EditResult> {
  // Re-run pipeline with updated dislikes, merge only itinerary
  const pipeline = await runPlanningPipeline({
    ...input,
    additionalNotes: [input.additionalNotes, message].filter(Boolean).join(". "),
  });

  if (!pipeline.draftItinerary) {
    // Fallback: strip museums from existing plan
    if (context.dislikes.includes("museums")) {
      const filtered = stripCategoryFromItinerary(tripPlan, "museum");
      return {
        tripPlan: filtered,
        changesSummary: "Removed museum stops from your itinerary.",
        intent: "preference_change",
      };
    }
    return { tripPlan, changesSummary: "Updated preferences noted.", intent: "preference_change" };
  }

  const dailyItinerary = draftToDailyItinerary(pipeline.draftItinerary);

  return {
    tripPlan: {
      ...tripPlan,
      dailyItinerary,
      interests: context.interests.map(capitalize),
      tripSummary: `${tripPlan.tripSummary} Updated to reflect your preferences.`,
    },
    changesSummary: `Itinerary updated based on: "${message.slice(0, 80)}".`,
    intent: "preference_change",
    draft: pipeline.draftItinerary,
  };
}

async function applyPartialRegeneration(
  tripPlan: TripPlan,
  input: TripPlannerInput,
  context: EnhancedTripPlanningContext,
  message: string
): Promise<EditResult> {
  const pipeline = await runPlanningPipeline({
    ...input,
    destination: tripPlan.destination,
    destinationUnknown: false,
    additionalNotes: [input.additionalNotes, message].filter(Boolean).join(". "),
  });

  if (!pipeline.draftItinerary) {
    return { tripPlan, changesSummary: "No changes applied.", intent: context.mode };
  }

  return {
    tripPlan: {
      ...tripPlan,
      dailyItinerary: draftToDailyItinerary(pipeline.draftItinerary),
    },
    changesSummary: "Itinerary refreshed using updated preferences.",
    intent: context.mode,
    draft: pipeline.draftItinerary,
  };
}

function stripCategoryFromItinerary(tripPlan: TripPlan, category: string): TripPlan {
  const filter = (activities: ItineraryActivity[]) =>
    activities.filter((a) => !a.name.toLowerCase().includes(category));

  return {
    ...tripPlan,
    dailyItinerary: tripPlan.dailyItinerary.map((d) => ({
      ...d,
      morning: filter(d.morning),
      afternoon: filter(d.afternoon),
      evening: filter(d.evening),
    })),
  };
}

function createFallbackInput(tripPlan: TripPlan): TripPlannerInput {
  return {
    destination: tripPlan.destination,
    destinationUnknown: false,
    flexibleDates: true,
    budget: "$1,000–$2,000",
    travelers: "Couple",
    interests: tripPlan.interests,
    travelStyle: tripPlan.travelStyle,
    pace: "Balanced",
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
