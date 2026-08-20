import { NextRequest, NextResponse } from "next/server";
import { findDestinationsByPreferences, buildPlanningContext } from "@/lib/knowledge";
import type { TripPlannerInput } from "@/types/trip";

export async function POST(request: NextRequest) {
  try {
    const input: Partial<TripPlannerInput> = await request.json();

    const context = buildPlanningContext({
      destination: "",
      destinationUnknown: true,
      flexibleDates: true,
      budget: input.budget ?? "$1,000–$2,000",
      travelers: input.travelers ?? "Solo",
      interests: input.interests ?? [],
      travelStyle: input.travelStyle ?? "Comfortable",
      pace: input.pace ?? "Balanced",
      ...input,
    } as TripPlannerInput);

    const matches = await findDestinationsByPreferences(context);

    return NextResponse.json({
      matches: matches.map((m) => ({
        id: m.destination.id,
        city: m.destination.city,
        country: m.destination.country,
        shortDescription: m.destination.shortDescription,
        score: m.score,
        matchReasons: m.matchReasons,
        budgetLevel: m.destination.budgetLevel,
        idealTripLength: m.destination.idealTripLength,
      })),
    });
  } catch (error) {
    console.error("Discovery API error:", error);
    return NextResponse.json({ error: "Discovery failed" }, { status: 500 });
  }
}
