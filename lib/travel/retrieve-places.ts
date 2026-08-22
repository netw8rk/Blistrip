import type { DailyItinerary, ItineraryActivity, TripPlan } from "@/types/trip";
import type { NormalizedPlace, PlaceType } from "./types";
import {
  toActivityRecommendation,
  toHotelRecommendation,
  toRestaurantRecommendation,
} from "./fetch-trip-places";
import type { UserTripPreferences } from "@/lib/planning/preferences";
import { activitiesPerDay } from "@/lib/planning/preferences";
import { orderByProximity, isWithinRadiusKm, DESTINATION_MATCH_KM, haversineKm } from "@/lib/planning/geo";
import { maxWalkKm } from "@/lib/planning/preferences";
import { buildSearchRequirements } from "@/lib/planning/search-requirements";
import { SCORING_WEIGHTS } from "@/lib/planning/scoring-weights";
import { isOpenDuringSlot, type DaySlot } from "./opening-hours";
import { GooglePlacesProvider } from "./providers/google-places";
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
  providers?: string[];
}

const osm = new OpenStreetMapProvider();
const google = new GooglePlacesProvider();

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
  const requirements = buildSearchRequirements(prefs);
  const searches = requirements.map((item) => item.id);
  const origin =
    prefs.latitude != null && prefs.longitude != null
      ? { lat: prefs.latitude, lon: prefs.longitude }
      : null;

  const [googlePlaces, osmRaw] = await Promise.all([
    searchGoogleRequirements(prefs, requirements),
    osm.searchByQueries(
      prefs.destination,
      prefs.country,
      queries,
      origin ? { lat: origin.lat, lon: origin.lon, state: prefs.state } : undefined
    ),
  ]);

  const providers = [
    googlePlaces.length ? "google_places" : "",
    osmRaw?.places.length ? "openstreetmap" : "",
  ].filter(Boolean);

  const merged = dedupePlaces([...googlePlaces, ...(osmRaw?.places ?? [])]);
  if (merged.length === 0) return null;

  const retrievedCount = merged.length;
  const center = origin ??
    (osmRaw?.latitude != null && osmRaw.longitude != null
      ? { lat: osmRaw.latitude, lon: osmRaw.longitude }
      : null);
  const filtered = merged.filter((place) => {
    if (!isUsablePlace(place)) return false;
    if (!center || place.latitude == null || place.longitude == null) return false;
    return isWithinRadiusKm(place.latitude, place.longitude, center.lat, center.lon, DESTINATION_MATCH_KM);
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
  const hotelsSlice = hotels.slice(0, 6);
  const restaurantsSlice = restaurants.slice(0, 16);
  const diningSlice = diningAndNightlife.slice(0, 16);

  const cardPlaces = [
    ...selected,
    ...hotelsSlice,
    ...restaurantsSlice,
    ...diningSlice,
  ].map((item) => item.place);

  await hydrateGooglePlaceCards(cardPlaces);

  const googleCards = cardPlaces.filter((place) => place.provider === "google_places");
  const withPhotos = googleCards.filter((place) => place.photoUrls?.[0]).length;
  if (googleCards.length && withPhotos === 0) {
    console.warn(
      "[GooglePlaces] Places loaded without photos. In Google Cloud, enable Places API (New) photos on this key (no field restriction that excludes photos) and confirm billing is active."
    );
  }

  return {
    city: prefs.destination || osmRaw?.city || "",
    country: prefs.country || osmRaw?.country || "",
    latitude: prefs.latitude ?? osmRaw?.latitude,
    longitude: prefs.longitude ?? osmRaw?.longitude,
    searches,
    providers,
    retrievedCount,
    filteredCount: filtered.length,
    ranked: ranked.slice(0, 40),
    selected,
    hotels: hotelsSlice,
    restaurants: restaurantsSlice,
    diningAndNightlife: diningSlice,
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

  if (type === "restaurant" || type === "cafe" || type === "market") add(s.food * SCORING_WEIGHTS.interestMatch, "matches food interest");
  if (type === "bar" || type === "nightclub") add(s.nightlife * SCORING_WEIGHTS.nightlifeMatch, "matches nightlife interest");
  if (type === "museum") add(Math.max(s.culture, s.history) * SCORING_WEIGHTS.interestMatch, "matches culture/history");
  if (type === "landmark" || type === "church" || tags.historic) {
    add(Math.max(s.history, s.architecture) * SCORING_WEIGHTS.interestMatch, "matches history/architecture");
  }
  if (type === "park") add(Math.max(s.nature, s.relaxation) * SCORING_WEIGHTS.interestMatch, "matches nature/relaxation");
  if (type === "shop") add(s.shopping * SCORING_WEIGHTS.interestMatch, "matches shopping");
  if (type === "activity") add(s.adventure * SCORING_WEIGHTS.interestMatch, "matches adventure");
  if (type === "attraction") add(Math.max(s.history, s.architecture, s.culture) * 2, "general attraction");

  if (prefs.dislikes.includes("museums") && (type === "museum" || /museum/.test(haystack))) {
    score -= SCORING_WEIGHTS.dislikePenalty;
    reasons.push("filtered: user avoids museums");
  }
  if (prefs.dislikes.includes("nightlife") && (type === "bar" || type === "nightclub")) {
    score -= SCORING_WEIGHTS.dislikePenalty;
    reasons.push("filtered: user avoids nightlife");
  }

  if (prefs.localVsTouristy === "local") {
    if (["bar", "cafe", "market"].includes(type) || tags.amenity === "pub") {
      add(SCORING_WEIGHTS.localVenue, "local/neighborhood venue");
    }
    if (tags.tourism === "attraction" || tags.wikipedia) {
      score -= SCORING_WEIGHTS.touristPenalty;
      reasons.push("less tourist-centric preferred");
    }
  }

  if (prefs.budgetLevel === "low") {
    if (["cafe", "market", "park", "hostel"].includes(type)) add(SCORING_WEIGHTS.budgetFit, "budget-friendly type");
    if (type === "hotel" && prefs.travelStyle !== "Luxury") score -= 4;
    if (place.priceLevel != null && place.priceLevel >= 3) score -= 8;
  }
  if (prefs.budgetLevel === "high" && (type === "hotel" || tags.tourism === "attraction")) {
    add(6, "fits higher-budget trip");
  }

  if (place.rating) add(place.rating * SCORING_WEIGHTS.rating, `rated ${place.rating.toFixed(1)}`);
  if ((place.reviewCount ?? 0) > 50) add(SCORING_WEIGHTS.reviewSignal, "established venue");
  if (prefs.localVsTouristy === "local" && (place.reviewCount ?? 0) > 4000) {
    score -= 6;
    reasons.push("very popular tourist venue");
  }

  const metadataBits = [place.address, place.website, place.openingHours?.length, place.latitude].filter(Boolean).length;
  if (metadataBits) score += metadataBits * SCORING_WEIGHTS.hoursKnown;

  if (prefs.travelers === "Family" && (type === "nightclub" || tags.amenity === "nightclub")) {
    score -= SCORING_WEIGHTS.familyNightlifePenalty;
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
  const weekday = prefs.dates?.start ? new Date(`${prefs.dates.start}T12:00:00`).getUTCDay() : 1;

  const daytime = uniquePlaces([
    ...retrieval.selected,
    ...retrieval.ranked,
  ]).filter((item) => isDaytimeType(item.place.type) && !used.has(item.place.id));

  const eveningPool = uniquePlaces([
    ...retrieval.diningAndNightlife,
    ...retrieval.restaurants,
    ...retrieval.ranked.filter((item) => isEveningType(item.place.type)),
  ]);

  const dayBuckets = clusterPlacesForDays(daytime, prefs.tripLength, maxWalkKm(prefs));
  const eveningBuckets = dealRoundRobin(orderPlaces(eveningPool), prefs.tripLength);

  const days = Array.from({ length: prefs.tripLength }, (_, index) => {
    const dayNum = index + 1;
    const dayItems = dayBuckets[index] ?? [];
    const nightItems = eveningBuckets[index] ?? [];

    const openDay = dayItems.filter((item) => openFor(item, "morning", weekday) || openFor(item, "afternoon", weekday));
    const morningItem = openDay.find((item) => openFor(item, "morning", weekday)) ?? openDay[0];
    const afternoonItems = openDay
      .filter((item) => item !== morningItem && openFor(item, "afternoon", weekday))
      .slice(0, afternoonCount);
    const lastAfternoon = afternoonItems[afternoonItems.length - 1] ?? morningItem;
    const eveningItem =
      nearestOpen(nightItems, lastAfternoon, "evening", weekday) ??
      nightItems.find((item) => openFor(item, "evening", weekday)) ??
      dayItems[1 + afternoonCount];

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
  addAnchoredExperiences(days, prefs);

  return {
    destination: prefs.destination || retrieval.city,
    country: prefs.country || retrieval.country,
    duration: prefs.tripLength,
    pace: prefs.pace,
    days,
    selectedAttractionIds: [...used],
    geographicNotes: [
      `Days are clustered by walking distance and checked against opening hours when available.`,
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

async function searchGoogleRequirements(
  prefs: UserTripPreferences,
  requirements: ReturnType<typeof buildSearchRequirements>
): Promise<NormalizedPlace[]> {
  if (!google.isConfigured() || prefs.latitude == null || prefs.longitude == null) return [];

  const results = await Promise.all(
    requirements.map((requirement) =>
      google.searchPlaces({
        query: requirement.query,
        type: requirement.placeType,
        city: prefs.destination,
        country: prefs.country,
        latitude: prefs.latitude,
        longitude: prefs.longitude,
        radiusMeters: 25000,
        limit: 10,
      })
    )
  );

  return results.flatMap((result) => result.places).filter((place) => place.name && place.providerPlaceId);
}

async function hydrateGooglePlaceCards(places: NormalizedPlace[]): Promise<void> {
  const unique = new Map<string, NormalizedPlace>();
  for (const place of places) {
    if (place.provider !== "google_places" || !place.providerPlaceId) continue;
    unique.set(place.providerPlaceId, place);
  }

  const targets = [...unique.values()];
  const batchSize = 8;
  for (let index = 0; index < targets.length; index += batchSize) {
    const batch = targets.slice(index, index + batchSize);
    await Promise.all(
      batch.map(async (place) => {
        const needsDetails =
          !place.photoUrls?.[0] || place.rating == null || place.reviewCount == null || !place.mapsUrl;
        if (!needsDetails) return;
        const detailed = await google.getPlaceDetails(place.providerPlaceId!);
        if (!detailed) return;
        if (detailed.photoUrls?.length) place.photoUrls = detailed.photoUrls;
        if (detailed.rating != null) place.rating = detailed.rating;
        if (detailed.reviewCount != null) place.reviewCount = detailed.reviewCount;
        if (detailed.openingHours?.length) place.openingHours = detailed.openingHours;
        if (detailed.website) place.website = detailed.website;
        if (detailed.mapsUrl) place.mapsUrl = detailed.mapsUrl;
        if (detailed.phone) place.phone = detailed.phone;
        if (detailed.priceLevel != null) place.priceLevel = detailed.priceLevel;
      })
    );
  }
}

function dedupePlaces(places: NormalizedPlace[]): NormalizedPlace[] {
  const kept: NormalizedPlace[] = [];
  for (const place of places) {
    const duplicateIndex = kept.findIndex((existing) => {
      if (existing.name.toLowerCase() !== place.name.toLowerCase()) return false;
      if (existing.latitude == null || place.latitude == null || existing.longitude == null || place.longitude == null) {
        return true;
      }
      return haversineKm(existing.latitude, existing.longitude, place.latitude, place.longitude) < 0.25;
    });
    if (duplicateIndex === -1) {
      kept.push(place);
      continue;
    }
    const existing = kept[duplicateIndex];
    if (place.provider === "google_places" && existing.provider !== "google_places") {
      kept[duplicateIndex] = place;
    }
  }
  return kept;
}

function clusterPlacesForDays(items: RankedPlace[], days: number, maxWalk: number): RankedPlace[][] {
  const remaining = [...orderPlaces(items)];
  const clusters: RankedPlace[][] = [];
  const radius = Math.max(maxWalk, 1.4);

  while (remaining.length && clusters.length < days) {
    const seed = remaining.shift();
    if (!seed) break;
    const cluster = [seed];
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      const candidate = remaining[index];
      const nearby = cluster.some(
        (member) =>
          member.place.latitude != null &&
          member.place.longitude != null &&
          candidate.place.latitude != null &&
          candidate.place.longitude != null &&
          haversineKm(
            member.place.latitude,
            member.place.longitude,
            candidate.place.latitude,
            candidate.place.longitude
          ) <= radius
      );
      if (nearby && cluster.length < 4) {
        cluster.push(candidate);
        remaining.splice(index, 1);
      }
    }
    clusters.push(cluster);
  }

  remaining.forEach((item, index) => {
    if (!clusters.length) clusters.push([]);
    clusters[index % clusters.length].push(item);
  });

  while (clusters.length < days) clusters.push([]);
  return clusters.slice(0, days);
}

function openFor(item: RankedPlace, slot: DaySlot, weekday: number): boolean {
  return isOpenDuringSlot(item.place.openingHours, slot, weekday);
}

function nearestOpen(
  items: RankedPlace[],
  anchor: RankedPlace | undefined,
  slot: DaySlot,
  weekday: number
): RankedPlace | undefined {
  const open = items.filter((item) => openFor(item, slot, weekday));
  if (!anchor?.place.latitude || !anchor.place.longitude) return open[0];
  return [...open].sort((a, b) => {
    if (a.place.latitude == null || b.place.latitude == null) return 0;
    return (
      haversineKm(anchor.place.latitude!, anchor.place.longitude!, a.place.latitude, a.place.longitude!) -
      haversineKm(anchor.place.latitude!, anchor.place.longitude!, b.place.latitude, b.place.longitude!)
    );
  })[0];
}

function dealRoundRobin<T>(items: T[], buckets: number): T[][] {
  const dealt: T[][] = Array.from({ length: Math.max(1, buckets) }, () => []);
  items.forEach((item, index) => {
    dealt[index % dealt.length].push(item);
  });
  return dealt;
}

function addAnchoredExperiences(
  days: StructuredItineraryDraft["days"],
  prefs: UserTripPreferences
) {
  if (prefs.pace === "packed") return;
  for (const day of days) {
    const anchor = day.morning[0];
    if (!anchor || day.afternoon.length > 0) continue;
    day.afternoon = [
      {
        id: `experience-${day.day}`,
        name: `Explore the area around ${anchor.name}`,
        type: "experience",
        description: `A short neighborhood walk near ${anchor.name} so the day stays local.`,
        neighborhood: anchor.neighborhood,
        latitude: anchor.latitude,
        longitude: anchor.longitude,
        durationMinutes: 45,
        estimatedCostLevel: "low",
        reason: "A short stretch of free time so the day stays nearby and unhurried.",
        reservationRecommended: false,
        source: "verified",
      },
    ];
  }
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
    description: item.place.address ?? `${item.place.type} in ${item.place.city}`,
    neighborhood: item.place.address,
    latitude: item.place.latitude,
    longitude: item.place.longitude,
    durationMinutes: item.place.type === "museum" ? 90 : 75,
    estimatedCostLevel: prefs.budgetLevel,
    reason: item.reasons[0] ?? `Fits your ${prefs.selectedInterests.slice(0, 2).join(" + ") || "trip"} preferences.`,
    reservationRecommended: item.place.type === "restaurant",
    source: "verified",
    provider: item.place.provider,
    providerPlaceId: item.place.providerPlaceId,
    address: item.place.address,
    mapsUrl: item.place.mapsUrl,
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
    "PLACE SEARCHES",
    ...(result.providers?.length ? [`  providers: ${result.providers.join(", ")}`] : []),
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
    if (activity.type === "experience") return activity;
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
      rating: found.place.rating,
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
          rating: item.place.rating,
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

  const dining = retrieval.diningAndNightlife.slice(0, 12);
  const restaurantRecs = dining.map((item, index) => {
    const existing = plan.restaurants.find((r) => r.name.toLowerCase() === item.place.name.toLowerCase());
    return toRestaurantRecommendation(item.place, index, existing?.whyRecommended);
  });

  const activityRecs = retrieval.selected.slice(0, 16).map((item) => {
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
  const restaurantRecs = retrieval.diningAndNightlife.slice(0, 12).map((item, index) =>
    toRestaurantRecommendation(item.place, index, item.reasons[0])
  );
  const activityRecs = retrieval.selected.slice(0, 16).map((item) =>
    toActivityRecommendation(item.place, item.reasons[0])
  );

  return {
    tripSummary: `A ${prefs.tripLength}-day ${prefs.travelStyle.toLowerCase()} trip to ${prefs.destinationLabel || prefs.destination || retrieval.city} shaped around ${prefs.selectedInterests.slice(0, 3).join(", ").toLowerCase() || "your preferences"}.`,
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
    neighborhoodReason: neighborhoods[0]?.why ?? `Staying central in ${prefs.destination} keeps the day’s stops walkable.`,
    neighborhoods,
    hotelRecommendations: hotelRecs,
    activities: activityRecs,
    restaurants: restaurantRecs,
    transportation: [
      `Use local transit and walking in ${prefs.destination}.`,
      "Each day keeps nearby stops together so you spend less time crossing the city.",
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
      `Book popular restaurants and sights in ${retrieval.city} ahead when you can — hours and prices change.`,
      "Treat listed prices as planning estimates, not live quotes.",
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
        bestFor: "Walkable access to the main stops",
        why: `Stay near the center of ${city} unless a neighborhood stands out for your plans.`,
      },
    ];
  }
  return ranked.map(([name, count], index) => ({
    name,
    bestFor: index === 0 ? "Recommended stay area" : "Also nearby",
    why: `${count} recommended stop${count === 1 ? "" : "s"} sit around ${name}.`,
  }));
}
