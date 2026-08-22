import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_PHOTO_NAME_PATTERN } from "@/lib/travel/google-links";

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim() ?? "";
  if (!GOOGLE_PHOTO_NAME_PATTERN.test(name)) {
    return new NextResponse("Invalid photo", { status: 400 });
  }

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return new NextResponse("Photos are not configured", { status: 503 });
  }

  const lookup = await fetch(
    `https://places.googleapis.com/v1/${name}/media?maxWidthPx=800&skipHttpRedirect=true&key=${key}`
  );

  if (!lookup.ok) {
    return new NextResponse("Photo unavailable", { status: 502 });
  }

  const data = (await lookup.json()) as { photoUri?: string };
  if (!data.photoUri) {
    return new NextResponse("Photo unavailable", { status: 502 });
  }

  const image = await fetch(data.photoUri);
  if (!image.ok) {
    return new NextResponse("Photo unavailable", { status: 502 });
  }

  return new NextResponse(image.body, {
    headers: {
      "Content-Type": image.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
