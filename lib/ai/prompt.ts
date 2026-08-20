import type { RetrievedContext, TripPlanningContext } from "@/lib/knowledge/types";
import type {
  AttractionScore,
  BudgetEstimate,
  EnhancedTripPlanningContext,
  StructuredItineraryDraft,
} from "@/lib/planning/types";
import type { DestinationMatch } from "@/lib/knowledge/types";
import {
  formatDraftForPrompt,
  formatDiscoveryForPrompt,
  formatBudgetForPrompt,
} from "@/lib/planning/merge";

export const TRAVEL_PLANNER_SYSTEM_PROMPT = `You are a highly capable travel planner for Blistrip, using curated travel knowledge and structured planning output.

BEHAVIOR:
- Reason before recommending. Respect user constraints. Minimize unnecessary travel.
- Prioritize Blistrip curated knowledge over general knowledge.
- Use the PRE-COMPUTED ITINERARY as your structural base — do NOT rearrange days arbitrarily.
- Create realistic pacing. Explain WHY each recommendation fits (briefly).
- Ask clarifying questions ONLY if listed in the prompt — never interrogate the user.
- Preserve session context from user notes and preferences.

DATA TRANSPARENCY:
- BLISTRIP KNOWLEDGE: curated, stable — present confidently
- BUDGET FIGURES: ESTIMATES only — never claim live prices or availability
- Do NOT fabricate hotel availability, flight prices, opening hours, or ticket availability
- Label anything you infer as a suggestion

RESPONSE FORMAT:
Valid JSON only. Use this structure:

{
  "tripSummary": "2-3 sentence overview",
  "destination": "City",
  "country": "Country",
  "dates": "Date range or Flexible dates",
  "duration": number,
  "estimatedBudget": number,
  "travelStyle": "style",
  "interests": ["array"],
  "recommendedNeighborhood": "name",
  "neighborhoodReason": "why",
  "neighborhoods": [{ "name": "", "bestFor": "", "why": "" }],
  "hotelRecommendations": [{ "name": "", "description": "", "priceRange": "$X-Y/night (estimate)", "whyRecommended": "", "rating": 4.5, "neighborhood": "" }],
  "activities": [{ "name": "", "description": "", "price": "estimate", "duration": "", "whyRecommended": "", "category": "" }],
  "restaurants": [{ "name": "", "cuisine": "", "priceRange": "$$", "whyRecommended": "", "location": "", "category": "cheap|mid-range|special-occasion" }],
  "transportation": ["tip"],
  "dailyItinerary": [{
    "day": 1,
    "title": "Day title",
    "morning": [{ "name": "", "description": "", "whyRecommended": "" }],
    "afternoon": [{ "name": "", "description": "", "whyRecommended": "" }],
    "evening": [{ "name": "", "description": "", "whyRecommended": "" }]
  }],
  "budgetBreakdown": { "accommodation": 0, "food": 0, "activities": 0, "transportation": 0, "other": 0 },
  "travelTips": ["tip"],
  "packingRecommendations": ["item"],
  "travelEssentials": [{ "name": "", "description": "", "price": "", "category": "" }]
}

Create 3 neighborhoods, 3 hotels (estimates), 6-8 activities, 6 restaurants, and daily itinerary matching the pre-computed structure.`;

interface BuildPromptOptions {
  input: Record<string, unknown>;
  retrievedContext?: RetrievedContext | null;
  pipeline?: {
    context: EnhancedTripPlanningContext;
    draftItinerary: StructuredItineraryDraft | null;
    discoveryMatches: DestinationMatch[] | null;
    budgetEstimate: BudgetEstimate | null;
    clarifyingQuestions: string[];
    rankedTop: AttractionScore[];
  };
}

export function buildUserPrompt(options: BuildPromptOptions | Record<string, unknown>, retrievedContext?: RetrievedContext | null): string {
  // Backward-compatible signature
  const opts: BuildPromptOptions =
    "input" in (options as BuildPromptOptions)
      ? (options as BuildPromptOptions)
      : { input: options as Record<string, unknown>, retrievedContext };

  const { input, pipeline } = opts;
  const retrieved = opts.retrievedContext ?? retrievedContext;

  let prompt = `Create a personalized trip plan:\n\n${JSON.stringify(input, null, 2)}`;

  if (pipeline?.context) {
    prompt += `\n\n--- PLANNING CONTEXT ---`;
    prompt += `\nMode: ${pipeline.context.mode}`;
    prompt += `\nPace: ${pipeline.context.pace} (${paceDescription(pipeline.context.pace)})`;
    if (pipeline.context.dislikes.length > 0) {
      prompt += `\nAvoid: ${pipeline.context.dislikes.join(", ")}`;
    }
    if (pipeline.context.tripGoals?.length) {
      prompt += `\nTrip goals: ${pipeline.context.tripGoals.join(", ")}`;
    }
    prompt += `\n--- END PLANNING CONTEXT ---`;
  }

  if (pipeline?.discoveryMatches?.length) {
    prompt += formatDiscoveryForPrompt(pipeline.discoveryMatches);
  }

  if (retrieved?.destination) {
    prompt += `\n\n--- BLISTRIP TRAVEL KNOWLEDGE ---`;
    prompt += `\nDESTINATION: ${retrieved.destination.city}, ${retrieved.destination.country}`;
    prompt += `\n${retrieved.destination.description}`;
    prompt += `\nStrengths: ${retrieved.destination.strengths.join(", ")}`;

    if (retrieved.neighborhoods.length > 0) {
      prompt += `\n\nNEIGHBORHOODS:`;
      for (const n of retrieved.neighborhoods.slice(0, 6)) {
        prompt += `\n- ${n.name}: ${n.description.slice(0, 100)} (Best for: ${n.bestFor.join(", ")})`;
      }
    }

    const topAttractions = pipeline?.rankedTop ?? retrieved.attractions.slice(0, 20);
    if (topAttractions.length > 0) {
      prompt += `\n\nRANKED ATTRACTIONS (by relevance score):`;
      for (const s of topAttractions) {
        const a = "attraction" in s ? s.attraction : s;
        const score = "score" in s ? ` [score: ${s.score}]` : "";
        prompt += `\n- ${a.name} [${a.category}]${score}: ${a.whyVisit}`;
      }
    }

    if (retrieved.dayTrips.length > 0) {
      prompt += `\n\nDAY TRIPS:`;
      for (const dt of retrieved.dayTrips.slice(0, 3)) {
        prompt += `\n- ${dt.name}: ${dt.description.slice(0, 80)}`;
      }
    }
    prompt += `\n--- END BLISTRIP KNOWLEDGE ---`;
  }

  if (pipeline?.draftItinerary) {
    prompt += formatDraftForPrompt(pipeline.draftItinerary, retrieved ?? null);
  }

  if (pipeline?.budgetEstimate) {
    prompt += formatBudgetForPrompt(pipeline.budgetEstimate);
  }

  if (pipeline?.clarifyingQuestions?.length) {
    prompt += `\nIf you must ask a question, use at most: ${pipeline.clarifyingQuestions.join(" OR ")}`;
  } else {
    prompt += `\nDo NOT ask clarifying questions — enough information exists to build the trip.`;
  }

  prompt += `\n\nRespond with valid JSON only.`;
  return prompt;
}

export function buildDiscoveryPrompt(
  context: TripPlanningContext,
  matches: { city: string; country: string; score: number; reasons: string[] }[]
): string {
  return buildUserPrompt({
    input: {
      destinationUnknown: true,
      interests: context.interests,
      budget: context.budget,
      tripLength: context.tripLength,
      pace: context.pace,
    },
    pipeline: {
      context: context as EnhancedTripPlanningContext,
      draftItinerary: null,
      discoveryMatches: matches.map((m) => ({
        destination: { city: m.city, country: m.country } as import("@/lib/knowledge/types").KnowledgeDestination,
        score: m.score,
        matchReasons: m.reasons,
      })),
      budgetEstimate: null,
      clarifyingQuestions: [],
      rankedTop: [],
    },
  });
}

function paceDescription(pace?: string): string {
  switch (pace) {
    case "slow":
      return "2-3 major activities/day";
    case "packed":
      return "4-5 activities/day when geographically reasonable";
    default:
      return "3-4 activities/day";
  }
}
