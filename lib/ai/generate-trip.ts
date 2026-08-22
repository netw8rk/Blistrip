import type { TripPlannerInput, TripPlan } from "@/types/trip";
import { generateMockTrip, enrichTripPlan } from "@/lib/mock-data";
import { runPlanningPipeline, estimateTripBudget } from "@/lib/planning";
import { buildUserPreferences, formatPreferencesLog } from "@/lib/planning/preferences";
import {
  buildDraftFromRankedPlaces,
  buildPlanFromRetrieval,
  constrainItineraryToPool,
  formatRetrievalLog,
  retrievePersonalizedPlaces,
} from "@/lib/travel/retrieve-places";
import { runTravelAgent } from "./agent";
import {
  applyConfirmedDestination,
  getConfirmedDestination,
} from "@/lib/planning/confirmed-destination";

export async function generateTripPlan(input: TripPlannerInput): Promise<TripPlan> {
  const pipeline = await runPlanningPipeline(input);
  const { context, retrieved, budgetEstimate } = pipeline;

  const confirmed = getConfirmedDestination(input);
  const city = confirmed?.city || retrieved?.destination?.city || context.destination || "";
  const country = confirmed?.country || retrieved?.destination?.country;

  const prefs = buildUserPreferences(input, {
    destination: city,
    country,
    tripLength: context.tripLength,
    dislikes: context.dislikes,
  });

  console.log("\n========== BLISTRIP PLANNING PIPELINE ==========");
  console.log(formatPreferencesLog(prefs));
  console.log(`OUTPUT DESTINATION → ${prefs.destination}`);

  const retrieval = city ? await retrievePersonalizedPlaces(prefs) : null;

  if (retrieval) {
    console.log(formatRetrievalLog(retrieval));
    console.log(`OSM CITY → ${retrieval.city}, ${retrieval.country}`);

    const draft = buildDraftFromRankedPlaces(retrieval, prefs);
    const budget = budgetEstimate ?? estimateTripBudget(context, draft);
    let plan = buildPlanFromRetrieval(retrieval, draft, budget, prefs);
    if (confirmed) plan = applyConfirmedDestination(plan, confirmed);
    const osmPlanDays = plan.dailyItinerary;

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const agentResult = await runTravelAgent(
          input,
          { ...pipeline, draftItinerary: draft, budgetEstimate: budget },
          retrieval,
          prefs
        );
        if (agentResult.plan) {
          plan = {
            ...plan,
            tripSummary: agentResult.plan.tripSummary || plan.tripSummary,
            neighborhoodReason: agentResult.plan.neighborhoodReason || plan.neighborhoodReason,
            travelTips: agentResult.plan.travelTips?.length ? agentResult.plan.travelTips : plan.travelTips,
            packingRecommendations: agentResult.plan.packingRecommendations?.length
              ? agentResult.plan.packingRecommendations
              : plan.packingRecommendations,
            transportation: agentResult.plan.transportation?.length
              ? agentResult.plan.transportation
              : plan.transportation,
          };
          const constrained = constrainItineraryToPool(
            {
              ...agentResult.plan,
              destination: confirmed?.city || prefs.destination,
              country: confirmed?.country || retrieval.country,
              hotelRecommendations: plan.hotelRecommendations,
              restaurants: plan.restaurants,
              activities: plan.activities,
              dailyItinerary: agentResult.plan.dailyItinerary?.length
                ? agentResult.plan.dailyItinerary
                : plan.dailyItinerary,
              neighborhoods: plan.neighborhoods,
            },
            retrieval,
            prefs
          );
          plan = constrained.plan;
          if (confirmed) plan = applyConfirmedDestination(plan, confirmed);
          plan.dailyItinerary = mergeEmptyDays(plan.dailyItinerary, osmPlanDays);
          console.log(`VALIDATION → ${constrained.verified}/${constrained.total} itinerary stops match OSM`);
        } else {
          console.warn(`[Agent] ${agentResult.error}. Using OSM itinerary for ${prefs.destination}.`);
        }
      } catch (error) {
        console.warn(`[Agent] exception. Using OSM itinerary for ${prefs.destination}.`, error);
      }
    } else {
      console.log("OpenAI key missing — returning OSM itinerary without LLM copy.");
    }

    console.log(`FINAL OUTPUT → ${plan.destination}`);
    console.log(`HOTELS → ${plan.hotelRecommendations.map((h) => h.name).join(", ") || "(none)"}`);
    console.log(`RESTAURANTS → ${plan.restaurants.map((r) => r.name).join(", ") || "(none)"}`);
    console.log(`STOPS → ${plan.activities.map((a) => a.name).join(", ") || "(none)"}`);
    console.log("================================================\n");
    const finished = enrichTripPlan(plan, input);
    return confirmed ? applyConfirmedDestination(finished, confirmed) : finished;
  }

  console.log("OSM SEARCHES → no live places retrieved");
  if (pipeline.draftItinerary && (budgetEstimate || true)) {
    const budget = budgetEstimate ?? estimateTripBudget(context, pipeline.draftItinerary);
    const { buildPlanFromEngine } = await import("@/lib/planning");
    const enginePlan = buildPlanFromEngine(pipeline.draftItinerary, budget, context, retrieved);
    if (confirmed) {
      Object.assign(enginePlan, applyConfirmedDestination(enginePlan, confirmed));
    } else {
      enginePlan.destination = prefs.destination;
    }
    console.log(`FINAL OUTPUT → knowledge-base draft for ${enginePlan.destination}`);
    console.log("================================================\n");
    const finished = enrichTripPlan(enginePlan, input);
    return confirmed ? applyConfirmedDestination(finished, confirmed) : finished;
  }

  console.log(`FINAL OUTPUT → destination-only fallback for ${prefs.destination} (no Prague substitution)`);
  console.log("================================================\n");
  const fallback = generateMockTrip({
    ...input,
    destination: prefs.destination,
    destinationCountry: confirmed?.country || input.destinationCountry,
    destinationLabel: confirmed?.label || input.destinationLabel,
    destinationUnknown: false,
  });
  return confirmed ? applyConfirmedDestination(fallback, confirmed) : fallback;
}

function mergeEmptyDays(
  generated: TripPlan["dailyItinerary"],
  osmDays: TripPlan["dailyItinerary"]
): TripPlan["dailyItinerary"] {
  const byDay = new Map(osmDays.map((day) => [day.day, day]));
  return generated.map((day) => {
    const fallback = byDay.get(day.day);
    if (!fallback) return day;
    const hasStops =
      day.morning.length + day.afternoon.length + day.evening.length > 0;
    if (!hasStops) return fallback;
    return {
      ...day,
      morning: day.morning.length ? day.morning : fallback.morning,
      afternoon: day.afternoon.length ? day.afternoon : fallback.afternoon,
      evening: day.evening.length ? day.evening : fallback.evening,
    };
  });
}
