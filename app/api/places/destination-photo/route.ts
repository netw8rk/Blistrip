import { NextRequest, NextResponse } from "next/server";
import { GooglePlacesProvider } from "@/lib/travel/providers/google-places";

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city")?.trim() ?? "";
  const country = request.nextUrl.searchParams.get("country")?.trim() ?? "";
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  if (!city || Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ photoUrl: null });
  }

  const google = new GooglePlacesProvider();
  if (!google.isConfigured()) {
    return NextResponse.json({ photoUrl: null });
  }

  const result = await google.searchPlaces({
    query: `${city} skyline landmarks`,
    type: "attraction",
    city,
    country,
    latitude: lat,
    longitude: lng,
    radiusMeters: 20000,
    limit: 6,
  });

  const preferred = ["landmark", "attraction", "park", "museum", "church"];
  const place = [...result.places]
    .filter((item) => item.photoUrls?.[0])
    .sort((a, b) => {
      const aBoost = preferred.includes(a.type) ? 10 : 0;
      const bBoost = preferred.includes(b.type) ? 10 : 0;
      return bBoost + (b.rating ?? 0) - (aBoost + (a.rating ?? 0));
    })[0];

  return NextResponse.json({ photoUrl: place?.photoUrls?.[0] ?? null });
}
