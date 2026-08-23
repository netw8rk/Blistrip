export const GOOGLE_PHOTO_NAME_PATTERN = /^places\/[^/]+\/photos\/[^/]+$/;

export function googlePhotoProxyUrl(photoName?: string, widthPx = 800): string | undefined {
  if (!photoName) return undefined;
  const name = photoName.startsWith("places/") ? photoName : `places/${photoName}`;
  if (!GOOGLE_PHOTO_NAME_PATTERN.test(name)) return undefined;
  const width = clampPhotoWidth(widthPx);
  const url = `/api/places/photo?name=${encodeURIComponent(name)}`;
  return width === 800 ? url : `${url}&w=${width}`;
}

export function withGooglePhotoWidth(src?: string, widthPx = 800): string | undefined {
  if (!src?.startsWith("/api/places/photo")) return src;
  const width = clampPhotoWidth(widthPx);
  const withoutWidth = src.replace(/([?&])w=\d+/, "").replace(/[?&]$/, "");
  return `${withoutWidth}${withoutWidth.includes("?") ? "&" : "?"}w=${width}`;
}

export function googleHeroPhotoSrc(src?: string, widthPx = 2400): string | undefined {
  return withGooglePhotoWidth(src, widthPx);
}

function clampPhotoWidth(widthPx: number): number {
  if (!Number.isFinite(widthPx)) return 800;
  return Math.min(4800, Math.max(200, Math.round(widthPx)));
}

export function googlePhotoUrls(photos?: { name?: string }[]): string[] | undefined {
  const urls = (photos ?? [])
    .map((photo) => googlePhotoProxyUrl(photo.name))
    .filter((url): url is string => Boolean(url));
  return urls.length ? urls : undefined;
}

export function isGooglePhotoSrc(src?: string): boolean {
  return Boolean(src?.startsWith("/api/places/photo"));
}

export function googlePlacePageUrl(place: {
  name: string;
  mapsUrl?: string;
  provider?: string;
  providerPlaceId?: string;
  latitude?: number;
  longitude?: number;
}): string {
  if (place.mapsUrl && isGoogleMapsUrl(place.mapsUrl)) return place.mapsUrl;
  if (place.provider === "google_places" && place.providerPlaceId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(place.providerPlaceId)}`;
  }
  if (place.latitude != null && place.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.latitude},${place.longitude}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`;
}

function isGoogleMapsUrl(url: string): boolean {
  return /google\.(com|co)|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url);
}
