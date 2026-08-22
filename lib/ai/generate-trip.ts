import type { TripPlannerInput, TripPlan } from "@/types/trip";
import { generateMockTrip, enrichTripPlan } from "@/lib/mock-data";
import { runPlanningPipeline, estimateTripBudget } from "@/lib/planning";
import { buildTripProfile, formatTripProfileLog } from "@/lib/planning/trip-profile";
import { buildSearchRequirements, formatSearchRequirementsLog } from "@/lib/planning/search-requirements";
import { runCriticRepairLoop } from "@/lib/planning/critic";
import {
  buildDraftFromRankedPlaces,
  buildPlanFromRetrieval,
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
  const discovered = retrieved?.destination;
  const city = confirmed?.city || discovered?.city || context.destination || "";
  const country = confirmed?.country || discovered?.country;

  const startedAt = Date.now();
  const profile = buildTripProfile(input, {
    destination: city,
    country,
    tripLength: context.tripLength,
    dislikes: context.dislikes,
    latitude: confirmed?.latitude ?? discovered?.latitude,
    longitude: confirmed?.longitude ?? discovered?.longitude,
    label:
      confirmed?.label ||
      (discovered ? [discovered.city, discovered.country].filter(Boolean).join(", ") : undefined),
  });
  const prefs = profile.prefs;
  const requirements = buildSearchRequirements(profile);

  console.log("\n========== BLISTRIP PLANNING PIPELINE ==========");
  console.log(formatTripProfileLog(profile));
  console.log(formatSearchRequirementsLog(requirements));
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
            dailyItinerary: overlayStopCopy(osmPlanDays, agentResult.plan.dailyItinerary),
          };
        } else {
          console.warn(`[Agent] ${agentResult.error}. Using retrieved itinerary for ${prefs.destination}.`);
        }
      } catch (error) {
        console.warn(`[Agent] exception. Using OSM itinerary for ${prefs.destination}.`, error);
      }
    } else {
      console.log("OpenAI key missing — returning OSM itinerary without LLM copy.");
    }

    const critic = runCriticRepairLoop(plan, retrieval, prefs, context, osmPlanDays);
    plan = critic.plan;
    if (confirmed) plan = applyConfirmedDestination(plan, confirmed);
    console.log(
      `CRITIC → ${critic.repaired ? "repaired" : "passed"} after ${critic.attempts} attempt(s)${
        critic.issues.length ? ` · ${critic.issues.slice(0, 3).join(" | ")}` : ""
      }`
    );
    console.log(`ELAPSED → ${Date.now() - startedAt}ms`);
    console.log(`PROVIDERS → ${(retrieval.providers ?? []).join(", ") || "none"}`);
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

function overlayStopCopy(
  assembled: TripPlan["dailyItinerary"],
  polished?: TripPlan["dailyItinerary"]
): TripPlan["dailyItinerary"] {
  if (!polished?.length) return assembled;
  const copyByName = new Map<string, { description?: string; whyRecommended?: string }>();
  for (const day of polished) {
    for (const stop of [...day.morning, ...day.afternoon, ...day.evening]) {
      copyByName.set(stop.name.toLowerCase().trim(), {
        description: stop.description,
        whyRecommended: stop.whyRecommended,
      });
    }
  }

  return assembled.map((day) => {
    const apply = (stops: TripPlan["dailyItinerary"][number]["morning"]) =>
      stops.map((stop) => {
        const copy = copyByName.get(stop.name.toLowerCase().trim());
        if (!copy) return stop;
        return {
          ...stop,
          description: copy.description || stop.description,
          whyRecommended: copy.whyRecommended || stop.whyRecommended,
        };
      });
    return {
      ...day,
      morning: apply(day.morning),
      afternoon: apply(day.afternoon),
      evening: apply(day.evening),
    };
  });
}
