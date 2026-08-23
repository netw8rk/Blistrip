import type {
  ActivityRecommendation,
  HotelRecommendation,
  RestaurantRecommendation,
  TripPlan,
} from "@/types/trip";
import type { PlannedActivity, StructuredItineraryDraft } from "@/lib/planning/types";
import type { NormalizedHotel, NormalizedPlace } from "./types";
import { OpenStreetMapProvider, type CityPlaceCatalog } from "./providers/openstreetmap";
import { GooglePlacesProvider } from "./providers/google-places";

export interface VerifiedTripPlaces {
  city: string;
  country: string;
  restaurants: NormalizedPlace[];
  hotels: NormalizedHotel[];
  attractions: NormalizedPlace[];
  bars: NormalizedPlace[];
  cafes: NormalizedPlace[];
  provider: string;
}

const osm = new OpenStreetMapProvider();
const google = new GooglePlacesProvider();

export async function fetchVerifiedTripPlaces(
  city: string,
  country?: string,
  interests: string[] = []
): Promise<VerifiedTripPlaces | null> {
  if (!city.trim()) return null;

  if (google.isConfigured()) {
    const catalog = await googleCityCatalog(city, country);
    if (catalog && hasAnyPlaces(catalog)) {
      return catalogToVerified(catalog, city, country, interests, "google_places");
    }
  }

  const catalog = await osm.getCatalog(city, country);
  if (catalog && hasAnyPlaces(catalog)) {
    return catalogToVerified(catalog, city, country, interests, "openstreetmap");
  }

  return null;
}

function catalogToVerified(
  catalog: CityPlaceCatalog,
  city: string,
  country: string | undefined,
  interests: string[],
  provider: string
): VerifiedTripPlaces {
  return {
    city: catalog.city || city,
    country: catalog.country || country || "",
    restaurants: pickForInterests(catalog.restaurants, interests, 8),
    hotels: catalog.hotels.slice(0, 4),
    attractions: pickForInterests(catalog.attractions, interests, 12),
    bars: catalog.bars.slice(0, 6),
    cafes: catalog.cafes.slice(0, 4),
    provider,
  };
}

async function googleCityCatalog(city: string, country?: string): Promise<CityPlaceCatalog | null> {
  const geo = await google.resolveCityLocation(city, country);
  if (!geo) return null;
  const base = {
    city: geo.city || city,
    country: geo.country || country,
    latitude: geo.latitude,
    longitude: geo.longitude,
    radiusMeters: 30000,
    limit: 12,
  };
  const [restaurants, cafes, bars, hotels, attractions] = await Promise.all([
    google.searchPlaces({ ...base, query: `restaurants in ${city}`, type: "restaurant" }),
    google.searchPlaces({ ...base, query: `cafes in ${city}`, type: "cafe" }),
    google.searchPlaces({ ...base, query: `bars in ${city}`, type: "bar" }),
    google.searchPlaces({ ...base, query: `hotels in ${city}`, type: "hotel" }),
    google.searchPlaces({ ...base, query: `attractions in ${city}`, type: "attraction" }),
  ]);
  return {
    city: geo.city || city,
    country: geo.country || country || "",
    latitude: geo.latitude,
    longitude: geo.longitude,
    restaurants: restaurants.places,
    cafes: cafes.places,
    bars: bars.places,
    hotels: hotels.places.filter((place): place is CityPlaceCatalog["hotels"][number] =>
      place.type === "hotel" || place.type === "hostel" || place.type === "apartment"
    ),
    attractions: attractions.places,
  };
}

function hasAnyPlaces(catalog: CityPlaceCatalog): boolean {
  return (
    catalog.restaurants.length +
      catalog.hotels.length +
      catalog.attractions.length +
      catalog.bars.length +
      catalog.cafes.length >
    0
  );
}

function pickForInterests(places: NormalizedPlace[], interests: string[], limit: number): NormalizedPlace[] {
  if (places.length <= limit) return places;
  const interestKeys = interests.map((i) => i.toLowerCase());
  const scored = places.map((place) => {
    const haystack = `${place.name} ${place.category ?? ""} ${place.type}`.toLowerCase();
    const score = interestKeys.reduce((sum, key) => (haystack.includes(key) ? sum + 1 : sum), 0);
    return { place, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.place);
}

export function applyVerifiedPlacesToPlan(
  plan: Omit<TripPlan, "id" | "createdAt">,
  verified: VerifiedTripPlaces,
  interests: string[]
): Omit<TripPlan, "id" | "createdAt"> {
  const next = { ...plan };
  const reasons = indexReasons(plan);

  if (verified.hotels.length > 0) {
    next.hotelRecommendations = verified.hotels.slice(0, 3).map((hotel) =>
      toHotelRecommendation(hotel, reasons.get(hotel.name.toLowerCase()))
    );
  }

  const dining = selectDining(verified, interests);
  if (dining.length > 0) {
    next.restaurants = dining.map((place, index) =>
      toRestaurantRecommendation(place, index, reasons.get(place.name.toLowerCase()))
    );
  }

  if (verified.attractions.length > 0) {
    const verifiedActivities = verified.attractions.slice(0, 8).map((place) =>
      toActivityRecommendation(place, reasons.get(place.name.toLowerCase()))
    );
    const existingNames = new Set(verifiedActivities.map((a) => a.name.toLowerCase()));
    const extras = (plan.activities ?? []).filter((a) => !existingNames.has(a.name.toLowerCase())).slice(0, 4);
    next.activities = [...verifiedActivities, ...extras];
  }

  if (verified.city) next.destination = plan.destination || verified.city;
  if (verified.country && (!plan.country || plan.country === "Europe")) {
    next.country = verified.country;
  }

  return next;
}

function selectDining(verified: VerifiedTripPlaces, interests: string[]): NormalizedPlace[] {
  const wantsNightlife = interests.some((i) => /night|bar|drink/i.test(i));
  const restaurants = verified.restaurants.slice(0, 4);
  const cafes = verified.cafes.slice(0, 1);
  const bars = wantsNightlife ? verified.bars.slice(0, 2) : verified.bars.slice(0, 1);
  const combined = [...restaurants, ...cafes, ...bars];
  const seen = new Set<string>();
  return combined.filter((place) => {
    const key = place.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function indexReasons(plan: Omit<TripPlan, "id" | "createdAt">): Map<string, string> {
  const map = new Map<string, string>();
  for (const hotel of plan.hotelRecommendations ?? []) {
    if (hotel.whyRecommended) map.set(hotel.name.toLowerCase(), hotel.whyRecommended);
  }
  for (const restaurant of plan.restaurants ?? []) {
    if (restaurant.whyRecommended) map.set(restaurant.name.toLowerCase(), restaurant.whyRecommended);
  }
  for (const activity of plan.activities ?? []) {
    if (activity.whyRecommended) map.set(activity.name.toLowerCase(), activity.whyRecommended);
  }
  return map;
}

export function toHotelRecommendation(place: NormalizedHotel, why?: string): HotelRecommendation {
  return {
    name: place.name,
    description: place.address
      ? `${place.address}`
      : `${titleCase(place.type)} in ${place.city}.`,
    priceRange: formatPriceLevel(place.priceLevel) ?? "Check current rates",
    whyRecommended:
      why ?? `${titleCase(place.type)} in ${place.city}${place.address ? ` at ${place.address}` : ""}.`,
    rating: place.rating ?? 0,
    reviewCount: place.reviewCount,
    bookingUrl: place.bookingUrl || place.mapsUrl || "",
    neighborhood: place.neighborhood,
    provider: place.provider,
    providerPlaceId: place.providerPlaceId,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    mapsUrl: place.mapsUrl,
    website: place.website,
    photoUrl: place.photoUrls?.[0],
    source: "verified",
  };
}

export function toRestaurantRecommendation(
  place: NormalizedPlace,
  index: number,
  why?: string
): RestaurantRecommendation {
  const category = index < 2 ? "cheap" : index < 4 ? "mid-range" : "special-occasion";
  return {
    name: place.name,
    cuisine: formatCuisine(place.category) || titleCase(place.type),
    priceRange: place.priceLevel ? "$".repeat(Math.min(place.priceLevel, 4)) : "–",
    whyRecommended:
      why ?? `${titleCase(place.type)} in ${place.city}${place.address ? ` · ${place.address}` : ""}.`,
    location: place.address || place.city,
    category,
    bookingUrl: place.mapsUrl || place.website || "",
    provider: place.provider,
    providerPlaceId: place.providerPlaceId,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    rating: place.rating,
    reviewCount: place.reviewCount,
    mapsUrl: place.mapsUrl,
    website: place.website,
    photoUrl: place.photoUrls?.[0],
    source: "verified",
  };
}

export function toActivityRecommendation(place: NormalizedPlace, why?: string): ActivityRecommendation {
  return {
    name: place.name,
    description: place.address ? place.address : `${titleCase(place.type)} in ${place.city}.`,
    price: formatPriceLevel(place.priceLevel) ?? "Check locally",
    duration: place.type === "museum" ? "1–2 hours" : "1–3 hours",
    whyRecommended: why ?? `${titleCase(place.type)} in ${place.city}${place.address ? ` · ${place.address}` : ""}.`,
    bookingUrl: place.mapsUrl || place.website || "",
    category: titleCase(place.type),
    provider: place.provider,
    providerPlaceId: place.providerPlaceId,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    rating: place.rating,
    reviewCount: place.reviewCount,
    mapsUrl: place.mapsUrl,
    website: place.website,
    photoUrl: place.photoUrls?.[0],
    source: "verified",
  };
}

export function buildDraftFromVerifiedPlaces(
  verified: VerifiedTripPlaces,
  duration: number,
  pace: string
): StructuredItineraryDraft {
  const stops = [
    ...verified.attractions,
    ...verified.cafes.slice(0, 2),
    ...verified.bars.slice(0, 2),
    ...verified.restaurants.slice(0, 3),
  ];
  const unique: NormalizedPlace[] = [];
  const seen = new Set<string>();
  for (const place of stops) {
    const key = place.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(place);
  }

  const slotsPerDay = pace === "slow" ? 3 : pace === "packed" ? 6 : 4;
  const days = Array.from({ length: Math.max(1, duration) }, (_, dayIndex) => {
    const start = dayIndex * slotsPerDay;
    const dayPlaces = unique.slice(start, start + slotsPerDay);
    const morning = dayPlaces.slice(0, 1).map((p) => toPlanned(p, "morning"));
    const afternoon = dayPlaces.slice(1, 3).map((p) => toPlanned(p, "afternoon"));
    const evening = dayPlaces.slice(3).map((p) => toPlanned(p, "evening"));

    if (morning.length === 0 && unique[dayIndex]) {
      morning.push(toPlanned(unique[dayIndex], "morning"));
    }

    return {
      day: dayIndex + 1,
      title: dayIndex === 0 ? `Arrive in ${verified.city}` : `Explore ${verified.city}`,
      morning,
      afternoon,
      evening,
    };
  });

  return {
    destination: verified.city,
    country: verified.country,
    duration,
    pace,
    days,
    selectedAttractionIds: unique.map((p) => p.id),
    geographicNotes: [`Stops grouped so nearby places in ${verified.city} stay on the same day.`],
  };
}

function toPlanned(place: NormalizedPlace, slot: string): PlannedActivity {
  return {
    id: place.id,
    name: place.name,
    type: place.type,
    description: place.address ?? `${titleCase(place.type)} in ${place.city}`,
    neighborhood: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    durationMinutes: place.type === "museum" ? 90 : 75,
    estimatedCostLevel: "check locally",
    reason: `${titleCase(place.type)} in ${place.city} for a ${slot} stop.`,
    reservationRecommended: place.type === "restaurant",
    source: "verified",
    provider: place.provider,
    providerPlaceId: place.providerPlaceId,
    address: place.address,
    mapsUrl: place.mapsUrl,
    photoUrl: place.photoUrls?.[0],
  };
}

export function formatVerifiedPlacesForPrompt(verified: VerifiedTripPlaces): string {
  let section = `\n--- VERIFIED PLACES IN ${verified.city.toUpperCase()} (USE ONLY THESE FOR REAL-WORLD RECS) ---\n`;
  section += `These places were retrieved from ${verified.provider}. Do NOT invent other hotels, restaurants, or attractions.\n`;
  section += `You may write why they fit the user, but keep the names, addresses, and IDs exactly.\n`;

  if (verified.hotels.length) {
    section += `\nHOTELS:\n`;
    for (const h of verified.hotels) {
      section += `- ${h.name} [${h.providerPlaceId}] ${h.address ?? ""} ${h.mapsUrl ?? ""}\n`;
    }
  }
  if (verified.restaurants.length) {
    section += `\nRESTAURANTS:\n`;
    for (const r of verified.restaurants) {
      section += `- ${r.name} [${r.providerPlaceId}] ${r.category ?? r.type} ${r.address ?? ""}\n`;
    }
  }
  if (verified.bars.length) {
    section += `\nBARS / NIGHTLIFE:\n`;
    for (const b of verified.bars) {
      section += `- ${b.name} [${b.providerPlaceId}] ${b.address ?? ""}\n`;
    }
  }
  if (verified.attractions.length) {
    section += `\nATTRACTIONS:\n`;
    for (const a of verified.attractions) {
      section += `- ${a.name} [${a.providerPlaceId}] ${a.type} ${a.address ?? ""}\n`;
    }
  }
  section += `--- END VERIFIED PLACES ---\n`;
  return section;
}

function formatCuisine(value?: string): string {
  if (!value) return "";
  return value
    .split(/[;,_]/)
    .map((part) => titleCase(part.trim()))
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
}

function titleCase(value: string): string {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPriceLevel(level?: number): string | undefined {
  if (level == null) return undefined;
  if (level === 0) return "Free";
  return "$".repeat(Math.min(level, 4));
}
