import { NextRequest, NextResponse } from "next/server";
import type { TripPlannerInput } from "@/types/trip";
import { generateTripPlan } from "@/lib/ai/generate-trip";
import { trackTripGeneration } from "@/lib/analytics";

export async function POST(request: NextRequest) {
  try {
    const input: TripPlannerInput = await request.json();

    if (!input.destination && !input.destinationUnknown) {
      return NextResponse.json({ error: "Destination is required" }, { status: 400 });
    }

    if (
      !input.destinationUnknown &&
      (input.destinationLatitude == null || input.destinationLongitude == null)
    ) {
      return NextResponse.json(
        { error: "Pick a destination from the list so we search the right place" },
        { status: 400 }
      );
    }

    if (input.destinationUnknown && !input.destinationDescription?.trim()) {
      return NextResponse.json(
        { error: "Please describe the kind of trip you want" },
        { status: 400 }
      );
    }

    const trip = await generateTripPlan(input);
    return NextResponse.json(trip, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[plan-trip] Failed to generate trip plan", error);
    trackTripGeneration(false, { error: "Failed to generate trip plan" });
    return NextResponse.json({ error: "Failed to generate trip plan" }, { status: 500 });
  }
}
