import { NextRequest, NextResponse } from "next/server";
import type { TripPlannerInput } from "@/types/trip";
import { generateTripPlan } from "@/lib/ai/generate-trip";

export async function POST(request: NextRequest) {
  try {
    const input: TripPlannerInput = await request.json();

    if (!input.destination && !input.destinationUnknown) {
      return NextResponse.json({ error: "Destination is required" }, { status: 400 });
    }

    if (input.destinationUnknown && !input.destinationDescription?.trim()) {
      return NextResponse.json(
        { error: "Please describe the kind of trip you want" },
        { status: 400 }
      );
    }

    const trip = await generateTripPlan(input);
    return NextResponse.json(trip);
  } catch {
    return NextResponse.json({ error: "Failed to generate trip plan" }, { status: 500 });
  }
}
