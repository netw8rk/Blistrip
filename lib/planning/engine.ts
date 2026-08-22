import type { TripPlannerInput } from "@/types/trip";
import {
  findDestinationsByPreferences,
  retrieveContextForDestination,
} from "@/lib/knowledge";
import { buildEnhancedPlanningContext } from "./context";
import { rankAttractions } from "./ranking";
import { buildStructuredItinerary } from "./scheduler";
import { estimateTripBudget } from "./budget";
import {
  validateStructuredItinerary,
  repairItineraryDuplicates,
} from "./validator";
import type { PlanningPipelineResult } from "./types";
import { getConfirmedDestination, knowledgeMatchesConfirmed } from "./confirmed-destination";

export async function runPlanningPipeline(
  input: TripPlannerInput,
  options?: {
    userMessage?: string;
    priorContext?: import("./types").EnhancedTripPlanningContext;
  }
): Promise<PlanningPipelineResult> {
  const context = buildEnhancedPlanningContext(input, {
    userMessage: options?.userMessage,
    priorContext: options?.priorContext,
  });

  let retrieved = null;
  let discoveryMatches = null;
  let rankedAttractions: import("./types").AttractionScore[] = [];
  let draftItinerary = null;

  try {
    if (input.destinationUnknown || context.mode === "destination_discovery") {
      discoveryMatches = await findDestinationsByPreferences(context);
      if (discoveryMatches.length > 0) {
        const top = discoveryMatches[0];
        context.destination = top.destination.city;
        retrieved = await retrieveContextForDestination(top.destination.id, context);
        retrieved.matchScore = top.score;
        retrieved.matchReasons = top.matchReasons;
      }
    } else if (context.destination) {
      retrieved = await retrieveContextForDestination(context.destination, context);
      const confirmed = getConfirmedDestination(input);
      if (
        retrieved.destination &&
        confirmed &&
        !knowledgeMatchesConfirmed(confirmed, retrieved.destination)
      ) {
        retrieved = { destination: null, neighborhoods: [], attractions: [], dayTrips: [] };
      }
      if (!retrieved.destination) {
        return {
          context,
          retrieved,
          discoveryMatches,
          rankedAttractions: [],
          draftItinerary: null,
          validation: {
            valid: false,
            issues: [
              {
                code: "unknown_destination",
                message: `"${context.destination}" isn't in Blistrip's knowledge base yet.`,
                severity: "error",
              },
            ],
          },
          clarifyingQuestions: context.clarifyingQuestions,
          budgetEstimate: estimateTripBudget(context, null),
        };
      }
    }

    if (retrieved?.destination && retrieved.attractions.length > 0) {
      rankedAttractions = rankAttractions(
        retrieved.attractions,
        context,
        retrieved.neighborhoods
      );

      draftItinerary = buildStructuredItinerary(
        rankedAttractions,
        context,
        {
          city: retrieved.destination.city,
          country: retrieved.destination.country,
        },
        retrieved.neighborhoods
      );

      draftItinerary = repairItineraryDuplicates(draftItinerary);
    }
  } catch (error) {
    console.error("Planning pipeline retrieval failed:", error);
  }

  const validation = draftItinerary
    ? validateStructuredItinerary(draftItinerary, context)
    : { valid: true, issues: [] };

  const budgetEstimate = estimateTripBudget(context, draftItinerary);

  return {
    context,
    retrieved,
    discoveryMatches,
    rankedAttractions,
    draftItinerary,
    validation,
    clarifyingQuestions: context.clarifyingQuestions,
    budgetEstimate,
  };
}
