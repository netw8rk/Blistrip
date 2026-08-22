import type {
  PlaceSearchParams,
  PlaceSearchResult,
  NormalizedPlace,
  HotelSearchParams,
  HotelSearchResult,
  ActivitySearchParams,
  ActivitySearchResult,
  RouteParams,
  RouteResult,
} from "@/lib/travel/types";
import {
  searchPlaces,
  getPlaceDetails,
  searchHotels,
  searchActivities,
  calculateRoute,
  getTravelCapabilities,
} from "@/lib/travel";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  result: unknown;
  error?: string;
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: "search_places",
    description:
      "Search for real places (restaurants, bars, cafes, attractions, museums, landmarks, parks, shops) in a city. Returns verified results from Google Places or other configured providers. Use this to find real-world recommendations instead of inventing places.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search query, e.g. 'best jazz bars', 'traditional Czech restaurants', 'museums near Old Town'",
        },
        type: {
          type: "string",
          enum: [
            "restaurant",
            "bar",
            "cafe",
            "nightclub",
            "attraction",
            "museum",
            "landmark",
            "park",
            "church",
            "shop",
            "market",
          ],
          description: "Filter by place type",
        },
        city: { type: "string", description: "City name" },
        country: { type: "string", description: "Country name" },
        minRating: {
          type: "number",
          description: "Minimum rating (1-5)",
        },
        maxPriceLevel: {
          type: "number",
          description: "Maximum price level (1=cheap, 4=expensive)",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 5, max 10)",
        },
      },
      required: ["city"],
    },
  },
  {
    name: "get_place_details",
    description:
      "Get detailed information about a specific place by its provider place ID. Returns opening hours, phone, website, photos, and full details.",
    parameters: {
      type: "object",
      properties: {
        provider: { type: "string", description: "Provider name, e.g. 'google_places'" },
        placeId: { type: "string", description: "The provider-specific place ID" },
      },
      required: ["provider", "placeId"],
    },
  },
  {
    name: "search_hotels",
    description:
      "Search for hotels in a city. Returns verified hotel results with pricing when available from configured providers.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string" },
        country: { type: "string" },
        checkIn: { type: "string", description: "Check-in date (YYYY-MM-DD)" },
        checkOut: { type: "string", description: "Check-out date (YYYY-MM-DD)" },
        guests: { type: "number" },
        maxPricePerNight: { type: "number" },
        neighborhood: { type: "string" },
        minRating: { type: "number" },
      },
      required: ["city", "checkIn", "checkOut", "guests"],
    },
  },
  {
    name: "search_activities",
    description:
      "Search for bookable activities and tours in a city. Returns verified results from activity providers like Viator.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string" },
        country: { type: "string" },
        category: { type: "string", description: "e.g. 'walking tours', 'food tours', 'boat cruises'" },
        maxPrice: { type: "number" },
        limit: { type: "number" },
      },
      required: ["city"],
    },
  },
  {
    name: "calculate_distance",
    description:
      "Calculate walking distance and estimated travel time between two coordinates. Use to verify itinerary feasibility.",
    parameters: {
      type: "object",
      properties: {
        originLat: { type: "number" },
        originLng: { type: "number" },
        destLat: { type: "number" },
        destLng: { type: "number" },
        mode: { type: "string", enum: ["walking", "transit", "driving"], description: "Default: walking" },
      },
      required: ["originLat", "originLng", "destLat", "destLng"],
    },
  },
];

function openAiToolSchema(tool: ToolDefinition) {
  return {
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

export function getOpenAiTools() {
  const capabilities = getTravelCapabilities();
  const tools = AGENT_TOOLS.filter((t) => {
    if (t.name === "search_places" && !capabilities.places) return false;
    if (t.name === "get_place_details" && !capabilities.places) return false;
    if (t.name === "search_hotels" && !capabilities.hotels) return false;
    if (t.name === "search_activities" && !capabilities.activities) return false;
    if (t.name === "calculate_distance" && !capabilities.routing) return false;
    return true;
  });

  if (tools.length === 0) return undefined;
  return tools.map(openAiToolSchema);
}

export async function executeToolCall(call: ToolCall): Promise<ToolResult> {
  const args = call.arguments;
  try {
    switch (call.name) {
      case "search_places": {
        const params: PlaceSearchParams = {
          query: args.query as string | undefined,
          type: args.type as PlaceSearchParams["type"],
          city: args.city as string,
          country: args.country as string | undefined,
          minRating: args.minRating as number | undefined,
          maxPriceLevel: args.maxPriceLevel as number | undefined,
          limit: Math.min((args.limit as number) || 5, 10),
        };
        const result: PlaceSearchResult = await searchPlaces(params);
        return { name: call.name, result: summarizePlaces(result) };
      }

      case "get_place_details": {
        const place: NormalizedPlace | null = await getPlaceDetails(
          args.provider as string,
          args.placeId as string
        );
        return { name: call.name, result: place };
      }

      case "search_hotels": {
        const params: HotelSearchParams = {
          city: args.city as string,
          country: args.country as string | undefined,
          checkIn: args.checkIn as string,
          checkOut: args.checkOut as string,
          guests: args.guests as number,
          maxPricePerNight: args.maxPricePerNight as number | undefined,
          neighborhood: args.neighborhood as string | undefined,
          minRating: args.minRating as number | undefined,
        };
        const result: HotelSearchResult = await searchHotels(params);
        return { name: call.name, result };
      }

      case "search_activities": {
        const params: ActivitySearchParams = {
          city: args.city as string,
          country: args.country as string | undefined,
          category: args.category as string | undefined,
          maxPrice: args.maxPrice as number | undefined,
          limit: Math.min((args.limit as number) || 5, 10),
        };
        const result: ActivitySearchResult = await searchActivities(params);
        return { name: call.name, result };
      }

      case "calculate_distance": {
        const params: RouteParams = {
          origin: { lat: args.originLat as number, lng: args.originLng as number },
          destination: { lat: args.destLat as number, lng: args.destLng as number },
          mode: (args.mode as RouteParams["mode"]) ?? "walking",
        };
        const result: RouteResult = await calculateRoute(params);
        return { name: call.name, result };
      }

      default:
        return { name: call.name, result: null, error: `Unknown tool: ${call.name}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool execution failed";
    console.error(`Tool ${call.name} failed:`, error);
    return { name: call.name, result: null, error: message };
  }
}

function summarizePlaces(result: PlaceSearchResult) {
  return {
    totalFound: result.totalFound,
    provider: result.provider,
    cached: result.cached,
    places: result.places.map((p) => ({
      id: p.id,
      provider: p.provider,
      providerPlaceId: p.providerPlaceId,
      name: p.name,
      type: p.type,
      category: p.category,
      address: p.address,
      city: p.city,
      rating: p.rating,
      reviewCount: p.reviewCount,
      priceLevel: p.priceLevel,
      latitude: p.latitude,
      longitude: p.longitude,
      mapsUrl: p.mapsUrl,
      website: p.website,
      source: p.source,
    })),
  };
}
