import { NextRequest, NextResponse } from "next/server";
import type { TripPlan } from "@/types/trip";
import { applyTripEdit } from "@/lib/planning/edits";
import { validateTripPlan } from "@/lib/planning/validator";
import { buildEnhancedPlanningContext } from "@/lib/planning/context";
import { enrichTripPlan } from "@/lib/mock-data";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tripPlan = body.tripPlan as TripPlan;
    const message = (body.message as string)?.trim();

    if (!tripPlan?.destination) {
      return NextResponse.json({ error: "Valid trip plan is required" }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const result = await applyTripEdit(tripPlan, message);
    const context = buildEnhancedPlanningContext(
      tripPlan.plannerInput ?? {
        destination: tripPlan.destination,
        destinationUnknown: false,
        flexibleDates: true,
        budget: "$1,000–$2,000",
        travelers: "Couple",
        interests: tripPlan.interests,
        travelStyle: tripPlan.travelStyle,
        pace: "Balanced",
      },
      { userMessage: message, existingPlan: tripPlan }
    );

    const validation = validateTripPlan(result.tripPlan, context);

    const { id: _id, createdAt: _created, ...planWithoutMeta } = result.tripPlan;
    const updated = enrichTripPlan(planWithoutMeta, tripPlan.plannerInput);

    return NextResponse.json({
      tripPlan: { ...updated, id: tripPlan.id, createdAt: tripPlan.createdAt },
      intent: result.intent,
      changesSummary: result.changesSummary,
      validation,
      liveDataUnavailable: result.intent === "live_data_query",
    });
  } catch {
    return NextResponse.json({ error: "Failed to refine trip plan" }, { status: 500 });
  }
}
