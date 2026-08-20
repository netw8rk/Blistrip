import type { DailyItinerary, ItineraryActivity, TripPlan } from "@/types/trip";
import type {
  BudgetEstimate,
  StructuredItineraryDraft,
} from "./types";
import type { RetrievedContext } from "@/lib/knowledge/types";

export function draftToDailyItinerary(draft: StructuredItineraryDraft): DailyItinerary[] {
  return draft.days.map((day) => ({
    day: day.day,
    title: day.title,
    morning: day.morning.map(toItineraryActivity),
    afternoon: day.afternoon.map(toItineraryActivity),
    evening: day.evening.map(toItineraryActivity),
  }));
}

function toItineraryActivity(
  planned: import("./types").PlannedActivity
): ItineraryActivity {
  return {
    name: planned.name,
    description: planned.description,
    whyRecommended: planned.reason,
    knowledgeId: planned.knowledgeId,
    type: planned.type,
    neighborhood: planned.neighborhood,
    latitude: planned.latitude,
    longitude: planned.longitude,
    durationMinutes: planned.durationMinutes,
    estimatedCostLevel: planned.estimatedCostLevel,
    travelTimeFromPrevious: planned.travelTimeFromPreviousMinutes,
    reservationRecommended: planned.reservationRecommended,
    source: planned.source,
  };
}

/** Merge engine draft into AI-generated plan — draft itinerary wins for structure. */
export function mergeDraftIntoTripPlan(
  aiPlan: Omit<TripPlan, "id" | "createdAt">,
  draft: StructuredItineraryDraft | null,
  budgetEstimate: BudgetEstimate | null
): Omit<TripPlan, "id" | "createdAt"> {
  const merged = { ...aiPlan };

  if (draft) {
    merged.dailyItinerary = draftToDailyItinerary(draft);
    merged.duration = draft.duration;
    merged.destination = draft.destination;
    merged.country = draft.country;
  }

  if (budgetEstimate) {
    merged.estimatedBudget = budgetEstimate.total;
    merged.budgetBreakdown = {
      accommodation: budgetEstimate.accommodation.amount,
      food: budgetEstimate.food.amount,
      activities: budgetEstimate.activities.amount,
      transportation: budgetEstimate.transportation.amount,
      other: budgetEstimate.other.amount,
    };
  }

  return merged;
}

/** Build prompt section describing the pre-computed itinerary draft. */
export function formatDraftForPrompt(
  draft: StructuredItineraryDraft,
  retrieved: RetrievedContext | null
): string {
  let section = `\n--- PRE-COMPUTED ITINERARY (USE AS STRUCTURAL BASE) ---\n`;
  section += `The Blistrip planning engine has already grouped these activities geographically.\n`;
  section += `You MUST use this day-by-day structure. You may refine descriptions and add meals/hotels, but do NOT rearrange days arbitrarily.\n\n`;

  for (const day of draft.days) {
    section += `DAY ${day.day}: ${day.title}\n`;
    if (day.neighborhoodFocus) section += `  Focus: ${day.neighborhoodFocus}\n`;
    for (const slot of ["morning", "afternoon", "evening"] as const) {
      const activities = day[slot];
      if (activities.length === 0) continue;
      section += `  ${slot.toUpperCase()}:\n`;
      for (const a of activities) {
        section += `    - ${a.name} [${a.type}, ~${a.durationMinutes}min, ${a.estimatedCostLevel}]: ${a.reason}\n`;
      }
    }
    section += `\n`;
  }

  if (draft.geographicNotes.length > 0) {
    section += `Geographic notes: ${draft.geographicNotes.join("; ")}\n`;
  }

  if (retrieved?.destination) {
    section += `\nDestination strengths: ${retrieved.destination.strengths.slice(0, 3).join("; ")}\n`;
  }

  section += `--- END PRE-COMPUTED ITINERARY ---\n`;
  return section;
}

export function formatDiscoveryForPrompt(
  matches: { destination: { city: string; country: string }; score: number; matchReasons: string[] }[]
): string {
  let section = `\n--- DESTINATION DISCOVERY (ranked by Blistrip engine) ---\n`;
  for (const m of matches.slice(0, 5)) {
    section += `- ${m.destination.city}, ${m.destination.country} (${m.score}%): ${m.matchReasons.join("; ")}\n`;
  }
  section += `Recommend the top match and explain tradeoffs for alternatives.\n`;
  section += `--- END DESTINATION DISCOVERY ---\n`;
  return section;
}

export function formatBudgetForPrompt(budget: BudgetEstimate): string {
  return `\n--- BUDGET ESTIMATE (ESTIMATED — NOT LIVE PRICES) ---\n` +
    `Accommodation: ~$${budget.accommodation.amount} (${budget.accommodation.confidence})\n` +
    `Food: ~$${budget.food.amount} (${budget.food.confidence})\n` +
    `Activities: ~$${budget.activities.amount} (${budget.activities.confidence})\n` +
    `Transportation: ~$${budget.transportation.amount} (${budget.transportation.confidence})\n` +
    `Total: ~$${budget.total}\n` +
    (budget.exceedsBudget
      ? `⚠ Over budget by ~$${budget.overage}. Suggestions: ${budget.optimizationSuggestions?.join(" ")}\n`
      : "") +
    `--- END BUDGET ESTIMATE ---\n`;
}

/** Build a minimal TripPlan skeleton from engine output when AI is unavailable. */
export function buildPlanFromEngine(
  draft: StructuredItineraryDraft,
  budgetEstimate: BudgetEstimate,
  context: import("./types").EnhancedTripPlanningContext,
  retrieved: RetrievedContext | null
): Omit<TripPlan, "id" | "createdAt"> {
  const dest = retrieved?.destination;
  const neighborhoods = (retrieved?.neighborhoods ?? []).slice(0, 3).map((n) => ({
    name: n.name,
    bestFor: n.bestFor.join(", "),
    why: n.description.slice(0, 120),
  }));

  const topNeighborhood = retrieved?.neighborhoods[0];

  return {
    tripSummary: `A ${draft.duration}-day ${draft.pace}-pace trip to ${draft.destination} built from Blistrip's curated knowledge, grouped geographically by neighborhood.`,
    destination: draft.destination,
    country: draft.country,
    dates: context.dates ? `${context.dates.start} – ${context.dates.end}` : "Flexible dates",
    duration: draft.duration,
    estimatedBudget: budgetEstimate.total,
    travelStyle: context.interests[0] ?? "culture",
    interests: context.interests.map((i) => i.charAt(0).toUpperCase() + i.slice(1)),
    recommendedNeighborhood: topNeighborhood?.name ?? "City Center",
    neighborhoodReason: topNeighborhood?.description.slice(0, 150) ?? "Central access to main sights.",
    neighborhoods,
    hotelRecommendations: [],
    activities: draft.days.flatMap((d) =>
      [...d.morning, ...d.afternoon, ...d.evening].map((a) => ({
        name: a.name,
        description: a.description,
        price: `~${a.estimatedCostLevel}`,
        duration: `${a.durationMinutes} min`,
        whyRecommended: a.reason,
        bookingUrl: "",
        category: a.type,
      }))
    ),
    restaurants: [],
    transportation: dest
      ? [`Use ${dest.city}'s public transit for most trips.`, "Walk between grouped sights each day."]
      : ["Use public transit where available."],
    dailyItinerary: draftToDailyItinerary(draft),
    budgetBreakdown: {
      accommodation: budgetEstimate.accommodation.amount,
      food: budgetEstimate.food.amount,
      activities: budgetEstimate.activities.amount,
      transportation: budgetEstimate.transportation.amount,
      other: budgetEstimate.other.amount,
    },
    travelTips: [
      "All prices are estimates — live availability isn't connected yet.",
      "Book popular restaurants ahead when possible.",
    ],
    packingRecommendations: ["Comfortable walking shoes", "Universal adapter"],
    travelEssentials: [],
  };
}
