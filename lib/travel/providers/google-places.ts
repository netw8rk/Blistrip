import type {
  TravelDataProvider,
  PlaceSearchParams,
  PlaceSearchResult,
  NormalizedPlace,
  PlaceType,
  ActivitySearchParams,
  ActivitySearchResult,
  NormalizedActivity,
  DestinationSuggestion,
} from "../types";
import { googlePhotoUrls } from "../google-links";
import { getCached, setCache } from "../cache";
import { deriveProviderTags } from "../place-tags";
import { googlePriceLevelEnums } from "@/lib/planning/nightly-budget";

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
  "places.primaryType",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.regularOpeningHours",
  "places.photos",
  "places.businessStatus",
  "places.addressComponents",
  "places.editorialSummary",
  "nextPageToken",
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
  "primaryType",
  "googleMapsUri",
  "websiteUri",
  "internationalPhoneNumber",
  "regularOpeningHours",
  "photos",
  "businessStatus",
  "addressComponents",
  "editorialSummary",
].join(",");

const EXCLUDED_GOOGLE_TYPES = new Set([
  "grocery_store",
  "supermarket",
  "convenience_store",
  "liquor_store",
  "drugstore",
  "pharmacy",
  "gas_station",
  "bank",
  "atm",
  "parking",
  "hospital",
  "doctor",
  "dentist",
  "school",
  "university",
  "local_government_office",
  "car_dealer",
  "car_repair",
  "car_wash",
  "storage",
  "real_estate_agency",
  "insurance_agency",
  "post_office",
  "courthouse",
  "cemetery",
  "funeral_home",
]);

const GOOGLE_TYPE_MAP: Record<string, PlaceType> = {
  restaurant: "restaurant",
  american_restaurant: "restaurant",
  bakery: "cafe",
  barbecue_restaurant: "restaurant",
  breakfast_restaurant: "restaurant",
  brunch_restaurant: "restaurant",
  chinese_restaurant: "restaurant",
  fast_food_restaurant: "restaurant",
  french_restaurant: "restaurant",
  greek_restaurant: "restaurant",
  hamburger_restaurant: "restaurant",
  indian_restaurant: "restaurant",
  italian_restaurant: "restaurant",
  japanese_restaurant: "restaurant",
  korean_restaurant: "restaurant",
  mediterranean_restaurant: "restaurant",
  mexican_restaurant: "restaurant",
  pizza_restaurant: "restaurant",
  ramen_restaurant: "restaurant",
  seafood_restaurant: "restaurant",
  steak_house: "restaurant",
  sushi_restaurant: "restaurant",
  thai_restaurant: "restaurant",
  vegan_restaurant: "restaurant",
  vegetarian_restaurant: "restaurant",
  vietnamese_restaurant: "restaurant",
  meal_takeaway: "restaurant",
  bar: "bar",
  pub: "bar",
  wine_bar: "bar",
  cocktail_bar: "bar",
  beer_garden: "bar",
  cafe: "cafe",
  coffee_shop: "cafe",
  night_club: "nightclub",
  lodging: "hotel",
  tourist_attraction: "attraction",
  museum: "museum",
  art_gallery: "museum",
  church: "church",
  park: "park",
  national_park: "park",
  state_park: "park",
  dog_park: "park",
  garden: "park",
  botanical_garden: "park",
  hiking_area: "park",
  shopping_mall: "shop",
  clothing_store: "shop",
  gift_shop: "shop",
  book_store: "shop",
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
  shop: "shopping_mall",
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

export function isExcludedGoogleTypes(googleTypes: string[] = []): boolean {
  return googleTypes.some((type) => EXCLUDED_GOOGLE_TYPES.has(type));
}

export function mapGoogleType(googleTypes: string[]): PlaceType {
  for (const type of googleTypes) {
    if (type in GOOGLE_TYPE_MAP) return GOOGLE_TYPE_MAP[type];
    if (type.endsWith("_restaurant") || type === "steak_house") return "restaurant";
    if (type.endsWith("_bar") || type === "pub") return "bar";
    if (type.includes("park") || type.endsWith("_garden")) return "park";
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
  primaryType?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: { name?: string; widthPx?: number; heightPx?: number }[];
  businessStatus?: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";
  editorialSummary?: { text?: string };
  addressComponents?: { longText?: string; types?: string[] }[];
}

function extractPlaceId(place: GooglePlace): string {
  if (place.id) return place.id;
  if (place.name) return place.name.replace("places/", "");
  return "";
}

function addressComponent(
  components: GooglePlace["addressComponents"] | undefined,
  type: string
): string | undefined {
  return components?.find((component) => (component.types ?? []).includes(type))?.longText;
}

function neighborhoodFromComponents(components?: GooglePlace["addressComponents"]): string | undefined {
  return (
    addressComponent(components, "neighborhood") ||
    addressComponent(components, "sublocality") ||
    addressComponent(components, "sublocality_level_1")
  );
}

const CITY_PREDICTION_TYPES = new Set([
  "locality",
  "postal_town",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "sublocality",
  "neighborhood",
  "political",
]);

const BUSINESS_SUGGESTION_TYPES = new Set([
  "restaurant",
  "cafe",
  "bar",
  "lodging",
  "store",
  "shopping_mall",
  "museum",
  "night_club",
  "park",
]);

export function destinationFromGooglePlace(place: GooglePlace): DestinationSuggestion | null {
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  if (latitude == null || longitude == null) return null;

  const types = place.types ?? [];
  if (types.some((type) => BUSINESS_SUGGESTION_TYPES.has(type))) return null;

  const city =
    addressComponent(place.addressComponents, "locality") ||
    addressComponent(place.addressComponents, "postal_town") ||
    addressComponent(place.addressComponents, "administrative_area_level_3") ||
    place.displayName?.text;
  const country = addressComponent(place.addressComponents, "country") || "";
  const state = addressComponent(place.addressComponents, "administrative_area_level_1");
  if (!city) return null;

  const usableState = state && state.toLowerCase() !== city.toLowerCase() ? state : undefined;
  const label = [city, usableState, country].filter(Boolean).join(", ");
  const placeId = extractPlaceId(place);
  return {
    id: placeId || label,
    label,
    city,
    country,
    state: usableState,
    latitude,
    longitude,
  };
}

function normalizePlace(
  place: GooglePlace,
  city: string,
  country: string
): NormalizedPlace {
  const placeId = extractPlaceId(place);
  const googleTypes = place.types ?? (place.primaryType ? [place.primaryType] : []);
  const normalized: NormalizedPlace = {
    id: `google_places_${placeId}`,
    provider: "google_places",
    providerPlaceId: placeId,
    name: place.displayName?.text ?? "",
    type: mapGoogleType(googleTypes),
    category: place.primaryType || googleTypes[0],
    subcategories: googleTypes.slice(0, 6),
    googleTypes,
    address: place.formattedAddress,
    city,
    country,
    neighborhood: neighborhoodFromComponents(place.addressComponents),
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    priceLevel: mapPriceLevel(place.priceLevel),
    mapsUrl: place.googleMapsUri,
    website: place.websiteUri,
    openingHours: place.regularOpeningHours?.weekdayDescriptions,
    photoUrls: googlePhotoUrls(place.photos),
    description: place.editorialSummary?.text,
    businessStatus: place.businessStatus,
    source: "verified",
    fetchedAt: new Date().toISOString(),
  };
  normalized.tags = deriveProviderTags(normalized);
  return normalized;
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
      const cacheKey = [
        "google-text",
        params.latitude?.toFixed(3) ?? "",
        params.longitude?.toFixed(3) ?? "",
        textQuery,
        params.type ?? "",
        params.pageToken ?? "",
        params.minPriceLevel ?? "",
        params.maxPriceLevel ?? "",
      ].join(":");
      const cached = getCached<PlaceSearchResult>(cacheKey);
      if (cached) return { ...cached, cached: true };

      const body: Record<string, unknown> = { textQuery, languageCode: "en" };
      if (params.pageToken) body.pageToken = params.pageToken;

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

      if (
        (params.minPriceLevel != null || params.maxPriceLevel != null) &&
        includedType !== "lodging"
      ) {
        body.priceLevels = googlePriceLevelEnums({
          min: params.minPriceLevel,
          max: params.maxPriceLevel,
        });
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

      const data = (await res.json()) as { places?: GooglePlace[]; nextPageToken?: string };
      const googlePlaces = data.places ?? [];

      let places = googlePlaces
        .filter((place) => !isExcludedGoogleTypes(place.types) && place.businessStatus !== "CLOSED_PERMANENTLY")
        .map((place) => normalizePlace(place, params.city, params.country ?? ""));

      if (params.minPriceLevel != null || params.maxPriceLevel != null) {
        places = places.filter((p) => {
          if (p.priceLevel == null) return true;
          if (params.minPriceLevel != null && p.priceLevel < params.minPriceLevel) return false;
          if (params.maxPriceLevel != null && p.priceLevel > params.maxPriceLevel) return false;
          return true;
        });
      }

      const limit = params.limit ?? places.length;
      places = places.slice(0, limit);

      const result: PlaceSearchResult = {
        places,
        totalFound: places.length,
        provider: this.name,
        cached: false,
        nextPageToken: data.nextPageToken,
      };
      setCache(cacheKey, result);
      return result;
    } catch (err) {
      console.error("[GooglePlaces] Search error:", err);
      return empty;
    }
  }

  async searchNearbyPopular(params: {
    includedType: string;
    latitude: number;
    longitude: number;
    city: string;
    country?: string;
    radiusMeters?: number;
    limit?: number;
  }): Promise<PlaceSearchResult> {
    const empty: PlaceSearchResult = {
      places: [],
      totalFound: 0,
      provider: this.name,
      cached: false,
    };
    if (!this.isConfigured()) return empty;

    try {
      const cacheKey = [
        "google-nearby",
        params.latitude.toFixed(3),
        params.longitude.toFixed(3),
        params.includedType,
      ].join(":");
      const cached = getCached<PlaceSearchResult>(cacheKey);
      if (cached) return { ...cached, cached: true };

      const body: Record<string, unknown> = {
        includedTypes: [params.includedType],
        languageCode: "en",
        maxResultCount: Math.min(params.limit ?? 20, 20),
        rankPreference: "POPULARITY",
        locationRestriction: {
          circle: {
            center: { latitude: params.latitude, longitude: params.longitude },
            radius: Math.min(params.radiusMeters ?? 30000, 50000),
          },
        },
      };

      const res = await fetch(`${GOOGLE_PLACES_BASE}/places:searchNearby`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": SEARCH_FIELD_MASK,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        console.warn("[GooglePlaces] Rate limited (429) on nearby search");
        return empty;
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(
          `[GooglePlaces] Nearby search failed: ${res.status} ${res.statusText}${detail ? ` ${detail.slice(0, 240)}` : ""}`
        );
        return empty;
      }

      const data = (await res.json()) as { places?: GooglePlace[] };
      const places = (data.places ?? [])
        .filter((place) => !isExcludedGoogleTypes(place.types) && place.businessStatus !== "CLOSED_PERMANENTLY")
        .map((place) => normalizePlace(place, params.city, params.country ?? ""));

      const result: PlaceSearchResult = {
        places,
        totalFound: places.length,
        provider: this.name,
        cached: false,
      };
      setCache(cacheKey, result);
      return result;
    } catch (err) {
      console.error("[GooglePlaces] Nearby search error:", err);
      return empty;
    }
  }

  async getPlaceDetails(placeId: string): Promise<NormalizedPlace | null> {
    if (!this.isConfigured()) return null;

    try {
      const cacheKey = `google-details:${placeId}`;
      const cached = getCached<NormalizedPlace>(cacheKey);
      if (cached) return cached;

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
      const city =
        addressComponent(place.addressComponents, "locality") ||
        addressComponent(place.addressComponents, "postal_town") ||
        this.extractCityFromAddress(place.formattedAddress);
      const country = addressComponent(place.addressComponents, "country") || "";
      const detailed = normalizeDetailedPlace(place, city, country);
      setCache(cacheKey, detailed);
      return detailed;
    } catch (err) {
      console.error("[GooglePlaces] Details error:", err);
      return null;
    }
  }

  async suggestDestinations(query: string): Promise<DestinationSuggestion[]> {
    if (!this.isConfigured()) return [];
    const cacheKey = `google-dest:${query.toLowerCase()}`;
    const cached = getCached<DestinationSuggestion[]>(cacheKey);
    if (cached) return cached;

    const fromAutocomplete = await this.autocompleteCities(query);
    const suggestions = fromAutocomplete.length ? fromAutocomplete : await this.searchCities(query);
    const unique: DestinationSuggestion[] = [];
    const seen = new Set<string>();
    for (const suggestion of suggestions) {
      const key = suggestion.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(suggestion);
    }
    const sliced = unique.slice(0, 6);
    setCache(cacheKey, sliced, 10 * 60 * 1000);
    return sliced;
  }

  async resolveCityLocation(
    city: string,
    country?: string
  ): Promise<{ latitude: number; longitude: number; city: string; country: string } | null> {
    const query = [city, country].filter(Boolean).join(", ");
    const matches = await this.searchCities(query);
    const match = matches[0];
    if (!match) return null;
    return {
      latitude: match.latitude,
      longitude: match.longitude,
      city: match.city,
      country: match.country || country || "",
    };
  }

  private async autocompleteCities(query: string): Promise<DestinationSuggestion[]> {
    try {
      const res = await fetch(`${GOOGLE_PLACES_BASE}/places:autocomplete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask":
            "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types",
        },
        body: JSON.stringify({
          input: query,
          languageCode: "en",
          includedPrimaryTypes: ["locality", "postal_town", "administrative_area_level_3"],
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.warn(`[GooglePlaces] Autocomplete failed: ${res.status}${detail ? ` ${detail.slice(0, 180)}` : ""}`);
        return [];
      }
      const data = (await res.json()) as {
        suggestions?: Array<{
          placePrediction?: { placeId?: string; types?: string[] };
        }>;
      };
      const placeIds = (data.suggestions ?? [])
        .map((item) => item.placePrediction)
        .filter((prediction): prediction is { placeId: string; types?: string[] } => Boolean(prediction?.placeId))
        .filter((prediction) => (prediction.types ?? []).some((type) => CITY_PREDICTION_TYPES.has(type)))
        .map((prediction) => prediction.placeId)
        .slice(0, 6);

      const details = await Promise.all(placeIds.map((placeId) => this.fetchRawPlace(placeId)));
      return details
        .map((place) => (place ? destinationFromGooglePlace(place) : null))
        .filter((item): item is DestinationSuggestion => Boolean(item));
    } catch (error) {
      console.warn("[GooglePlaces] Autocomplete error:", error);
      return [];
    }
  }

  private async searchCities(query: string): Promise<DestinationSuggestion[]> {
    try {
      const res = await fetch(`${GOOGLE_PLACES_BASE}/places:searchText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": SEARCH_FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: query,
          languageCode: "en",
          includedType: "locality",
          maxResultCount: 8,
        }),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { places?: GooglePlace[] };
      return (data.places ?? [])
        .map((place) => destinationFromGooglePlace(place))
        .filter((item): item is DestinationSuggestion => Boolean(item));
    } catch {
      return [];
    }
  }

  private async fetchRawPlace(placeId: string): Promise<GooglePlace | null> {
    const cacheKey = `google-raw:${placeId}`;
    const cached = getCached<GooglePlace>(cacheKey);
    if (cached) return cached;
    const resourceName = placeId.startsWith("places/") ? placeId : `places/${placeId}`;
    const res = await fetch(`${GOOGLE_PLACES_BASE}/${resourceName}`, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
      },
    });
    if (!res.ok) return null;
    const place = (await res.json()) as GooglePlace;
    setCache(cacheKey, place);
    return place;
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
