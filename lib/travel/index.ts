import "./providers";
import type {
  PlaceSearchParams,
  PlaceSearchResult,
  NormalizedPlace,
  HotelSearchParams,
  HotelSearchResult,
  FlightSearchParams,
  FlightSearchResult,
  ActivitySearchParams,
  ActivitySearchResult,
  RouteParams,
  RouteResult,
} from "./types";
import {
  getConfiguredProviders,
  getProvider,
  hasPlaceSearch,
  hasHotelSearch,
  hasFlightSearch,
  hasActivitySearch,
  hasRouting,
} from "./registry";
import { getCached, setCache } from "./cache";

const SEARCH_TTL = 30 * 60 * 1000;
const PRICING_TTL = 5 * 60 * 1000;

export async function searchPlaces(params: PlaceSearchParams): Promise<PlaceSearchResult> {
  const cacheKey = `places:${JSON.stringify(params)}`;
  const cached = getCached<PlaceSearchResult>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const provider = getConfiguredProviders().find((p) => p.searchPlaces);
  if (!provider?.searchPlaces) {
    console.warn("[travel] No provider configured for place search");
    return { places: [], totalFound: 0, provider: "none", cached: false };
  }

  const result = await provider.searchPlaces(params);
  setCache(cacheKey, result, SEARCH_TTL);
  return { ...result, cached: false };
}

export async function getPlaceDetails(providerName: string, placeId: string): Promise<NormalizedPlace | null> {
  const cacheKey = `place:${providerName}:${placeId}`;
  const cached = getCached<NormalizedPlace>(cacheKey);
  if (cached) return cached;

  const provider = getProvider(providerName);
  if (!provider?.getPlaceDetails) {
    console.warn(`[travel] Provider "${providerName}" not found or doesn't support place details`);
    return null;
  }

  const result = await provider.getPlaceDetails(placeId);
  if (result) setCache(cacheKey, result, SEARCH_TTL);
  return result;
}

export async function searchHotels(params: HotelSearchParams): Promise<HotelSearchResult> {
  const cacheKey = `hotels:${JSON.stringify(params)}`;
  const cached = getCached<HotelSearchResult>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const provider = getConfiguredProviders().find((p) => p.searchHotels);
  if (!provider?.searchHotels) {
    console.warn("[travel] No provider configured for hotel search");
    return { hotels: [], totalFound: 0, provider: "none", cached: false };
  }

  const result = await provider.searchHotels(params);
  setCache(cacheKey, result, PRICING_TTL);
  return { ...result, cached: false };
}

export async function searchFlights(params: FlightSearchParams): Promise<FlightSearchResult> {
  const cacheKey = `flights:${JSON.stringify(params)}`;
  const cached = getCached<FlightSearchResult>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const provider = getConfiguredProviders().find((p) => p.searchFlights);
  if (!provider?.searchFlights) {
    console.warn("[travel] No provider configured for flight search");
    return { flights: [], totalFound: 0, provider: "none", cached: false };
  }

  const result = await provider.searchFlights(params);
  setCache(cacheKey, result, PRICING_TTL);
  return { ...result, cached: false };
}

export async function searchActivities(params: ActivitySearchParams): Promise<ActivitySearchResult> {
  const cacheKey = `activities:${JSON.stringify(params)}`;
  const cached = getCached<ActivitySearchResult>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const provider = getConfiguredProviders().find((p) => p.searchActivities);
  if (!provider?.searchActivities) {
    console.warn("[travel] No provider configured for activity search");
    return { activities: [], totalFound: 0, provider: "none", cached: false };
  }

  const result = await provider.searchActivities(params);
  setCache(cacheKey, result, SEARCH_TTL);
  return { ...result, cached: false };
}

export async function calculateRoute(params: RouteParams): Promise<RouteResult> {
  const cacheKey = `route:${JSON.stringify(params)}`;
  const cached = getCached<RouteResult>(cacheKey);
  if (cached) return cached;

  const provider = getConfiguredProviders().find((p) => p.calculateRoute);
  if (!provider?.calculateRoute) {
    console.warn("[travel] No provider configured for routing");
    return { distanceMeters: 0, distanceText: "unknown", durationMinutes: 0, durationText: "unknown", provider: "none" };
  }

  const result = await provider.calculateRoute(params);
  setCache(cacheKey, result, SEARCH_TTL);
  return result;
}

export function getTravelCapabilities() {
  return {
    places: hasPlaceSearch(),
    hotels: hasHotelSearch(),
    flights: hasFlightSearch(),
    activities: hasActivitySearch(),
    routing: hasRouting(),
  };
}

export { registerTravelProvider, getConfiguredProviders } from "./registry";
export type * from "./types";
