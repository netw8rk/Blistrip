import { NextRequest, NextResponse } from "next/server";
import {
  getAllDestinations,
  getDestination,
  getNeighborhoods,
  getAttractions,
  getDayTrips,
  searchDestinations,
} from "@/lib/knowledge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "list";
  const destinationId = searchParams.get("destination");

  try {
    switch (action) {
      case "list": {
        const destinations = await getAllDestinations();
        return NextResponse.json({ destinations });
      }

      case "detail": {
        if (!destinationId) {
          return NextResponse.json({ error: "destination param required" }, { status: 400 });
        }
        const destination = await getDestination(destinationId);
        if (!destination) {
          return NextResponse.json({ error: "Destination not found" }, { status: 404 });
        }
        const [neighborhoods, attractions, dayTrips] = await Promise.all([
          getNeighborhoods(destination.id),
          getAttractions(destination.id),
          getDayTrips(destination.id),
        ]);
        return NextResponse.json({ destination, neighborhoods, attractions, dayTrips });
      }

      case "search": {
        const styles = searchParams.get("styles")?.split(",") ?? [];
        const budget = searchParams.get("budget") ?? undefined;
        const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : undefined;
        const destinations = await searchDestinations({
          travelStyles: styles.length > 0 ? styles : undefined,
          budgetLevel: budget,
          month,
        });
        return NextResponse.json({ destinations });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Knowledge API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
