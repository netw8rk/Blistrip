import type {
  TravelDataProvider,
  PlaceSearchParams,
  PlaceSearchResult,
  NormalizedPlace,
  PlaceType,
  HotelSearchParams,
  HotelSearchResult,
  NormalizedHotel,
  ActivitySearchParams,
  ActivitySearchResult,
  NormalizedActivity,
  RouteParams,
  RouteResult,
} from "../types";
import { getCached, setCache } from "../cache";
import { haversineKm, estimateWalkMinutes, isWithinRadiusKm, DESTINATION_MATCH_KM } from "@/lib/planning/geo";

const USER_AGENT = "BlistripTravelPlanner/1.0 (https://blistrip.app; travel planning)";
const NOMINATIM = "https://nominatim.openstreetmap.org";
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const CATALOG_TTL = 30 * 60 * 1000;

interface GeoResult {
  lat: number;
  lon: number;
  city: string;
  country: string;
  state?: string;
}

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface CityPlaceCatalog {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  restaurants: NormalizedPlace[];
  cafes: NormalizedPlace[];
  bars: NormalizedPlace[];
  hotels: NormalizedHotel[];
  attractions: NormalizedPlace[];
}

export interface OsmCategoryQuery {
  id: string;
  overpass: string;
  nominatim: string;
}

export interface OsmQueryResult {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  places: NormalizedPlace[];
}

export class OpenStreetMapProvider implements TravelDataProvider {
  name = "openstreetmap";

  isConfigured(): boolean {
    return !process.env.GOOGLE_PLACES_API_KEY;
  }

  async searchPlaces(params: PlaceSearchParams): Promise<PlaceSearchResult> {
    const catalog = await this.getCatalog(params.city, params.country);
    if (!catalog) {
      return { places: [], totalFound: 0, provider: this.name, cached: false };
    }

    let places = this.placesFromCatalog(catalog, params.type);
    if (params.query) {
      const q = params.query.toLowerCase();
      places = places.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.type.includes(q.replace(/\s+/g, ""))
      );
      if (places.length === 0) {
        places = this.placesFromCatalog(catalog);
      }
    }

    const limit = Math.min(params.limit ?? 8, 12);
    places = places.slice(0, limit);

    return {
      places,
      totalFound: places.length,
      provider: this.name,
      cached: false,
    };
  }

  async getPlaceDetails(placeId: string): Promise<NormalizedPlace | null> {
    try {
      const osmId = placeId.replace("openstreetmap:", "");
      const [kind, id] = osmId.split("/");
      const prefix = kind === "way" ? "W" : kind === "relation" ? "R" : "N";
      const res = await fetch(
        `${NOMINATIM}/lookup?osm_ids=${prefix}${id}&format=json&addressdetails=1`,
        { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as Array<{
        display_name?: string;
        lat?: string;
        lon?: string;
        address?: { city?: string; town?: string; country?: string };
        name?: string;
      }>;
      const item = data[0];
      if (!item) return null;
      return {
        id: `openstreetmap_${osmId}`,
        provider: this.name,
        providerPlaceId: osmId,
        name: item.name || item.display_name?.split(",")[0] || "Unknown place",
        type: "other",
        address: item.display_name,
        city: item.address?.city || item.address?.town || "",
        country: item.address?.country || "",
        latitude: item.lat ? parseFloat(item.lat) : undefined,
        longitude: item.lon ? parseFloat(item.lon) : undefined,
        mapsUrl: `https://www.openstreetmap.org/${osmId}`,
        source: "verified",
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[OpenStreetMap] Details failed:", error);
      return null;
    }
  }

  async searchHotels(params: HotelSearchParams): Promise<HotelSearchResult> {
    const catalog = await this.getCatalog(params.city, params.country);
    const hotels = catalog?.hotels.slice(0, 8) ?? [];
    return { hotels, totalFound: hotels.length, provider: this.name, cached: false };
  }

  async searchActivities(params: ActivitySearchParams): Promise<ActivitySearchResult> {
    const catalog = await this.getCatalog(params.city, params.country);
    const activities: NormalizedActivity[] = (catalog?.attractions ?? [])
      .slice(0, params.limit ?? 8)
      .map((place) => ({ ...place }));
    return { activities, totalFound: activities.length, provider: this.name, cached: false };
  }

  async calculateRoute(params: RouteParams): Promise<RouteResult> {
    const km = haversineKm(
      params.origin.lat,
      params.origin.lng,
      params.destination.lat,
      params.destination.lng
    );
    const minutes =
      params.mode === "driving"
        ? Math.max(4, Math.ceil((km / 30) * 60))
        : params.mode === "transit"
          ? Math.max(8, Math.ceil((km / 18) * 60))
          : estimateWalkMinutes(km);

    return {
      distanceMeters: Math.round(km * 1000),
      distanceText: km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`,
      durationMinutes: minutes,
      durationText: `${minutes} min`,
      provider: this.name,
    };
  }

  async searchByQueries(
    city: string,
    country: string | undefined,
    queries: OsmCategoryQuery[],
    origin?: { lat: number; lon: number; state?: string }
  ): Promise<OsmQueryResult | null> {
    const cacheKey = origin
      ? `osm-exact:${origin.lat.toFixed(3)}:${origin.lon.toFixed(3)}:${queries.map((q) => q.id).sort().join(",")}`
      : `osm-exact:${city.toLowerCase()}:${(country ?? "").toLowerCase()}:${queries.map((q) => q.id).sort().join(",")}`;
    const cached = getCached<OsmQueryResult>(cacheKey);
    if (cached) return cached;

    const geo = origin
      ? {
          lat: origin.lat,
          lon: origin.lon,
          city,
          country: country ?? "",
          state: origin.state,
        }
      : await this.geocode(city, country);
    if (!geo) {
      console.warn(`[OpenStreetMap] Could not geocode "${city}"`);
      return null;
    }

    let elements = await this.queryOverpassFilters(geo.lat, geo.lon, queries, 10000);
    if (elements.length < 12) {
      const wider = await this.queryOverpassFilters(geo.lat, geo.lon, queries, 18000);
      if (wider.length > elements.length) elements = wider;
    }
    if (elements.length === 0) {
      elements = await this.queryNominatimForQueries(geo, queries);
    }
    elements = elements.filter((el) => elementNearOrigin(el, geo));

    const places: NormalizedPlace[] = [];
    const seen = new Set<string>();
    for (const el of elements) {
      const place = this.normalizeElement(el, geo);
      if (!place || !placeNearOrigin(place, geo)) continue;
      const key = `${place.name.toLowerCase()}|${place.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      places.push(place);
    }

    if (places.length === 0) return null;
    const result: OsmQueryResult = {
      city: geo.city,
      country: geo.country,
      latitude: geo.lat,
      longitude: geo.lon,
      places,
    };
    setCache(cacheKey, result, CATALOG_TTL);
    return result;
  }

  async getCatalog(city: string, country?: string): Promise<CityPlaceCatalog | null> {
    const cacheKey = `osm-catalog:${city.toLowerCase()}:${(country ?? "").toLowerCase()}`;
    const cached = getCached<CityPlaceCatalog>(cacheKey);
    if (cached) return cached;

    const geo = await this.geocode(city, country);
    if (!geo) {
      console.warn(`[OpenStreetMap] Could not geocode "${city}"`);
      return null;
    }

    let elements = await this.queryOverpass(geo.lat, geo.lon);
    if (elements.length === 0) {
      elements = await this.queryNominatimFallback(geo);
    }
    const catalog = this.buildCatalog(elements, geo);
    if (!hasCatalogPlaces(catalog)) return null;
    setCache(cacheKey, catalog, CATALOG_TTL);
    return catalog;
  }

  private async geocode(city: string, country?: string): Promise<GeoResult | null> {
    const cacheKey = `osm-geo:${city.toLowerCase()}:${(country ?? "").toLowerCase()}`;
    const cached = getCached<GeoResult>(cacheKey);
    if (cached) return cached;

    const query = [city, country].filter(Boolean).join(", ");
    try {
      const url = `${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Array<{
        lat: string;
        lon: string;
        address?: { city?: string; town?: string; village?: string; country?: string };
      }>;
      const first = data[0];
      if (!first) return null;
      const result: GeoResult = {
        lat: parseFloat(first.lat),
        lon: parseFloat(first.lon),
        city: first.address?.city || first.address?.town || first.address?.village || city,
        country: first.address?.country || country || "",
      };
      setCache(cacheKey, result, CATALOG_TTL);
      return result;
    } catch (error) {
      console.error("[OpenStreetMap] Geocode failed:", error);
      return null;
    }
  }

  private async queryOverpassFilters(
    lat: number,
    lon: number,
    queries: OsmCategoryQuery[],
    radiusMeters = 10000
  ): Promise<OsmElement[]> {
    const unions = queries
      .map((q) => `${q.overpass}(around:${radiusMeters},${lat},${lon});`)
      .join("\n  ");
    const query = `
[out:json][timeout:15];
(
  ${unions}
);
out center 70;
`;
    return this.runOverpass(query);
  }

  private async queryOverpass(lat: number, lon: number): Promise<OsmElement[]> {
    const query = `
[out:json][timeout:12];
(
  node["amenity"="restaurant"]["name"](around:1600,${lat},${lon});
  node["amenity"="cafe"]["name"](around:1600,${lat},${lon});
  node["amenity"~"^(bar|pub)$"]["name"](around:1600,${lat},${lon});
  node["tourism"~"^(hotel|hostel|guest_house)$"]["name"](around:1600,${lat},${lon});
  node["tourism"~"^(attraction|museum)$"]["name"](around:1600,${lat},${lon});
);
out body 40;
`;
    return this.runOverpass(query);
  }

  private async runOverpass(query: string): Promise<OsmElement[]> {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
          },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (!res.ok) {
          console.warn(`[OpenStreetMap] Overpass ${endpoint} returned ${res.status}`);
          continue;
        }
        const data = (await res.json()) as { elements?: OsmElement[] };
        return data.elements ?? [];
      } catch (error) {
        console.warn(`[OpenStreetMap] Overpass ${endpoint} failed:`, error);
      }
    }
    return [];
  }

  private async queryNominatimForQueries(
    geo: GeoResult,
    queries: OsmCategoryQuery[]
  ): Promise<OsmElement[]> {
    const elements: OsmElement[] = [];
    for (const search of queries) {
      try {
        const url = nominatimBoundedUrl(`${search.nominatim} in ${placeQuery(geo)}`, geo, 8);
        const res = await fetch(url, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        });
        if (!res.ok) continue;
        const data = (await res.json()) as Array<{
          osm_type?: string;
          osm_id?: number;
          lat?: string;
          lon?: string;
          name?: string;
          display_name?: string;
          type?: string;
          class?: string;
        }>;
        for (const item of data) {
          if (!item.osm_id) continue;
          const name = item.name || item.display_name?.split(",")[0];
          if (!name) continue;
          elements.push({
            type: (item.osm_type as OsmElement["type"]) || "node",
            id: item.osm_id,
            lat: item.lat ? parseFloat(item.lat) : undefined,
            lon: item.lon ? parseFloat(item.lon) : undefined,
            tags: {
              name,
              amenity: item.class === "amenity" ? item.type ?? "" : "",
              tourism: item.class === "tourism" ? item.type ?? "" : "",
              historic: item.class === "historic" ? item.type ?? "yes" : "",
              leisure: item.class === "leisure" ? item.type ?? "" : "",
              shop: item.class === "shop" ? item.type ?? "" : "",
              "addr:street": item.display_name ?? "",
            },
          });
        }
        await sleep(1100);
      } catch (error) {
        console.warn("[OpenStreetMap] Nominatim preference search failed:", error);
      }
    }
    return elements;
  }

  private async queryNominatimFallback(geo: GeoResult): Promise<OsmElement[]> {
    const place = placeQuery(geo);
    const searches = [
      { q: `restaurants in ${place}`, amenity: "restaurant" },
      { q: `cafes in ${place}`, amenity: "cafe" },
      { q: `bars in ${place}`, amenity: "bar" },
      { q: `hotels in ${place}`, tourism: "hotel" },
      { q: `museums in ${place}`, tourism: "museum" },
    ];
    const elements: OsmElement[] = [];

    for (const search of searches) {
      try {
        const url = nominatimBoundedUrl(search.q, geo, 6);
        const res = await fetch(url, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        });
        if (!res.ok) continue;
        const data = (await res.json()) as Array<{
          osm_type?: string;
          osm_id?: number;
          lat?: string;
          lon?: string;
          name?: string;
          display_name?: string;
          type?: string;
          class?: string;
        }>;
        for (const item of data) {
          if (!item.osm_id) continue;
          const name = item.name || item.display_name?.split(",")[0];
          if (!name) continue;
          elements.push({
            type: (item.osm_type as OsmElement["type"]) || "node",
            id: item.osm_id,
            lat: item.lat ? parseFloat(item.lat) : undefined,
            lon: item.lon ? parseFloat(item.lon) : undefined,
            tags: {
              name,
              amenity: search.amenity ?? "",
              tourism: search.tourism ?? item.type ?? "",
              "addr:street": item.display_name ?? "",
            },
          });
        }
        await sleep(1100);
      } catch (error) {
        console.warn("[OpenStreetMap] Nominatim fallback search failed:", error);
      }
    }

    return elements;
  }

  private buildCatalog(elements: OsmElement[], geo: GeoResult): CityPlaceCatalog {
    const restaurants: NormalizedPlace[] = [];
    const cafes: NormalizedPlace[] = [];
    const bars: NormalizedPlace[] = [];
    const hotels: NormalizedHotel[] = [];
    const attractions: NormalizedPlace[] = [];
    const seen = new Set<string>();

    for (const el of elements) {
      const place = this.normalizeElement(el, geo);
      if (!place) continue;
      const key = place.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      if (place.type === "hotel" || place.type === "hostel") {
        hotels.push({ ...place, type: place.type === "hostel" ? "hostel" : "hotel" });
      } else if (place.type === "restaurant") {
        restaurants.push(place);
      } else if (place.type === "cafe") {
        cafes.push(place);
      } else if (place.type === "bar" || place.type === "nightclub") {
        bars.push(place);
      } else {
        attractions.push(place);
      }
    }

    return {
      city: geo.city,
      country: geo.country,
      latitude: geo.lat,
      longitude: geo.lon,
      restaurants: restaurants.slice(0, 12),
      cafes: cafes.slice(0, 8),
      bars: bars.slice(0, 8),
      hotels: hotels.slice(0, 8),
      attractions: attractions.slice(0, 16),
    };
  }

  private normalizeElement(el: OsmElement, geo: GeoResult): NormalizedPlace | null {
    const tags = el.tags ?? {};
    const name = tags.name?.trim();
    if (!name) return null;
    if (["supermarket", "convenience", "greengrocer", "grocery", "general"].includes(tags.shop ?? "")) {
      return null;
    }

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const type = mapOsmType(tags);
    const osmId = `${el.type}/${el.id}`;
    const address = formatAddress(tags);

    return {
      id: `openstreetmap_${osmId}`,
      provider: this.name,
      providerPlaceId: osmId,
      name,
      type,
      category: tags.cuisine || tags.historic || tags.tourism || tags.leisure || tags.amenity || tags.shop,
      address,
      city: geo.city,
      country: geo.country,
      latitude: lat,
      longitude: lon,
      website: tags.website || tags["contact:website"],
      phone: tags.phone || tags["contact:phone"],
      openingHours: tags.opening_hours ? [tags.opening_hours] : undefined,
      mapsUrl: `https://www.openstreetmap.org/${osmId}`,
      osmTags: tags,
      source: "verified",
      fetchedAt: new Date().toISOString(),
    };
  }

  private placesFromCatalog(catalog: CityPlaceCatalog, type?: PlaceType | PlaceType[]): NormalizedPlace[] {
    const all = [
      ...catalog.restaurants,
      ...catalog.cafes,
      ...catalog.bars,
      ...catalog.hotels,
      ...catalog.attractions,
    ];
    if (!type) return all;
    const types = Array.isArray(type) ? type : [type];
    return all.filter((p) => types.includes(p.type));
  }
}

function mapOsmType(tags: Record<string, string>): PlaceType {
  const amenity = tags.amenity;
  const tourism = tags.tourism;
  const leisure = tags.leisure;
  const shop = tags.shop;
  if (amenity === "restaurant" || amenity === "fast_food") return "restaurant";
  if (amenity === "cafe") return "cafe";
  if (amenity === "bar" || amenity === "pub") return "bar";
  if (amenity === "nightclub") return "nightclub";
  if (amenity === "marketplace") return "market";
  if (amenity === "place_of_worship") return "church";
  if (tourism === "hotel" || tourism === "guest_house") return "hotel";
  if (tourism === "hostel") return "hostel";
  if (tourism === "museum") return "museum";
  if (tourism === "attraction" || tourism === "viewpoint") return "attraction";
  if (leisure === "park" || leisure === "garden" || tags.natural === "beach") return "park";
  if (leisure === "sports_centre" || leisure === "fitness_centre" || leisure === "swimming_pool") return "activity";
  if (shop) return "shop";
  if (tags.historic) return "landmark";
  if (tourism === "attraction") return "attraction";
  return "other";
}

function placeQuery(geo: GeoResult): string {
  return [geo.city, geo.state, geo.country].filter(Boolean).join(", ");
}

function nominatimBoundedUrl(query: string, geo: GeoResult, limit: number): string {
  const pad = 0.28;
  const viewbox = `${geo.lon - pad},${geo.lat + pad},${geo.lon + pad},${geo.lat - pad}`;
  return `${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}&addressdetails=1&viewbox=${viewbox}&bounded=1`;
}

function elementNearOrigin(el: OsmElement, geo: GeoResult): boolean {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return false;
  return isWithinRadiusKm(lat, lon, geo.lat, geo.lon);
}

function placeNearOrigin(place: NormalizedPlace, geo: GeoResult): boolean {
  if (place.latitude == null || place.longitude == null) return false;
  return isWithinRadiusKm(place.latitude, place.longitude, geo.lat, geo.lon);
}

function formatAddress(tags: Record<string, string>): string | undefined {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:suburb"] || tags["addr:neighbourhood"],
    tags["addr:city"],
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

export function mapOsmTypeForTest(tags: Record<string, string>): PlaceType {
  return mapOsmType(tags);
}

function hasCatalogPlaces(catalog: CityPlaceCatalog): boolean {
  return (
    catalog.restaurants.length +
      catalog.cafes.length +
      catalog.bars.length +
      catalog.hotels.length +
      catalog.attractions.length >
    0
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
