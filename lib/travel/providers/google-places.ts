import type {
  TravelDataProvider,
  PlaceSearchParams,
  PlaceSearchResult,
  NormalizedPlace,
  PlaceType,
  ActivitySearchParams,
  ActivitySearchResult,
  NormalizedActivity,
} from "../types";
import { googlePhotoUrls } from "../google-links";

const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.types",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.regularOpeningHours",
  "places.photos",
].join(",");

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "priceLevel",
  "types",
  "googleMapsUri",
  "websiteUri",
  "internationalPhoneNumber",
  "regularOpeningHours",
  "photos",
].join(",");

const GOOGLE_TYPE_MAP: Record<string, PlaceType> = {
  restaurant: "restaurant",
  bar: "bar",
  cafe: "cafe",
  night_club: "nightclub",
  lodging: "hotel",
  tourist_attraction: "attraction",
  museum: "museum",
  church: "church",
  park: "park",
  store: "shop",
  shopping_mall: "shop",
  market: "market",
  bus_station: "transport",
  train_station: "transport",
  subway_station: "transport",
  airport: "transport",
};

const PLACE_TYPE_TO_GOOGLE: Partial<Record<PlaceType, string>> = {
  restaurant: "restaurant",
  bar: "bar",
  cafe: "cafe",
  nightclub: "night_club",
  hotel: "lodging",
  attraction: "tourist_attraction",
  museum: "museum",
  church: "church",
  park: "park",
  shop: "store",
  market: "grocery_store",
  landmark: "tourist_attraction",
};

const GOOGLE_INCLUDED_TYPES = new Set(Object.values(PLACE_TYPE_TO_GOOGLE));

const ACTIVITY_GOOGLE_TYPES = [
  "tourist_attraction",
  "museum",
  "park",
  "amusement_park",
  "aquarium",
  "art_gallery",
  "zoo",
];

function mapGoogleType(googleTypes: string[]): PlaceType {
  for (const t of googleTypes) {
    if (t in GOOGLE_TYPE_MAP) return GOOGLE_TYPE_MAP[t];
  }
  return "other";
}

function mapPriceLevel(priceLevel?: string): number | undefined {
  switch (priceLevel) {
    case "PRICE_LEVEL_FREE":
      return 0;
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return undefined;
  }
}

interface GooglePlace {
  id?: string;
  name?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  googleMapsUri?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: { name?: string }[];
}

function extractPlaceId(place: GooglePlace): string {
  if (place.id) return place.id;
  if (place.name) return place.name.replace("places/", "");
  return "";
}

function normalizePlace(
  place: GooglePlace,
  city: string,
  country: string
): NormalizedPlace {
  const placeId = extractPlaceId(place);
  return {
    id: `google_places_${placeId}`,
    provider: "google_places",
    providerPlaceId: placeId,
    name: place.displayName?.text ?? "",
    type: mapGoogleType(place.types ?? []),
    address: place.formattedAddress,
    city,
    country,
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    priceLevel: mapPriceLevel(place.priceLevel),
    mapsUrl: place.googleMapsUri,
    website: place.websiteUri,
    openingHours: place.regularOpeningHours?.weekdayDescriptions,
    photoUrls: googlePhotoUrls(place.photos),
    source: "verified",
    fetchedAt: new Date().toISOString(),
  };
}

function normalizeDetailedPlace(
  place: GooglePlace,
  city: string,
  country: string
): NormalizedPlace {
  const base = normalizePlace(place, city, country);
  return {
    ...base,
    phone: place.internationalPhoneNumber,
    openingHours: place.regularOpeningHours?.weekdayDescriptions,
    photoUrls: googlePhotoUrls(place.photos) ?? base.photoUrls,
  };
}

export class GooglePlacesProvider implements TravelDataProvider {
  name = "google_places";

  private get apiKey(): string {
    return process.env.GOOGLE_PLACES_API_KEY ?? "";
  }

  isConfigured(): boolean {
    return !!process.env.GOOGLE_PLACES_API_KEY;
  }

  async searchPlaces(params: PlaceSearchParams): Promise<PlaceSearchResult> {
    const empty: PlaceSearchResult = {
      places: [],
      totalFound: 0,
      provider: this.name,
      cached: false,
    };

    if (!this.isConfigured()) return empty;

    try {
      const textQuery = this.buildSearchQuery(params);
      const body: Record<string, unknown> = { textQuery };

      if (params.limit) {
        body.maxResultCount = Math.min(params.limit, 20);
      }

      if (params.latitude != null && params.longitude != null) {
        const radius = Math.min(params.radiusMeters ?? 25000, 50000);
        body.locationBias = {
          circle: {
            center: {
              latitude: params.latitude,
              longitude: params.longitude,
            },
            radius,
          },
        };
      }

      if (params.minRating != null) {
        body.minRating = params.minRating;
      }

      const includedType = this.resolveIncludedType(params.type);
      if (includedType) {
        body.includedType = includedType;
      }

      const res = await fetch(`${GOOGLE_PLACES_BASE}/places:searchText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": SEARCH_FIELD_MASK,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        console.warn("[GooglePlaces] Rate limited (429)");
        return empty;
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(
          `[GooglePlaces] Search failed: ${res.status} ${res.statusText}${detail ? ` ${detail.slice(0, 240)}` : ""}`
        );
        return empty;
      }

      const data = (await res.json()) as { places?: GooglePlace[] };
      const googlePlaces = data.places ?? [];

      let places = googlePlaces.map((p) =>
        normalizePlace(p, params.city, params.country ?? "")
      );

      if (params.maxPriceLevel != null) {
        places = places.filter(
          (p) =>
            p.priceLevel === undefined || p.priceLevel <= params.maxPriceLevel!
        );
      }

      const limit = params.limit ?? places.length;
      places = places.slice(0, limit);

      return {
        places,
        totalFound: places.length,
        provider: this.name,
        cached: false,
      };
    } catch (err) {
      console.error("[GooglePlaces] Search error:", err);
      return empty;
    }
  }

  async getPlaceDetails(placeId: string): Promise<NormalizedPlace | null> {
    if (!this.isConfigured()) return null;

    try {
      const resourceName = placeId.startsWith("places/")
        ? placeId
        : `places/${placeId}`;

      const res = await fetch(`${GOOGLE_PLACES_BASE}/${resourceName}`, {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": DETAILS_FIELD_MASK,
        },
      });

      if (res.status === 429) {
        console.warn("[GooglePlaces] Rate limited (429) on details");
        return null;
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(
          `[GooglePlaces] Details failed: ${res.status} ${res.statusText}${detail ? ` ${detail.slice(0, 240)}` : ""}`
        );
        return null;
      }

      const place = (await res.json()) as GooglePlace;
      const city = this.extractCityFromAddress(place.formattedAddress);
      return normalizeDetailedPlace(place, city, "");
    } catch (err) {
      console.error("[GooglePlaces] Details error:", err);
      return null;
    }
  }

  async searchActivities(
    params: ActivitySearchParams
  ): Promise<ActivitySearchResult> {
    const empty: ActivitySearchResult = {
      activities: [],
      totalFound: 0,
      provider: this.name,
      cached: false,
    };

    if (!this.isConfigured()) return empty;

    try {
      const queryParts = [params.category, "things to do", params.city].filter(
        Boolean
      );
      const textQuery = queryParts.join(" in ");

      const result = await this.searchPlaces({
        query: textQuery,
        city: params.city,
        country: params.country,
        type: "attraction",
        limit: params.limit,
      });

      const activities: NormalizedActivity[] = result.places.map((place) => ({
        ...place,
        source: "verified" as const,
      }));

      return {
        activities,
        totalFound: activities.length,
        provider: this.name,
        cached: false,
      };
    } catch (err) {
      console.error("[GooglePlaces] Activity search error:", err);
      return empty;
    }
  }

  private buildSearchQuery(params: PlaceSearchParams): string {
    const parts: string[] = [];

    if (params.query) {
      parts.push(params.query);
    } else if (params.type) {
      const types = Array.isArray(params.type) ? params.type : [params.type];
      parts.push(types.join(" "));
    }

    parts.push(params.city);
    if (params.country) parts.push(params.country);

    return parts.join(" in ");
  }

  private resolveIncludedType(
    type?: PlaceType | PlaceType[]
  ): string | undefined {
    if (!type) return undefined;
    const single = Array.isArray(type) ? type[0] : type;
    const mapped = PLACE_TYPE_TO_GOOGLE[single];
    if (!mapped || !GOOGLE_INCLUDED_TYPES.has(mapped)) return undefined;
    return mapped;
  }

  private extractCityFromAddress(address?: string): string {
    if (!address) return "";
    const parts = address.split(",").map((s) => s.trim());
    return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  }
}
