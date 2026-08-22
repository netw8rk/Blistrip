import type { DailyItinerary, ItineraryActivity, TripPlan } from "@/types/trip";
import type { NormalizedPlace, PlaceType } from "./types";
import {
  toActivityRecommendation,
  toHotelRecommendation,
  toRestaurantRecommendation,
} from "./fetch-trip-places";
import type { UserTripPreferences } from "@/lib/planning/preferences";
import { activitiesPerDay } from "@/lib/planning/preferences";
import { orderByProximity, isWithinRadiusKm, DESTINATION_MATCH_KM } from "@/lib/planning/geo";
import type { BudgetEstimate, PlannedActivity, StructuredItineraryDraft } from "@/lib/planning/types";
import { draftToDailyItinerary } from "@/lib/planning/merge";
import { OpenStreetMapProvider, type OsmCategoryQuery } from "./providers/openstreetmap";

export interface RankedPlace {
  place: NormalizedPlace;
  score: number;
  reasons: string[];
}

export interface PlaceRetrievalResult {
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  searches: string[];
  retrievedCount: number;
  filteredCount: number;
  ranked: RankedPlace[];
  selected: RankedPlace[];
  hotels: RankedPlace[];
  restaurants: RankedPlace[];
  diningAndNightlife: RankedPlace[];
}

const osm = new OpenStreetMapProvider();

export function buildOsmQueries(prefs: UserTripPreferences): OsmCategoryQuery[] {
  const s = prefs.scores;
  const queries: OsmCategoryQuery[] = [];

  const add = (query: OsmCategoryQuery, score: number) => {
    if (score >= 6) queries.push(query);
  };

  add(
    {
      id: "restaurants",
      overpass: `node["amenity"="restaurant"]["name"]`,
      nominatim: "restaurants",
    },
    s.food
  );
  add(
    {
      id: "cafes",
      overpass: `node["amenity"="cafe"]["name"]`,
      nominatim: "cafes",
    },
    Math.max(s.food, s.relaxation)
  );
  add(
    {
      id: "markets",
      overpass: `nwr["amenity"="marketplace"]["name"]`,
      nominatim: "food markets",
    },
    Math.max(s.food, s.localExperiences)
  );
  add(
    {
      id: "nightlife",
      overpass: `node["amenity"~"^(bar|pub|nightclub)$"]["name"]`,
      nominatim: "bars",
    },
    s.nightlife
  );
  add(
    {
      id: "museums",
      overpass: `nwr["tourism"="museum"]["name"]`,
      nominatim: "museums",
    },
    Math.max(s.culture, s.history)
  );
  add(
    {
      id: "historic",
      overpass: `nwr["historic"]["name"]`,
      nominatim: "historic sites",
    },
    Math.max(s.history, s.architecture)
  );
  add(
    {
      id: "architecture",
      overpass: `nwr["amenity"="place_of_worship"]["name"]`,
      nominatim: "churches landmarks",
    },
    s.architecture
  );
  add(
    {
      id: "parks",
      overpass: `nwr["leisure"~"^(park|garden)$"]["name"]`,
      nominatim: "parks",
    },
    Math.max(s.nature, s.relaxation)
  );
  add(
    {
      id: "viewpoints",
      overpass: `nwr["tourism"="viewpoint"]["name"]`,
      nominatim: "viewpoints",
    },
    Math.max(s.nature, s.adventure)
  );
  add(
    {
      id: "beaches",
      overpass: `nwr["natural"="beach"]["name"]`,
      nominatim: "beaches",
    },
    s.beaches
  );
  add(
    {
      id: "shopping",
      overpass: `node["shop"~"^(mall|department_store|clothes|gift)$"]["name"]`,
      nominatim: "shops",
    },
    s.shopping
  );
  add(
    {
      id: "adventure",
      overpass: `nwr["leisure"~"^(sports_centre|fitness_centre|swimming_pool)$"]["name"]`,
      nominatim: "outdoor activities",
    },
    s.adventure
  );

  if (s.localExperiences >= 7 && !queries.some((q) => q.id === "nightlife")) {
    queries.push({
      id: "local-pubs",
      overpass: `node["amenity"="pub"]["name"]`,
      nominatim: "local pubs",
    });
  }

  if (queries.length === 0) {
    queries.push({
      id: "attractions",
      overpass: `nwr["tourism"="attraction"]["name"]`,
      nominatim: "attractions",
    });
  }

  queries.push({
    id: "hotels",
    overpass: `nwr["tourism"~"^(hotel|hostel|guest_house)$"]["name"]`,
    nominatim: "hotels",
  });

  return queries.slice(0, 7);
}

export async function retrievePersonalizedPlaces(
  prefs: UserTripPreferences
): Promise<PlaceRetrievalResult | null> {
  const queries = buildOsmQueries(prefs);
  const searches = queries.map((q) => q.id);
  const raw = await osm.searchByQueries(
    prefs.destination,
    prefs.country,
    queries,
    prefs.latitude != null && prefs.longitude != null
      ? { lat: prefs.latitude, lon: prefs.longitude, state: prefs.state }
      : undefined
  );
  if (!raw) return null;

  const retrievedCount = raw.places.length;
  const origin =
    prefs.latitude != null && prefs.longitude != null
      ? { lat: prefs.latitude, lon: prefs.longitude }
      : raw.latitude != null && raw.longitude != null
        ? { lat: raw.latitude, lon: raw.longitude }
        : null;
  const filtered = raw.places.filter((place) => {
    if (!isUsablePlace(place)) return false;
    if (!origin || place.latitude == null || place.longitude == null) return false;
    return isWithinRadiusKm(place.latitude, place.longitude, origin.lat, origin.lon, DESTINATION_MATCH_KM);
  });
  const ranked = rankPlaces(filtered, prefs);
  const hotels = ranked.filter((r) => r.place.type === "hotel" || r.place.type === "hostel");
  const restaurants = ranked.filter((r) =>
    ["restaurant", "cafe", "market"].includes(r.place.type)
  );
  const diningAndNightlife = ranked.filter((r) =>
    ["restaurant", "cafe", "bar", "nightclub", "market"].includes(r.place.type)
  );
  const dayPlaces = ranked.filter(
    (r) => !["hotel", "hostel", "apartment"].includes(r.place.type)
  );

  const needed = Math.max(prefs.tripLength * activitiesPerDay(prefs), prefs.tripLength * 3);
  const selected = pickDiverseSelection(dayPlaces, Math.max(needed, 24), prefs);

  return {
    city: raw.city,
    country: raw.country,
    latitude: raw.latitude,
    longitude: raw.longitude,
    searches,
    retrievedCount,
    filteredCount: filtered.length,
    ranked: ranked.slice(0, 40),
    selected,
    hotels: hotels.slice(0, 6),
    restaurants: restaurants.slice(0, 10),
    diningAndNightlife: diningAndNightlife.slice(0, 12),
  };
}

export function rankPlaces(places: NormalizedPlace[], prefs: UserTripPreferences): RankedPlace[] {
  return places
    .map((place) => scorePlace(place, prefs))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function scorePlace(place: NormalizedPlace, prefs: UserTripPreferences): RankedPlace {
  const reasons: string[] = [];
  let score = 8;
  const s = prefs.scores;
  const type = place.type;
  const tags = place.osmTags ?? {};
  const haystack = `${place.name} ${place.category ?? ""} ${type} ${Object.values(tags).join(" ")}`.toLowerCase();

  const add = (points: number, reason: string) => {
    if (points <= 0) return;
    score += points;
    reasons.push(reason);
  };

  if (type === "restaurant" || type === "cafe" || type === "market") add(s.food * 4, "matches food interest");
  if (type === "bar" || type === "nightclub") add(s.nightlife * 5, "matches nightlife interest");
  if (type === "museum") add(Math.max(s.culture, s.history) * 4, "matches culture/history");
  if (type === "landmark" || type === "church" || tags.historic) {
    add(Math.max(s.history, s.architecture) * 4, "matches history/architecture");
  }
  if (type === "park") add(Math.max(s.nature, s.relaxation) * 4, "matches nature/relaxation");
  if (type === "shop") add(s.shopping * 4, "matches shopping");
  if (type === "activity") add(s.adventure * 4, "matches adventure");
  if (type === "attraction") add(Math.max(s.history, s.architecture, s.culture) * 2, "general attraction");

  if (prefs.dislikes.includes("museums") && (type === "museum" || /museum/.test(haystack))) {
    score -= 80;
    reasons.push("filtered: user avoids museums");
  }
  if (prefs.dislikes.includes("nightlife") && (type === "bar" || type === "nightclub")) {
    score -= 80;
    reasons.push("filtered: user avoids nightlife");
  }

  if (prefs.localVsTouristy === "local") {
    if (["bar", "cafe", "market"].includes(type) || tags.amenity === "pub") {
      add(18, "local/neighborhood venue");
    }
    if (tags.tourism === "attraction" || tags.wikipedia) {
      score -= 12;
      reasons.push("less tourist-centric preferred");
    }
  }

  if (prefs.budgetLevel === "low") {
    if (["cafe", "market", "park", "hostel"].includes(type)) add(10, "budget-friendly type");
    if (type === "hotel" && prefs.travelStyle !== "Luxury") score -= 4;
  }
  if (prefs.budgetLevel === "high" && (type === "hotel" || tags.tourism === "attraction")) {
    add(6, "fits higher-budget trip");
  }

  const metadataBits = [place.address, place.website, place.openingHours?.length, place.latitude].filter(Boolean).length;
  add(metadataBits * 2, "useful OSM metadata");

  if (prefs.travelers === "Family" && (type === "nightclub" || tags.amenity === "nightclub")) {
    score -= 20;
    reasons.push("less suitable for family trip");
  }

  return { place, score: Math.max(0, score), reasons: reasons.slice(0, 3) };
}

export function buildDraftFromRankedPlaces(
  retrieval: PlaceRetrievalResult,
  prefs: UserTripPreferences
): StructuredItineraryDraft {
  const afternoonCount = prefs.pace === "slow" ? 1 : prefs.pace === "packed" ? 2 : 1;
  const used = new Set<string>();

  const daytime = uniquePlaces([
    ...retrieval.selected,
    ...retrieval.ranked,
  ]).filter((item) => isDaytimeType(item.place.type) && !used.has(item.place.id));

  const eveningPool = uniquePlaces([
    ...retrieval.diningAndNightlife,
    ...retrieval.restaurants,
    ...retrieval.ranked.filter((item) => isEveningType(item.place.type)),
  ]);

  const dayBuckets = dealRoundRobin(orderPlaces(daytime), prefs.tripLength);
  const eveningBuckets = dealRoundRobin(orderPlaces(eveningPool), prefs.tripLength);

  const days = Array.from({ length: prefs.tripLength }, (_, index) => {
    const dayNum = index + 1;
    const dayItems = dayBuckets[index] ?? [];
    const nightItems = eveningBuckets[index] ?? [];

    const morningItem = dayItems[0];
    const afternoonItems = dayItems.slice(1, 1 + afternoonCount);
    const eveningItem = nightItems[0] ?? dayItems[1 + afternoonCount];

    if (morningItem) used.add(morningItem.place.id);
    for (const item of afternoonItems) used.add(item.place.id);
    if (eveningItem) used.add(eveningItem.place.id);

    return {
      day: dayNum,
      title: dayNum === 1 ? `Arrive and explore ${prefs.destination}` : `${prefs.destination} · Day ${dayNum}`,
      morning: morningItem ? [toPlanned(morningItem, prefs)] : [],
      afternoon: afternoonItems.map((item) => toPlanned(item, prefs)),
      evening: eveningItem ? [toPlanned(eveningItem, prefs)] : [],
    };
  });

  fillEmptySlots(days, [...daytime, ...eveningPool], used, prefs);

  return {
    destination: prefs.destination || retrieval.city,
    country: prefs.country || retrieval.country,
    duration: prefs.tripLength,
    pace: prefs.pace,
    days,
    selectedAttractionIds: [...used],
    geographicNotes: [
      `Each day has morning, afternoon, and evening stops when enough OSM places exist.`,
    ],
  };
}

function isDaytimeType(type: PlaceType): boolean {
  return ["attraction", "museum", "landmark", "park", "church", "shop", "market", "activity", "other"].includes(type);
}

function isEveningType(type: PlaceType): boolean {
  return ["bar", "nightclub", "restaurant", "cafe"].includes(type);
}

function uniquePlaces(items: RankedPlace[]): RankedPlace[] {
  const seen = new Set<string>();
  const unique: RankedPlace[] = [];
  for (const item of items) {
    if (seen.has(item.place.id)) continue;
    seen.add(item.place.id);
    unique.push(item);
  }
  return unique;
}

function orderPlaces(items: RankedPlace[]): RankedPlace[] {
  const withGeo = items.filter((item) => item.place.latitude && item.place.longitude);
  if (withGeo.length <= 1) return items;
  return orderByProximity(
    withGeo.map((item) => ({
      ...item,
      id: item.place.id,
      latitude: item.place.latitude!,
      longitude: item.place.longitude!,
    }))
  );
}

function dealRoundRobin<T>(items: T[], buckets: number): T[][] {
  const dealt: T[][] = Array.from({ length: Math.max(1, buckets) }, () => []);
  items.forEach((item, index) => {
    dealt[index % dealt.length].push(item);
  });
  return dealt;
}

function fillEmptySlots(
  days: StructuredItineraryDraft["days"],
  pool: RankedPlace[],
  used: Set<string>,
  prefs: UserTripPreferences
) {
  const take = (preferEvening = false): RankedPlace | undefined => {
    const found = pool.find((item) => {
      if (used.has(item.place.id)) return false;
      return preferEvening ? isEveningType(item.place.type) || isDaytimeType(item.place.type) : true;
    });
    if (found) used.add(found.place.id);
    return found;
  };

  for (const day of days) {
    if (day.morning.length === 0) {
      const item = take(false);
      if (item) day.morning = [toPlanned(item, prefs)];
    }
    if (day.afternoon.length === 0) {
      const item = take(false);
      if (item) day.afternoon = [toPlanned(item, prefs)];
    }
    if (day.evening.length === 0) {
      const item = take(true);
      if (item) day.evening = [toPlanned(item, prefs)];
    }
  }
}

function pickDiverseSelection(
  ranked: RankedPlace[],
  needed: number,
  prefs: UserTripPreferences
): RankedPlace[] {
  const selected: RankedPlace[] = [];
  const typeCounts = new Map<string, number>();
  const maxOfType = prefs.pace === "slow" ? 8 : 12;

  for (const item of ranked) {
    if (selected.length >= needed) break;
    const count = typeCounts.get(item.place.type) ?? 0;
    if (count >= maxOfType && selected.length > 4) continue;
    selected.push(item);
    typeCounts.set(item.place.type, count + 1);
  }

  return selected;
}

function toPlanned(item: RankedPlace, prefs: UserTripPreferences): PlannedActivity {
  return {
    id: item.place.id,
    name: item.place.name,
    type: item.place.type,
    description: item.place.address ?? `Verified ${item.place.type} in ${item.place.city}`,
    neighborhood: item.place.address,
    latitude: item.place.latitude,
    longitude: item.place.longitude,
    durationMinutes: item.place.type === "museum" ? 90 : 75,
    estimatedCostLevel: prefs.budgetLevel,
    reason: item.reasons[0] ?? `Fits your ${prefs.selectedInterests.slice(0, 2).join(" + ") || "trip"} preferences.`,
    reservationRecommended: item.place.type === "restaurant",
    source: "verified",
  };
}

function isUsablePlace(place: NormalizedPlace): boolean {
  if (!place.name || place.name.length < 2) return false;
  if (!place.providerPlaceId) return false;
  if (place.latitude == null || place.longitude == null) return false;
  return true;
}

export function formatRetrievalLog(result: PlaceRetrievalResult): string {
  const top = result.ranked
    .slice(0, 12)
    .map((r, i) => `  ${i + 1}. ${r.place.name} [${r.place.type}] score ${r.score}`)
    .join("\n");
  return [
    "OSM SEARCHES",
    ...result.searches.map((s) => `  → ${s}`),
    `RETRIEVED → ${result.retrievedCount} candidate places`,
    `FILTERED → ${result.filteredCount} valid candidates`,
    `RANKED → top ${Math.min(15, result.ranked.length)} personalized candidates`,
    top,
    `SELECTED → ${result.selected.length} places`,
  ].join("\n");
}

export function constrainItineraryToPool(
  plan: Omit<TripPlan, "id" | "createdAt">,
  retrieval: PlaceRetrievalResult,
  prefs: UserTripPreferences
): { plan: Omit<TripPlan, "id" | "createdAt">; verified: number; total: number } {
  const pool = [
    ...retrieval.ranked,
    ...retrieval.hotels,
    ...retrieval.restaurants,
    ...retrieval.diningAndNightlife,
    ...retrieval.selected,
  ];
  const byId = new Map<string, RankedPlace>();
  const byName = new Map<string, RankedPlace>();
  for (const item of pool) {
    if (item.place.providerPlaceId) byId.set(item.place.providerPlaceId, item);
    byId.set(item.place.id, item);
    byName.set(item.place.name.toLowerCase().trim(), item);
  }

  const used = new Set<string>();
  const unused = () => retrieval.selected.filter((item) => !used.has(item.place.id));

  const matchActivity = (activity: ItineraryActivity): ItineraryActivity | null => {
    const found =
      (activity.providerPlaceId ? byId.get(activity.providerPlaceId) : undefined) ??
      byName.get(activity.name.toLowerCase().trim());
    if (!found) return null;
    used.add(found.place.id);
    return {
      ...activity,
      name: found.place.name,
      description: activity.description || found.place.address || found.place.name,
      knowledgeId: found.place.id,
      type: found.place.type,
      latitude: found.place.latitude,
      longitude: found.place.longitude,
      address: found.place.address,
      provider: found.place.provider,
      providerPlaceId: found.place.providerPlaceId,
      mapsUrl: found.place.mapsUrl,
      source: "verified",
    };
  };

  const dailyItinerary: DailyItinerary[] = (plan.dailyItinerary ?? []).map((day) => {
    const slots = {
      morning: day.morning.map(matchActivity).filter(Boolean) as ItineraryActivity[],
      afternoon: day.afternoon.map(matchActivity).filter(Boolean) as ItineraryActivity[],
      evening: day.evening.map(matchActivity).filter(Boolean) as ItineraryActivity[],
    };
    const needed = activitiesPerDay(prefs);
    const have = slots.morning.length + slots.afternoon.length + slots.evening.length;
    if (have < Math.min(2, needed)) {
      for (const item of unused()) {
        if (slots.morning.length + slots.afternoon.length + slots.evening.length >= needed) break;
        used.add(item.place.id);
        const filler: ItineraryActivity = {
          name: item.place.name,
          description: item.place.address ?? item.place.name,
          whyRecommended: item.reasons[0] ?? `Fits your ${prefs.selectedInterests.slice(0, 2).join(" + ")} trip.`,
          knowledgeId: item.place.id,
          type: item.place.type,
          latitude: item.place.latitude,
          longitude: item.place.longitude,
          address: item.place.address,
          provider: item.place.provider,
          providerPlaceId: item.place.providerPlaceId,
          mapsUrl: item.place.mapsUrl,
          source: "verified",
        };
        if (slots.morning.length === 0) slots.morning.push(filler);
        else if (slots.afternoon.length < 2) slots.afternoon.push(filler);
        else slots.evening.push(filler);
      }
    }
    return { ...day, ...slots };
  });

  const hotelRecs = (retrieval.hotels.length ? retrieval.hotels : []).slice(0, 3).map((item) => {
    const existing = plan.hotelRecommendations.find(
      (h) => h.name.toLowerCase() === item.place.name.toLowerCase()
    );
    return toHotelRecommendation(item.place as import("./types").NormalizedHotel, existing?.whyRecommended);
  });

  const dining = retrieval.diningAndNightlife.slice(0, 6);
  const restaurantRecs = dining.map((item, index) => {
    const existing = plan.restaurants.find((r) => r.name.toLowerCase() === item.place.name.toLowerCase());
    return toRestaurantRecommendation(item.place, index, existing?.whyRecommended);
  });

  const activityRecs = retrieval.selected.slice(0, 8).map((item) => {
    const existing = plan.activities.find((a) => a.name.toLowerCase() === item.place.name.toLowerCase());
    return toActivityRecommendation(item.place, existing?.whyRecommended);
  });

  let verified = 0;
  let total = 0;
  for (const day of dailyItinerary) {
    for (const act of [...day.morning, ...day.afternoon, ...day.evening]) {
      total += 1;
      if (act.providerPlaceId && byId.has(act.providerPlaceId)) verified += 1;
    }
  }

  return {
    plan: {
      ...plan,
      destination: prefs.destination || plan.destination || retrieval.city,
      country: prefs.country || plan.country || retrieval.country,
      destinationLabel: prefs.destinationLabel || plan.destinationLabel,
      destinationLatitude: prefs.latitude ?? plan.destinationLatitude,
      destinationLongitude: prefs.longitude ?? plan.destinationLongitude,
      dailyItinerary,
      hotelRecommendations: hotelRecs.length ? hotelRecs : [],
      restaurants: restaurantRecs,
      activities: activityRecs,
    },
    verified,
    total,
  };
}

export function formatRankedPoolForPrompt(result: PlaceRetrievalResult): string {
  let section = `\n--- PERSONALIZED REAL PLACE POOL (USE ONLY THESE PLACES) ---\n`;
  section += `Every hotel, restaurant, bar, and attraction in the itinerary MUST be one of these records.\n`;
  section += `Copy name and providerPlaceId exactly. Do not invent places.\n\n`;

  const groups: [string, RankedPlace[]][] = [
    ["HOTELS", result.hotels],
    ["FOOD / MARKETS", result.restaurants],
    ["NIGHTLIFE / DINING", result.diningAndNightlife.filter((r) => r.place.type === "bar" || r.place.type === "nightclub")],
    ["DAY PLACES", result.selected],
  ];

  for (const [label, items] of groups) {
    if (!items.length) continue;
    section += `${label}:\n`;
    for (const item of items.slice(0, 12)) {
      const p = item.place;
      section += `- ${p.name} | id=${p.providerPlaceId} | type=${p.type} | score=${item.score}`;
      if (p.address) section += ` | ${p.address}`;
      if (p.latitude && p.longitude) section += ` | ${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`;
      if (p.openingHours?.[0]) section += ` | hours=${p.openingHours[0]}`;
      if (item.reasons[0]) section += ` | ${item.reasons[0]}`;
      section += `\n`;
    }
    section += `\n`;
  }
  section += `--- END PLACE POOL ---\n`;
  return section;
}

export function buildPlanFromRetrieval(
  retrieval: PlaceRetrievalResult,
  draft: StructuredItineraryDraft,
  budget: BudgetEstimate,
  prefs: UserTripPreferences
): Omit<TripPlan, "id" | "createdAt"> {
  const neighborhoods = neighborhoodsFromPlaces(
    [...retrieval.selected, ...retrieval.hotels, ...retrieval.restaurants].map((r) => r.place),
    retrieval.city
  );
  const hotelRecs = retrieval.hotels.slice(0, 3).map((item) =>
    toHotelRecommendation(item.place as import("./types").NormalizedHotel, item.reasons[0])
  );
  const restaurantRecs = retrieval.diningAndNightlife.slice(0, 6).map((item, index) =>
    toRestaurantRecommendation(item.place, index, item.reasons[0])
  );
  const activityRecs = retrieval.selected.slice(0, 8).map((item) =>
    toActivityRecommendation(item.place, item.reasons[0])
  );

  return {
    tripSummary: `A ${prefs.tripLength}-day ${prefs.travelStyle.toLowerCase()} trip to ${prefs.destinationLabel || prefs.destination || retrieval.city} built from real OpenStreetMap places matching ${prefs.selectedInterests.slice(0, 3).join(", ").toLowerCase() || "your preferences"}.`,
    destination: prefs.destination || retrieval.city,
    country: prefs.country || retrieval.country,
    destinationLabel: prefs.destinationLabel,
    destinationLatitude: prefs.latitude,
    destinationLongitude: prefs.longitude,
    dates: prefs.dates ? `${prefs.dates.start} – ${prefs.dates.end}` : "Flexible dates",
    duration: prefs.tripLength,
    estimatedBudget: budget.total,
    travelStyle: prefs.travelStyle,
    interests: prefs.selectedInterests,
    recommendedNeighborhood: neighborhoods[0]?.name ?? prefs.destination,
    neighborhoodReason: neighborhoods[0]?.why ?? `Staying central in ${prefs.destination} keeps the verified stops walkable.`,
    neighborhoods,
    hotelRecommendations: hotelRecs,
    activities: activityRecs,
    restaurants: restaurantRecs,
    transportation: [
      `Use local transit and walking in ${prefs.destination}.`,
      "Days are grouped by OSM coordinates so nearby stops stay together.",
    ],
    dailyItinerary: draftToDailyItinerary(draft),
    budgetBreakdown: {
      accommodation: budget.accommodation.amount,
      food: budget.food.amount,
      activities: budget.activities.amount,
      transportation: budget.transportation.amount,
      other: budget.other.amount,
    },
    travelTips: [
      `Every hotel, restaurant, and stop listed is a real place in ${retrieval.city} from OpenStreetMap.`,
      "Prices and availability are estimates — OSM does not provide live booking data.",
    ],
    packingRecommendations: ["Comfortable walking shoes", "Universal adapter"],
    travelEssentials: [],
  };
}

function neighborhoodsFromPlaces(
  places: NormalizedPlace[],
  city: string
): TripPlan["neighborhoods"] {
  const counts = new Map<string, number>();
  for (const place of places) {
    const hood =
      place.osmTags?.["addr:suburb"] ||
      place.osmTags?.["addr:neighbourhood"] ||
      place.osmTags?.["addr:district"];
    if (hood) counts.set(hood, (counts.get(hood) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (ranked.length === 0) {
    return [
      {
        name: city,
        bestFor: "Walkable access to the retrieved stops",
        why: `Real OSM listings were pulled for ${city}. Stay near the center unless a neighborhood stands out.`,
      },
    ];
  }
  return ranked.map(([name, count], index) => ({
    name,
    bestFor: index === 0 ? "Recommended stay area" : "Also nearby",
    why: `${count} verified place${count === 1 ? "" : "s"} from your search cluster around ${name}.`,
  }));
}
