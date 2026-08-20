import type { TripPlannerInput, TripPlan } from "@/types/trip";
import { TRAVEL_PLANNER_SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompt";
import { generateMockTrip, enrichTripPlan } from "@/lib/mock-data";
import {
  runPlanningPipeline,
  mergeDraftIntoTripPlan,
  buildPlanFromEngine,
  validateTripPlan,
} from "@/lib/planning";

export async function generateTripPlan(input: TripPlannerInput): Promise<TripPlan> {
  const pipeline = await runPlanningPipeline(input);

  const {
    context,
    retrieved,
    discoveryMatches,
    draftItinerary,
    validation,
    budgetEstimate,
    clarifyingQuestions,
  } = pipeline;

  // Unknown destination with no knowledge
  if (
    validation.issues.some((i) => i.code === "unknown_destination") &&
    !input.destinationUnknown
  ) {
    console.warn(`Unknown destination: ${input.destination}`);
    return generateMockTrip(input);
  }

  const apiKey = process.env.OPENAI_API_KEY;

  // Engine-only path: no API key but we have a structured draft
  if (!apiKey && draftItinerary && budgetEstimate) {
    const enginePlan = buildPlanFromEngine(
      draftItinerary,
      budgetEstimate,
      context,
      retrieved
    );
    return enrichTripPlan(enginePlan, input);
  }

  if (!apiKey) {
    return generateMockTrip(input);
  }

  try {
    const userPrompt = buildUserPrompt({
      input: input as unknown as Record<string, unknown>,
      retrievedContext: retrieved,
      pipeline: {
        context,
        draftItinerary,
        discoveryMatches,
        budgetEstimate,
        clarifyingQuestions,
        rankedTop: pipeline.rankedAttractions.slice(0, 15),
      },
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: TRAVEL_PLANNER_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.status);
      if (draftItinerary && budgetEstimate) {
        const enginePlan = buildPlanFromEngine(draftItinerary, budgetEstimate, context, retrieved);
        return enrichTripPlan(enginePlan, input);
      }
      return generateMockTrip(input);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      if (draftItinerary && budgetEstimate) {
        const enginePlan = buildPlanFromEngine(draftItinerary, budgetEstimate, context, retrieved);
        return enrichTripPlan(enginePlan, input);
      }
      return generateMockTrip(input);
    }

    let parsed: Omit<TripPlan, "id" | "createdAt">;
    try {
      parsed = JSON.parse(content) as Omit<TripPlan, "id" | "createdAt">;
    } catch {
      if (draftItinerary && budgetEstimate) {
        const enginePlan = buildPlanFromEngine(draftItinerary, budgetEstimate, context, retrieved);
        return enrichTripPlan(enginePlan, input);
      }
      return generateMockTrip(input);
    }

    const merged = mergeDraftIntoTripPlan(parsed, draftItinerary, budgetEstimate);
    const tripValidation = validateTripPlan(merged as TripPlan, context);

    if (!tripValidation.valid && draftItinerary) {
      merged.dailyItinerary = mergeDraftIntoTripPlan(
        { ...merged, dailyItinerary: [] },
        draftItinerary,
        budgetEstimate
      ).dailyItinerary;
    }

    return enrichTripPlan(merged, input);
  } catch (error) {
    console.error("Trip generation failed:", error);
    if (draftItinerary && budgetEstimate) {
      const enginePlan = buildPlanFromEngine(draftItinerary, budgetEstimate, context, retrieved);
      return enrichTripPlan(enginePlan, input);
    }
    return generateMockTrip(input);
  }
}
