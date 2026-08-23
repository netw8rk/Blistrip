import { getCached, setCache } from "./cache";
import { GooglePlacesProvider } from "./providers/google-places";
import type { DestinationSuggestion } from "./types";

export type { DestinationSuggestion };

const USER_AGENT = "BlistripTravelPlanner/1.0 (https://blistrip.app; travel planning)";
const NOMINATIM = "https://nominatim.openstreetmap.org";

export interface NominatimSuggestItem {
  osm_id?: number;
  osm_type?: string;
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  addresstype?: string;
  namedetails?: Record<string, string>;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

/** Common English names when OSM still returns the local spelling. */
const ENGLISH_CITY_ALIASES: Record<string, string> = {
  praha: "Prague",
  wien: "Vienna",
  munchen: "Munich",
  "münchen": "Munich",
  koln: "Cologne",
  "köln": "Cologne",
  warszawa: "Warsaw",
  krakow: "Krakow",
  kraków: "Krakow",
  lisboa: "Lisbon",
  roma: "Rome",
  firenze: "Florence",
  venezia: "Venice",
  milano: "Milan",
  napoli: "Naples",
  torino: "Turin",
  bruxelles: "Brussels",
  kobenhavn: "Copenhagen",
  "københavn": "Copenhagen",
  "den haag": "The Hague",
  "'s-gravenhage": "The Hague",
  moskva: "Moscow",
  kyiv: "Kyiv",
  kiev: "Kyiv",
  beograd: "Belgrade",
  bucuresti: "Bucharest",
  "bucurești": "Bucharest",
  athina: "Athens",
  athenai: "Athens",
  sevilla: "Seville",
};

const ENGLISH_COUNTRY_ALIASES: Record<string, string> = {
  cesko: "Czech Republic",
  "česko": "Czech Republic",
  czechia: "Czech Republic",
  deutschland: "Germany",
  espana: "Spain",
  "españa": "Spain",
  italia: "Italy",
  osterreich: "Austria",
  "österreich": "Austria",
  polska: "Poland",
  nederland: "Netherlands",
  suomi: "Finland",
  sverige: "Sweden",
  norge: "Norway",
  danmark: "Denmark",
  hellas: "Greece",
  ellada: "Greece",
};

function englishAlias(value: string | undefined, aliases: Record<string, string>): string | undefined {
  if (!value) return undefined;
  return aliases[value.trim().toLowerCase()];
}

export function preferredEnglishName(item: NominatimSuggestItem, fallback: string): string {
  const local =
    item.address?.city ||
    item.address?.town ||
    item.address?.village ||
    item.address?.municipality ||
    item.name ||
    item.display_name?.split(",")[0]?.trim() ||
    fallback;
  const fromDetails = item.namedetails?.["name:en"]?.trim() || item.namedetails?.int_name?.trim();
  if (fromDetails) return fromDetails;
  return englishAlias(local, ENGLISH_CITY_ALIASES) || local;
}

function usableRegionName(state: string | undefined, city: string, localCity?: string): string | undefined {
  if (!state) return undefined;
  const normalized = state.trim().toLowerCase();
  if (!normalized || normalized === city.toLowerCase()) return undefined;
  if (localCity && normalized.includes(localCity.trim().toLowerCase()) && localCity.toLowerCase() !== city.toLowerCase()) {
    return undefined;
  }
  if (normalized.includes(city.toLowerCase())) return undefined;
  return state;
}

export function preferredEnglishCountry(item: NominatimSuggestItem): string {
  const local = item.address?.country || "";
  const fromDetails = item.namedetails?.["country:en"]?.trim();
  if (fromDetails) return fromDetails;
  return englishAlias(local, ENGLISH_COUNTRY_ALIASES) || local;
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
    const city = preferredEnglishName(item, fallbackQuery);
    const hasSettlement = Boolean(
      item.address?.city ||
        item.address?.town ||
        item.address?.village ||
        item.address?.municipality ||
        ALLOWED_TYPES.has(kind)
    );
    if (!hasSettlement || !item.lat || !item.lon) continue;

    const country = preferredEnglishCountry(item);
    const localCity =
      item.address?.city ||
      item.address?.town ||
      item.address?.village ||
      item.address?.municipality ||
      item.name;
    const state = usableRegionName(item.address?.state, city, localCity);
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

  const cacheKey = `dest-suggest:google:${q.toLowerCase()}`;
  const cached = getCached<DestinationSuggestion[]>(cacheKey);
  if (cached) return cached;

  const google = new GooglePlacesProvider();
  if (google.isConfigured()) {
    const googleSuggestions = await google.suggestDestinations(q);
    if (googleSuggestions.length) {
      setCache(cacheKey, googleSuggestions, 10 * 60 * 1000);
      return googleSuggestions;
    }
  }

  const fallback = await suggestDestinationsFromNominatim(q);
  setCache(cacheKey, fallback, 10 * 60 * 1000);
  return fallback;
}

async function suggestDestinationsFromNominatim(q: string): Promise<DestinationSuggestion[]> {
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&namedetails=1&accept-language=en&limit=8`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Accept-Language": "en",
    },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as NominatimSuggestItem[];
  return mapNominatimToSuggestions(data, q);
}
