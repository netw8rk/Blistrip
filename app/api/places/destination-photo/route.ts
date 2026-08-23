import { NextRequest, NextResponse } from "next/server";
import { GooglePlacesProvider } from "@/lib/travel/providers/google-places";
import { cityHeroQueries, pickCityHeroPhoto } from "@/lib/travel/city-hero-photo";
import { getCuratedDestinationHeroPhoto } from "@/lib/travel/curated-destination-photos";

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city")?.trim() ?? "";
  const country = request.nextUrl.searchParams.get("country")?.trim() ?? "";
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  if (!city || Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ photoUrl: null });
  }

  const curated = getCuratedDestinationHeroPhoto(city);
  if (curated) {
    return NextResponse.json({ photoUrl: curated });
  }

  const google = new GooglePlacesProvider();
  if (!google.isConfigured()) {
    return NextResponse.json({ photoUrl: null });
  }

  const label = [city, country].filter(Boolean).join(", ");
  const results = await Promise.all(
    cityHeroQueries(label).map((query) =>
      google.searchPlaces({
        query,
        city,
        country,
        latitude: lat,
        longitude: lng,
        radiusMeters: 20000,
        limit: 8,
      })
    )
  );

  const places = results.flatMap((result) => result.places);
  return NextResponse.json({ photoUrl: pickCityHeroPhoto(places) ?? null });
}
