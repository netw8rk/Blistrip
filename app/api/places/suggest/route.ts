import { NextRequest, NextResponse } from "next/server";
import { suggestDestinations } from "@/lib/travel/suggest-places";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await suggestDestinations(query);
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Destination suggest failed:", error);
    return NextResponse.json({ suggestions: [] });
  }
}
