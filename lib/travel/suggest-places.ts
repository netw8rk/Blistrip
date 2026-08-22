import { getCached, setCache } from "./cache";

const USER_AGENT = "BlistripTravelPlanner/1.0 (https://blistrip.app; travel planning)";
const NOMINATIM = "https://nominatim.openstreetmap.org";

export interface DestinationSuggestion {
  id: string;
  label: string;
  city: string;
  country: string;
  state?: string;
  latitude: number;
  longitude: number;
}

export interface NominatimSuggestItem {
  osm_id?: number;
  osm_type?: string;
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  addresstype?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
  };
}

const ALLOWED_TYPES = new Set([
  "city",
  "town",
  "village",
  "municipality",
  "hamlet",
  "administrative",
  "suburb",
  "neighbourhood",
]);

export function mapNominatimToSuggestions(
  data: NominatimSuggestItem[],
  fallbackQuery: string
): DestinationSuggestion[] {
  const suggestions: DestinationSuggestion[] = [];
  const seen = new Set<string>();

  for (const item of data) {
    const kind = item.addresstype || item.type || "";
    const city =
      item.address?.city ||
      item.address?.town ||
      item.address?.village ||
      item.address?.municipality ||
      item.name ||
      item.display_name?.split(",")[0]?.trim() ||
      fallbackQuery;
    const hasSettlement = Boolean(
      item.address?.city ||
        item.address?.town ||
        item.address?.village ||
        item.address?.municipality ||
        ALLOWED_TYPES.has(kind)
    );
    if (!hasSettlement || !item.lat || !item.lon) continue;

    const country = item.address?.country || "";
    const state = item.address?.state;
    const label = [city, state, country].filter(Boolean).join(", ");
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    suggestions.push({
      id: `${item.osm_type ?? "node"}/${item.osm_id ?? suggestions.length}`,
      label,
      city,
      country,
      state,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
    });
  }

  return suggestions.slice(0, 6);
}

export async function suggestDestinations(query: string): Promise<DestinationSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const cacheKey = `dest-suggest:${q.toLowerCase()}`;
  const cached = getCached<DestinationSuggestion[]>(cacheKey);
  if (cached) return cached;

  const url = `${NOMINATIM}/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&limit=8`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as NominatimSuggestItem[];
  const suggestions = mapNominatimToSuggestions(data, q);
  setCache(cacheKey, suggestions, 10 * 60 * 1000);
  return suggestions;
}
