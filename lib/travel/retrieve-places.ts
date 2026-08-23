import type { DailyItinerary, ItineraryActivity, TripPlan } from "@/types/trip";
import type { NormalizedPlace, PlaceType } from "./types";
import {
  toActivityRecommendation,
  toHotelRecommendation,
  toRestaurantRecommendation,
} from "./fetch-trip-places";
import type { UserTripPreferences } from "@/lib/planning/preferences";
import { activitiesPerDay, diningSearchPhrase } from "@/lib/planning/preferences";
import { orderByProximity, isWithinRadiusKm, DESTINATION_MATCH_KM, haversineKm } from "@/lib/planning/geo";
import { maxWalkKm } from "@/lib/planning/preferences";
import { buildSearchRequirements, buildTopRatedCatalogRequirements } from "@/lib/planning/search-requirements";
import { reviewConfidenceScore, SCORING_WEIGHTS } from "@/lib/planning/scoring-weights";
import { type DaySlot } from "./opening-hours";
import { canAddTypeToSlot, placeFitsSlot, slotBudgets, slotPreferenceBoost } from "@/lib/planning/slot-fit";
import {
  buildDayShapes,
  DiversityTracker,
  formatDiversityLog,
  scoreItineraryDraft,
  shapeBoost,
  type DayShape,
  type DiversityDebug,
} from "@/lib/planning/diversity";
import { recordSelectedPlaces } from "@/lib/planning/recent-places";
import { GooglePlacesProvider, isExcludedGoogleTypes } from "./providers/google-places";
import { cityHeroQueries, pickCityHeroPhoto } from "./city-hero-photo";
import type { BudgetEstimate, PlannedActivity, StructuredItineraryDraft } from "@/lib/planning/types";
import { draftToDailyItinerary } from "@/lib/planning/merge";
import {
  accommodationFromNightly,
  googleHotelPriceRange,
  hotelFitsNightlyBudget,
  inferHotelPriceLevel,
} from "@/lib/planning/nightly-budget";
import { OpenStreetMapProvider, type OsmCategoryQuery } from "./providers/openstreetmap";

export interface RankedPlace {
  place: NormalizedPlace;
  score: number;
  reasons: string[];
}

export interface DiscoveryDebug {
  queries: string[];
  queryResultCounts: Record<string, number>;
  retrievedCount: number;
  uniqueAfterDedupe: number;
  removedInvalid: number;
  removedOutOfRadius: number;
  rankedCount: number;
  selectedCount: number;
  topScores: Array<{
    name: string;
    type: string;
    score: number;
    reasons: string[];
    neighborhood?: string;
    rating?: number;
    reviewCount?: number;
  }>;
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
  topRated?: RankedPlace[];
  providers?: string[];
  destinationPhotoUrl?: string;
  debug?: DiscoveryDebug;
  diversity?: DiversityDebug;
}

const osm = new OpenStreetMapProvider();
const google = new GooglePlacesProvider();

const DAYTIME_OSM_IDS = [
  "museums",
  "historic",
  "architecture",
  "parks",
  "viewpoints",
  "beaches",
  "shopping",
  "adventure",
  "food-halls",
  "culture-arts",
  "relaxation",
  "local",
  "sports",
];

export function buildOsmQueries(prefs: UserTripPreferences): OsmCategoryQuery[] {
  const s = prefs.scores;
  const scored: Array<OsmCategoryQuery & { priority: number }> = [];

  const add = (query: OsmCategoryQuery, score: number) => {
    if (score >= 6) scored.push({ ...query, priority: score });
  };

  add(
    {
      id: "restaurants",
      overpass: `node["amenity"="restaurant"]["name"]`,
      nominatim: diningSearchPhrase(prefs),
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
      id: "food-halls",
      overpass: `nwr["amenity"="marketplace"]["name"]`,
      nominatim: "food halls",
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
      nominatim: "boutiques shopping malls",
    },
    s.shopping
  );
  add(
    {
      id: "adventure",
      overpass: `nwr["sport"~"^(climbing|canoe|kayak|scuba_diving)$"]["name"]`,
      nominatim: "hiking trails outdoor adventures",
    },
    s.adventure
  );
  add(
    {
      id: "culture-arts",
      overpass: `nwr["amenity"~"^(theatre|arts_centre)$"]["name"]`,
      nominatim: "art galleries theaters",
    },
    s.culture
  );
  add(
    {
      id: "relaxation",
      overpass: `nwr["leisure"~"^(spa|garden)$"]["name"]`,
      nominatim: "spas gardens",
    },
    s.relaxation
  );
  add(
    {
      id: "local",
      overpass: `node["amenity"="marketplace"]["name"]`,
      nominatim: "local neighborhoods hidden gems",
    },
    s.localExperiences
  );
  if (prefs.selectedInterests.map((item) => item.toLowerCase()).includes("sports") || s.adventure >= 8) {
    add(
      {
        id: "sports",
        overpass: `nwr["leisure"="stadium"]["name"]`,
        nominatim: "stadiums sports venues",
      },
      Math.max(s.adventure, 8)
    );
  }

  if (s.localExperiences >= 7 && !scored.some((q) => q.id === "nightlife")) {
    scored.push({
      id: "local-pubs",
      overpass: `node["amenity"="pub"]["name"]`,
      nominatim: "local pubs",
      priority: 7,
    });
  }

  const hasDaytimeInterest = scored.some((query) => DAYTIME_OSM_IDS.includes(query.id));
  if (!hasDaytimeInterest && s.food < 6) {
    scored.push({
      id: "attractions",
      overpass: `nwr["tourism"="attraction"]["name"]`,
      nominatim: "attractions",
      priority: 4,
    });
  }

  const ranked = scored
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10)
    .map(({ priority: _priority, ...query }) => query);

  ranked.push({
    id: "hotels",
    overpass: `nwr["tourism"~"^(hotel|hostel|guest_house)$"]["name"]`,
    nominatim: "hotels",
  });

  return ranked;
}

export async function retrievePersonalizedPlaces(
  prefs: UserTripPreferences
): Promise<PlaceRetrievalResult | null> {
  const queries = google.isConfigured() ? [] : buildOsmQueries(prefs);
  const requirements = buildSearchRequirements(prefs);
  const catalogRequirements = buildTopRatedCatalogRequirements(prefs);
  const googleRequirements = [...requirements, ...catalogRequirements];
  const searches = [...googleRequirements.map((item) => item.id), "nearby-popular"];
  const queryResultCounts: Record<string, number> = {};
  let workingPrefs = prefs;
  const origin =
    workingPrefs.latitude != null && workingPrefs.longitude != null
      ? { lat: workingPrefs.latitude, lon: workingPrefs.longitude }
      : null;

  let googlePlaces: NormalizedPlace[] = [];
  let heroPlaces: NormalizedPlace[] = [];
  let osmRaw: Awaited<ReturnType<typeof osm.searchByQueries>> = null;

  if (origin && google.isConfigured()) {
    const [googlePool, heroResult] = await Promise.all([
      searchGooglePool(workingPrefs, googleRequirements),
      searchDestinationHeroPlaces(workingPrefs),
    ]);
    googlePlaces = googlePool.places;
    Object.assign(queryResultCounts, googlePool.queryCounts);
    heroPlaces = heroResult;
  } else if (google.isConfigured()) {
    const geo = await google.resolveCityLocation(workingPrefs.destination, workingPrefs.country);
    if (geo) {
      workingPrefs = {
        ...workingPrefs,
        latitude: geo.latitude,
        longitude: geo.longitude,
        country: workingPrefs.country || geo.country,
      };
      const [googlePool, heroResult] = await Promise.all([
        searchGooglePool(workingPrefs, googleRequirements),
        searchDestinationHeroPlaces(workingPrefs),
      ]);
      googlePlaces = googlePool.places;
      Object.assign(queryResultCounts, googlePool.queryCounts);
      heroPlaces = heroResult;
    }
  } else if (origin) {
    osmRaw = await osm.searchByQueries(
      workingPrefs.destination,
      workingPrefs.country,
      queries,
      { lat: origin.lat, lon: origin.lon, state: workingPrefs.state }
    );
  } else {
    osmRaw = await osm.searchByQueries(workingPrefs.destination, workingPrefs.country, queries);
  }

  const providers = [
    googlePlaces.length ? "google_places" : "",
    osmRaw?.places.length ? "openstreetmap" : "",
  ].filter(Boolean);

  const merged = dedupePlaces([...googlePlaces, ...(osmRaw?.places ?? [])]);
  if (merged.length === 0) return null;

  const retrievedCount = merged.length;
  const center =
    workingPrefs.latitude != null && workingPrefs.longitude != null
      ? { lat: workingPrefs.latitude, lon: workingPrefs.longitude }
      : osmRaw?.latitude != null && osmRaw.longitude != null
        ? { lat: osmRaw.latitude, lon: osmRaw.longitude }
        : null;
  let removedInvalid = 0;
  let removedOutOfRadius = 0;
  const filtered = merged.filter((place) => {
    if (!isUsablePlace(place)) {
      removedInvalid += 1;
      return false;
    }
    if (!center || place.latitude == null || place.longitude == null) {
      removedInvalid += 1;
      return false;
    }
    if (!isWithinRadiusKm(place.latitude, place.longitude, center.lat, center.lon, DESTINATION_MATCH_KM)) {
      removedOutOfRadius += 1;
      return false;
    }
    return true;
  });
  const ranked = rankPlaces(filtered, workingPrefs);
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

  const needed = Math.max(prefs.tripLength * activitiesPerDay(prefs), prefs.tripLength * 10);
  const selected = pickDiverseSelection(dayPlaces, Math.max(needed, 60), prefs);
  const hotelsSlice = hotels.slice(0, 16);
  const restaurantsSlice = restaurants.slice(0, 24);
  const diningSlice = diningAndNightlife.slice(0, 24);
  const topRated = pickTopRatedMix(dayPlaces, 32);

  const cardPlaces = [
    ...selected,
    ...hotelsSlice,
    ...restaurantsSlice,
    ...diningSlice,
    ...topRated,
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
    city: workingPrefs.destination || osmRaw?.city || "",
    country: workingPrefs.country || osmRaw?.country || "",
    latitude: workingPrefs.latitude ?? osmRaw?.latitude,
    longitude: workingPrefs.longitude ?? osmRaw?.longitude,
    searches,
    providers,
    retrievedCount,
    filteredCount: filtered.length,
    ranked: ranked.slice(0, 150),
    selected,
    hotels: hotelsSlice,
    restaurants: restaurantsSlice,
    diningAndNightlife: diningSlice,
    topRated,
    destinationPhotoUrl: pickCityHeroPhoto(heroPlaces),
    debug: {
      queries: searches,
      queryResultCounts,
      retrievedCount,
      uniqueAfterDedupe: merged.length,
      removedInvalid,
      removedOutOfRadius,
      rankedCount: ranked.length,
      selectedCount: selected.length,
      topScores: ranked.slice(0, 20).map((item) => ({
        name: item.place.name,
        type: item.place.type,
        score: Math.round(item.score * 10) / 10,
        reasons: item.reasons,
        neighborhood: item.place.neighborhood,
        rating: item.place.rating,
        reviewCount: item.place.reviewCount,
      })),
    },
  };
}

export function rankPlaces(places: NormalizedPlace[], prefs: UserTripPreferences): RankedPlace[] {
  return places
    .map((place) => scorePlace(place, prefs))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function interestScoreForPlace(place: NormalizedPlace, prefs: UserTripPreferences): number {
  const s = prefs.scores;
  const tags = place.osmTags ?? {};
  const haystack = `${place.name} ${place.category ?? ""} ${place.type} ${Object.values(tags).join(" ")}`.toLowerCase();

  switch (place.type) {
    case "restaurant":
    case "cafe":
      return Math.max(s.food, place.type === "cafe" ? s.relaxation : 0);
    case "market":
      return Math.max(s.food, s.localExperiences);
    case "bar":
    case "nightclub":
      return s.nightlife;
    case "museum":
      return Math.max(s.culture, s.history);
    case "landmark":
    case "church":
      return Math.max(s.history, s.architecture);
    case "park":
      return /beach|waterfront|pier|shore/.test(haystack) || tags.natural === "beach"
        ? Math.max(s.nature, s.relaxation, s.beaches)
        : Math.max(s.nature, s.relaxation);
    case "shop":
      return s.shopping;
    case "activity":
      return s.adventure;
    case "attraction":
      return Math.max(s.history, s.architecture, s.culture, s.adventure);
    default:
      if (tags.historic) return Math.max(s.history, s.architecture);
      if (tags.natural === "beach") return s.beaches;
      return 0;
  }
}

export function scorePlace(place: NormalizedPlace, prefs: UserTripPreferences): RankedPlace {
  const reasons: string[] = [];
  let score = 3;
  const s = prefs.scores;
  const type = place.type;
  const tags = place.osmTags ?? {};
  const haystack = `${place.name} ${place.category ?? ""} ${type} ${Object.values(tags).join(" ")}`.toLowerCase();
  const interest = interestScoreForPlace(place, prefs);

  const add = (points: number, reason: string) => {
    if (points <= 0) return;
    score += points;
    reasons.push(reason);
  };

  if (type === "bar" || type === "nightclub") {
    add(interest * SCORING_WEIGHTS.nightlifeMatch, "matches nightlife interest");
  } else if (interest > 0 && !lodgingType(type)) {
    add(interest * SCORING_WEIGHTS.interestMatch, "matches selected interests");
  }

  if (prefs.selectedInterests.length > 0 && !lodgingType(type) && interest > 0 && interest < 6) {
    score -= (6 - interest) * SCORING_WEIGHTS.mismatchPenalty;
    reasons.push("less aligned with selected interests");
  }

  if (prefs.dislikes.includes("museums") && (type === "museum" || /museum/.test(haystack))) {
    score -= SCORING_WEIGHTS.dislikePenalty;
    reasons.push("filtered: user avoids museums");
  }
  if (prefs.dislikes.includes("nightlife") && (type === "bar" || type === "nightclub")) {
    score -= SCORING_WEIGHTS.dislikePenalty;
    reasons.push("filtered: user avoids nightlife");
  }
  if (prefs.dislikes.includes("shopping") && type === "shop") {
    score -= SCORING_WEIGHTS.shoppingDislike;
    reasons.push("filtered: user avoids shopping");
  }
  if (prefs.dislikes.includes("crowds")) {
    const touristy =
      (place.reviewCount ?? 0) > 4000 ||
      place.tags?.includes("touristy") ||
      place.googleTypes?.includes("tourist_attraction");
    if (touristy) {
      score -= SCORING_WEIGHTS.crowdDislike;
      reasons.push("penalized: user avoids tourist traps / crowds");
    }
  }
  if (prefs.dislikes.includes("expensive") && (place.priceLevel ?? 0) >= 3) {
    score -= SCORING_WEIGHTS.expensiveDislike;
    reasons.push("penalized: user avoids expensive places");
  }
  if (
    (prefs.dislikes.includes("long walks") || prefs.walkingTolerance === "low") &&
    (type === "activity" || /hike|trail|trek/.test(haystack))
  ) {
    score -= SCORING_WEIGHTS.longWalkDislike;
    reasons.push("penalized: limited walking preferred");
  }
  if (place.businessStatus === "CLOSED_TEMPORARILY") {
    score -= SCORING_WEIGHTS.closedTemporarily;
    reasons.push("temporarily closed");
  }
  if (place.businessStatus === "CLOSED_PERMANENTLY") {
    score -= SCORING_WEIGHTS.closedPermanently;
    reasons.push("permanently closed");
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
    if (place.priceLevel != null && place.priceLevel >= 3 && !lodgingType(type)) score -= 8;
  }
  if (prefs.budgetLevel === "high" && type === "restaurant") {
    add(6, "fits higher-budget trip");
  }
  if (type === "hotel" || type === "hostel") {
    const range = googleHotelPriceRange(prefs.budgetAmount);
    const estimated = inferHotelPriceLevel(place.name, type, place.priceLevel);
    if (estimated != null) {
      if (range.max != null && estimated > range.max) {
        score -= 18;
        reasons.push("above selected nightly stay budget");
      } else if (range.min != null && estimated < range.min - 1) {
        score -= 8;
        reasons.push("below selected nightly stay budget");
      } else {
        add(SCORING_WEIGHTS.budgetFit + 6, "fits nightly stay budget");
      }
    }
  }

  const quality = reviewConfidenceScore(place.rating, place.reviewCount);
  if (quality > 0) {
    add(quality, `rated ${place.rating?.toFixed(1)} (${place.reviewCount ?? 0} reviews)`);
  }
  if ((place.reviewCount ?? 0) > 50) add(SCORING_WEIGHTS.reviewSignal, "established venue");
  if (prefs.localVsTouristy === "local" && (place.reviewCount ?? 0) > 4000) {
    score -= 6;
    reasons.push("very popular tourist venue");
  }

  const metadataBits = [place.address, place.website, place.openingHours?.length, place.latitude].filter(Boolean).length;
  if (metadataBits) score += Math.min(metadataBits * SCORING_WEIGHTS.hoursKnown, SCORING_WEIGHTS.hoursCap);

  if (prefs.travelers === "Family") {
    if (type === "nightclub" || tags.amenity === "nightclub") {
      score -= SCORING_WEIGHTS.familyNightlifePenalty;
      reasons.push("less suitable for family trip");
    } else if (["park", "museum", "market", "activity"].includes(type)) {
      add(SCORING_WEIGHTS.travelerFit, "fits a family trip");
    }
  } else if (prefs.travelers === "Friends" && (type === "bar" || type === "nightclub")) {
    add(SCORING_WEIGHTS.travelerFit, "fits a friends trip");
  } else if (prefs.travelers === "Solo" && ["cafe", "market", "museum"].includes(type)) {
    add(SCORING_WEIGHTS.travelerFit, "easy for a solo traveler");
  } else if (prefs.travelers === "Couple" && ["restaurant", "cafe", "landmark"].includes(type)) {
    add(Math.round(SCORING_WEIGHTS.travelerFit * 0.6), "fits a couple trip");
  }

  if ((type === "restaurant" || type === "cafe") && prefs.dietary.length) {
    const dietMatch = prefs.dietary.some((diet) => haystack.includes(diet.replace("-", " ")) || haystack.includes(diet));
    const meatClash =
      (prefs.dietary.includes("vegan") || prefs.dietary.includes("vegetarian")) &&
      /\b(steak|steakhouse|bbq|barbecue|butcher|burger)\b/.test(haystack);
    if (dietMatch) add(SCORING_WEIGHTS.dietaryFit, "matches dietary notes");
    if (meatClash) {
      score -= SCORING_WEIGHTS.dietaryClash;
      reasons.push("clashes with dietary notes");
    }
  }

  if (type === "restaurant" && prefs.cuisineHints.some((hint) => haystack.includes(hint))) {
    add(SCORING_WEIGHTS.dietaryFit, "matches requested cuisine");
  }

  return { place, score: Math.max(0, score), reasons: reasons.slice(0, 3) };
}

export function buildDraftFromRankedPlaces(
  retrieval: PlaceRetrievalResult,
  prefs: UserTripPreferences,
  options?: { seed?: number; candidates?: number }
): StructuredItineraryDraft {
  const candidateCount = Math.max(1, options?.candidates ?? 3);
  const baseSeed = options?.seed ?? Date.now() % 1_000_000;
  const drafts = Array.from({ length: candidateCount }, (_, index) =>
    assembleDraft(retrieval, prefs, new DiversityTracker({
      seed: baseSeed + index * 19,
      city: prefs.destination || retrieval.city,
    }))
  );

  let winner = drafts[0];
  let best = Number.NEGATIVE_INFINITY;
  for (const draft of drafts) {
    const scored = scoreItineraryDraft(draft.draft, prefs, draft.tracker);
    draft.trackerDebug.itineraryScore = scored.total;
    draft.trackerDebug.scoreBreakdown = scored.breakdown;
    if (scored.total > best) {
      best = scored.total;
      winner = draft;
    }
  }

  retrieval.diversity = winner.trackerDebug;
  recordSelectedPlaces(
    prefs.destination || retrieval.city,
    winner.draft.selectedAttractionIds
  );
  return winner.draft;
}

function assembleDraft(
  retrieval: PlaceRetrievalResult,
  prefs: UserTripPreferences,
  tracker: DiversityTracker
): { draft: StructuredItineraryDraft; tracker: DiversityTracker; trackerDebug: DiversityDebug } {
  const budgets = slotBudgets(prefs);
  const used = new Set<string>();
  const weekday = prefs.dates?.start ? new Date(`${prefs.dates.start}T12:00:00`).getUTCDay() : 1;
  const shapes = buildDayShapes(prefs, tracker.seed);

  const pool = uniquePlaces([
    ...retrieval.selected,
    ...retrieval.ranked,
    ...retrieval.restaurants,
    ...retrieval.diningAndNightlife,
  ]).filter((item) => !lodgingType(item.place.type));

  const daytime = pool.filter((item) =>
    placeFitsSlot(item.place, "morning", weekday, prefs) || placeFitsSlot(item.place, "afternoon", weekday, prefs)
  );
  const dayBuckets = clusterPlacesForDays(daytime, prefs.tripLength, maxWalkKm(prefs));

  const days = Array.from({ length: prefs.tripLength }, (_, index) => {
    const dayNum = index + 1;
    const dayWeekday = (weekday + index) % 7;
    const localFirst = uniquePlaces([...(dayBuckets[index] ?? []), ...pool]);
    const shape = shapes[index];

    const morningItems = pickForSlot(localFirst, "morning", dayWeekday, budgets.morning, used, prefs, undefined, [], [], tracker, shape);
    const lastMorning = morningItems[morningItems.length - 1];
    const afternoonItems = pickForSlot(
      localFirst,
      "afternoon",
      dayWeekday,
      budgets.afternoon,
      used,
      prefs,
      lastMorning,
      [],
      morningItems.map((item) => item.place.type),
      tracker,
      shape
    );
    const lastAfternoon = afternoonItems[afternoonItems.length - 1] ?? lastMorning;
    const eveningItems = pickForSlot(
      localFirst,
      "evening",
      dayWeekday,
      budgets.evening,
      used,
      prefs,
      lastAfternoon,
      [],
      [...morningItems, ...afternoonItems].map((item) => item.place.type),
      tracker,
      shape
    );

    tracker.recordDayShape(`${shape.morning}>${shape.afternoon}>${shape.evening}`);

    return {
      day: dayNum,
      title: dayNum === 1 ? `Arrive and explore ${prefs.destination}` : `${prefs.destination} · Day ${dayNum}`,
      morning: morningItems.map((item) => toPlanned(item, prefs)),
      afternoon: afternoonItems.map((item) => toPlanned(item, prefs)),
      evening: eveningItems.map((item) => toPlanned(item, prefs)),
    };
  });

  fillEmptySlots(days, pool, used, prefs, tracker, shapes);
  addAnchoredExperiences(days, prefs);

  return {
    draft: {
      destination: prefs.destination || retrieval.city,
      country: prefs.country || retrieval.country,
      duration: prefs.tripLength,
      pace: prefs.pace,
      days,
      selectedAttractionIds: [...used],
      geographicNotes: [
        `Days are clustered by walking distance and checked against opening hours when available.`,
      ],
    },
    tracker,
    trackerDebug: tracker.snapshot(),
  };
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
  requirements: ReturnType<typeof buildSearchRequirements> | ReturnType<typeof buildTopRatedCatalogRequirements>
): Promise<{ places: NormalizedPlace[]; queryCounts: Record<string, number> }> {
  if (!google.isConfigured() || prefs.latitude == null || prefs.longitude == null) {
    return { places: [], queryCounts: {} };
  }

  const results = await Promise.all(
    requirements.map(async (requirement) => {
      const first = await google.searchPlaces({
        query: requirement.query,
        type: requirement.placeType,
        city: prefs.destination,
        country: prefs.country,
        latitude: prefs.latitude,
        longitude: prefs.longitude,
        radiusMeters: 30000,
        limit: 20,
        minRating: requirement.minRating,
        ...(requirement.id === "hotels" ? googleHotelPriceRange(prefs.budgetAmount) : {}),
      });
      let places = first.places;
      if (requirement.priority >= 8 && first.nextPageToken) {
        const next = await google.searchPlaces({
          query: requirement.query,
          type: requirement.placeType,
          city: prefs.destination,
          country: prefs.country,
          latitude: prefs.latitude,
          longitude: prefs.longitude,
          radiusMeters: 30000,
          limit: 20,
          minRating: requirement.minRating,
          ...(requirement.id === "hotels" ? googleHotelPriceRange(prefs.budgetAmount) : {}),
          pageToken: first.nextPageToken,
        });
        places = [...places, ...next.places];
      }
      return { id: requirement.id, places };
    })
  );

  const queryCounts: Record<string, number> = {};
  const places: NormalizedPlace[] = [];
  for (const result of results) {
    const usable = result.places.filter((place) => place.name && place.providerPlaceId);
    queryCounts[result.id] = usable.length;
    places.push(...usable);
  }
  return { places, queryCounts };
}

async function searchGoogleNearbyPopular(
  prefs: UserTripPreferences
): Promise<{ places: NormalizedPlace[]; queryCounts: Record<string, number> }> {
  if (!google.isConfigured() || prefs.latitude == null || prefs.longitude == null) {
    return { places: [], queryCounts: {} };
  }

  const types = ["restaurant", "bar", "park", "tourist_attraction", "cafe"];
  const results = await Promise.all(
    types.map((includedType) =>
      google.searchNearbyPopular({
        includedType,
        latitude: prefs.latitude!,
        longitude: prefs.longitude!,
        city: prefs.destination,
        country: prefs.country,
        radiusMeters: 30000,
        limit: 20,
      })
    )
  );

  const queryCounts: Record<string, number> = {};
  const places: NormalizedPlace[] = [];
  types.forEach((type, index) => {
    const usable = results[index].places.filter((place) => place.name && place.providerPlaceId);
    queryCounts[`nearby-${type}`] = usable.length;
    places.push(...usable);
  });
  return { places, queryCounts };
}

async function searchGooglePool(
  prefs: UserTripPreferences,
  requirements: ReturnType<typeof buildSearchRequirements>
): Promise<{ places: NormalizedPlace[]; queryCounts: Record<string, number> }> {
  const [text, nearby] = await Promise.all([
    searchGoogleRequirements(prefs, requirements),
    searchGoogleNearbyPopular(prefs),
  ]);
  return {
    places: dedupePlaces([...nearby.places, ...text.places]),
    queryCounts: { ...text.queryCounts, ...nearby.queryCounts },
  };
}

async function searchDestinationHeroPlaces(prefs: UserTripPreferences): Promise<NormalizedPlace[]> {
  if (!google.isConfigured() || prefs.latitude == null || prefs.longitude == null) return [];
  const label = prefs.destinationLabel || prefs.destination;
  const results = await Promise.all(
    cityHeroQueries(label).map((query) =>
      google.searchPlaces({
        query,
        city: prefs.destination,
        country: prefs.country,
        latitude: prefs.latitude,
        longitude: prefs.longitude,
        radiusMeters: 20000,
        limit: 8,
      })
    )
  );
  return dedupePlaces(results.flatMap((result) => result.places)).filter((place) => place.photoUrls?.[0]);
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
      if (nearby && cluster.length < 10) {
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
  const balanced = clusters.slice(0, days);
  for (let index = 0; index < balanced.length; index += 1) {
    while (balanced[index].length === 0) {
      const donor = balanced.find((cluster) => cluster.length > 2);
      if (!donor) break;
      balanced[index].push(donor.pop()!);
    }
  }
  return balanced;
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

function pickForSlot(
  items: RankedPlace[],
  slot: DaySlot,
  weekday: number,
  budget: { min: number; max: number },
  used: Set<string>,
  prefs: UserTripPreferences,
  anchor?: RankedPlace,
  existingSlotTypes: Array<string | undefined> = [],
  existingDayTypes: Array<string | undefined> = [],
  tracker?: DiversityTracker,
  shape?: DayShape
): RankedPlace[] {
  const eligible = items.filter(
    (item) => !used.has(item.place.id) && !lodgingType(item.place.type) && placeFitsSlot(item.place, slot, weekday, prefs)
  );

  const scored = eligible.map((item) => {
    const proximity =
      anchor?.place.latitude && item.place.latitude != null && item.place.longitude != null
        ? Math.max(0, 6 - haversineKm(anchor.place.latitude, anchor.place.longitude!, item.place.latitude, item.place.longitude))
        : 0;
    const relevance =
      item.score + slotPreferenceBoost(item.place.type, slot, prefs) + shapeBoost(item.place, shape, slot) + proximity;
    const score = tracker ? tracker.selectionScore(relevance, item.place, prefs) : relevance;
    return { item, score, relevance };
  });

  const picked: RankedPlace[] = [];
  const slotTypes = [...existingSlotTypes];
  const dayTypes = [...existingDayTypes, ...existingSlotTypes];

  const take = (item: RankedPlace) => {
    picked.push(item);
    used.add(item.place.id);
    slotTypes.push(item.place.type);
    dayTypes.push(item.place.type);
    tracker?.record(item.place);
  };

  while (picked.length < budget.max) {
    const remaining = scored.filter((entry) => !used.has(entry.item.place.id));
    const allowed = remaining.filter((entry) => {
      if (picked.length >= budget.min && slotPreferenceBoost(entry.item.place.type, slot, prefs) <= 0 && entry.item.score < 12) {
        return false;
      }
      return canAddTypeToSlot(entry.item.place.type, slot, prefs, slotTypes, dayTypes);
    });
    const pool = allowed.length ? allowed : picked.length < budget.min ? remaining : [];
    if (!pool.length) break;
    const rankedPool = [...pool].sort((a, b) => b.score - a.score);
    const chosen = tracker
      ? tracker.pickFromBand(rankedPool.map((entry) => ({ score: entry.score, place: entry.item.place })))
      : { place: rankedPool[0].item.place };
    if (!chosen?.place) break;
    const match = pool.find((entry) => entry.item.place.id === chosen.place.id) ?? pool[0];
    take(match.item);
    if (picked.length >= budget.min && allowed.length <= 1) break;
  }

  return picked;
}

function fillEmptySlots(
  days: StructuredItineraryDraft["days"],
  pool: RankedPlace[],
  used: Set<string>,
  prefs: UserTripPreferences,
  tracker?: DiversityTracker,
  shapes: DayShape[] = []
) {
  const budgets = slotBudgets(prefs);
  const weekdayBase = prefs.dates?.start ? new Date(`${prefs.dates.start}T12:00:00`).getUTCDay() : 1;

  days.forEach((day, index) => {
    const weekday = (weekdayBase + index) % 7;
    const shape = shapes[index];
    const fill = (slot: DaySlot, current: typeof day.morning, otherSlots: typeof day.morning) => {
      const budget = budgets[slot];
      const extras = pickForSlot(
        pool,
        slot,
        weekday,
        {
          min: Math.max(0, budget.min - current.length),
          max: Math.max(0, budget.max - current.length),
        },
        used,
        prefs,
        undefined,
        current.map((item) => item.type),
        otherSlots.map((item) => item.type),
        tracker,
        shape
      );
      current.push(...extras.map((item) => toPlanned(item, prefs)));
    };
    fill("morning", day.morning, [...day.afternoon, ...day.evening]);
    fill("afternoon", day.afternoon, [...day.morning, ...day.evening]);
    fill("evening", day.evening, [...day.morning, ...day.afternoon]);
  });
}

const TOP_RATED_TYPE_CAPS: Partial<Record<PlaceType, number>> = {
  restaurant: 8,
  cafe: 4,
  bar: 5,
  nightclub: 2,
  park: 5,
  museum: 4,
  attraction: 5,
  landmark: 3,
  church: 2,
  shop: 3,
  activity: 3,
};

const TOP_RATED_RESERVED: Array<[PlaceType, number]> = [
  ["restaurant", 6],
  ["bar", 4],
  ["park", 4],
  ["cafe", 3],
  ["attraction", 4],
  ["museum", 3],
];

export function pickTopRatedMix(ranked: RankedPlace[], count = 32): RankedPlace[] {
  const candidates = ranked
    .filter((item) => !lodgingType(item.place.type) && !isGroceryOrErrand(item.place))
    .sort((a, b) => {
      const ratingDiff = (b.place.rating ?? 0) - (a.place.rating ?? 0);
      if (Math.abs(ratingDiff) > 0.1) return ratingDiff;
      const reviews = (b.place.reviewCount ?? 0) - (a.place.reviewCount ?? 0);
      if (reviews !== 0) return reviews;
      return b.score - a.score;
    });

  const selected: RankedPlace[] = [];
  const typeCounts = new Map<string, number>();
  const seen = new Set<string>();

  const take = (item: RankedPlace, enforceCap: boolean) => {
    const key = item.place.providerPlaceId || item.place.id;
    if (seen.has(key)) return false;
    if (enforceCap) {
      const cap = TOP_RATED_TYPE_CAPS[item.place.type] ?? 3;
      if ((typeCounts.get(item.place.type) ?? 0) >= cap) return false;
    }
    selected.push(item);
    seen.add(key);
    typeCounts.set(item.place.type, (typeCounts.get(item.place.type) ?? 0) + 1);
    return true;
  };

  for (const [type, reserve] of TOP_RATED_RESERVED) {
    const ofType = candidates.filter((item) => item.place.type === type);
    let added = 0;
    for (const item of ofType) {
      if (selected.length >= count || added >= reserve) break;
      if (take(item, true)) added += 1;
    }
  }

  for (const item of candidates) {
    if (selected.length >= count) break;
    take(item, true);
  }
  for (const item of candidates) {
    if (selected.length >= count) break;
    take(item, false);
  }
  return selected;
}

function pickDiverseSelection(
  ranked: RankedPlace[],
  needed: number,
  prefs: UserTripPreferences
): RankedPlace[] {
  const selected: RankedPlace[] = [];
  const typeCounts = new Map<string, number>();
  const neighborhoodCounts = new Map<string, number>();
  const maxOfType = prefs.pace === "slow" ? 12 : 18;
  const maxNeighborhood = SCORING_WEIGHTS.neighborhoodCap;

  for (const item of ranked) {
    if (selected.length >= needed) break;
    const count = typeCounts.get(item.place.type) ?? 0;
    if (count >= maxOfType && selected.length > 4) continue;
    const hood = item.place.neighborhood?.trim().toLowerCase();
    if (hood) {
      const neighborhoodCount = neighborhoodCounts.get(hood) ?? 0;
      if (neighborhoodCount >= maxNeighborhood && selected.length > 6) continue;
    }
    selected.push(item);
    typeCounts.set(item.place.type, count + 1);
    if (hood) neighborhoodCounts.set(hood, (neighborhoodCounts.get(hood) ?? 0) + 1);
  }

  if (selected.length < needed) {
    for (const item of ranked) {
      if (selected.length >= needed) break;
      if (selected.some((entry) => entry.place.id === item.place.id)) continue;
      selected.push(item);
    }
  }

  return selected;
}

function toPlanned(item: RankedPlace, prefs: UserTripPreferences): PlannedActivity {
  return {
    id: item.place.id,
    name: item.place.name,
    type: item.place.type,
    description: item.place.address ?? `${item.place.type} in ${item.place.city}`,
    neighborhood: item.place.neighborhood ?? item.place.address,
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
    photoUrl: item.place.photoUrls?.[0],
  };
}

function lodgingType(type: PlaceType | string): boolean {
  return type === "hotel" || type === "hostel" || type === "apartment";
}

export function placesCentroid(
  places: Array<{ latitude?: number; longitude?: number }>
): { lat: number; lon: number } | null {
  const geo = places.filter((place) => place.latitude != null && place.longitude != null);
  if (!geo.length) return null;
  return {
    lat: geo.reduce((sum, place) => sum + place.latitude!, 0) / geo.length,
    lon: geo.reduce((sum, place) => sum + place.longitude!, 0) / geo.length,
  };
}

export function selectStayHotels(
  hotels: RankedPlace[],
  prefs: UserTripPreferences,
  near?: { lat: number; lon: number } | null,
  limit = 3
): RankedPlace[] {
  const fitting = hotels.filter((item) =>
    hotelFitsNightlyBudget(prefs.budgetAmount, item.place.name, item.place.type, item.place.priceLevel)
  );
  const pool = fitting.length >= Math.min(limit, hotels.length) ? fitting : hotels;

  const scored = pool.map((item) => {
    let score = item.score;
    if (near && item.place.latitude != null && item.place.longitude != null) {
      const km = haversineKm(item.place.latitude, item.place.longitude, near.lat, near.lon);
      if (km <= 2) score += 8;
      else if (km <= 5) score += 4;
      else if (km > 12) score -= 6;
    }
    return { item, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const picked: RankedPlace[] = [];
  const usedChains = new Set<string>();
  for (const { item } of scored) {
    const chain = hotelChainKey(item.place.name);
    if (chain && usedChains.has(chain) && picked.length + 1 < limit) continue;
    picked.push(item);
    if (chain) usedChains.add(chain);
    if (picked.length >= limit) break;
  }
  return picked;
}

function hotelChainKey(name: string): string {
  return name.toLowerCase().replace(/^the\s+/, "").split(/[\s-]/)[0] ?? "";
}

function toItineraryFiller(item: RankedPlace, prefs: UserTripPreferences): ItineraryActivity {
  return {
    name: item.place.name,
    description: item.place.address ?? item.place.name,
    whyRecommended: item.reasons[0] ?? `Fits your ${prefs.selectedInterests.slice(0, 2).join(" + ") || "trip"} preferences.`,
    knowledgeId: item.place.id,
    type: item.place.type,
    latitude: item.place.latitude,
    longitude: item.place.longitude,
    address: item.place.address,
    provider: item.place.provider,
    providerPlaceId: item.place.providerPlaceId,
    mapsUrl: item.place.mapsUrl,
    rating: item.place.rating,
    photoUrl: item.place.photoUrls?.[0],
    source: "verified",
  };
}

function neighborhoodWalk(
  prefs: UserTripPreferences,
  slot: DaySlot,
  near?: Pick<ItineraryActivity, "name" | "latitude" | "longitude" | "neighborhood">
): ItineraryActivity {
  const area = near?.name || prefs.destination;
  const label =
    slot === "evening"
      ? `Evening stroll around ${area}`
      : slot === "morning"
        ? `Morning walk near ${area}`
        : `Explore the streets around ${area}`;
  return {
    name: label,
    description: `Free time nearby so the ${slot} stays in ${prefs.destination} instead of going blank.`,
    whyRecommended: "Keeps the day full without inventing a venue.",
    type: "experience",
    neighborhood: near?.neighborhood,
    latitude: near?.latitude,
    longitude: near?.longitude,
    source: "verified",
  };
}

/** Fill every morning / afternoon / evening so no city returns a half-empty day. */
export function ensureItineraryFilled(
  plan: Omit<TripPlan, "id" | "createdAt">,
  retrieval: PlaceRetrievalResult,
  prefs: UserTripPreferences
): Omit<TripPlan, "id" | "createdAt"> {
  const pool = uniquePlaces([
    ...retrieval.selected,
    ...retrieval.ranked,
    ...retrieval.restaurants,
    ...retrieval.diningAndNightlife,
  ]).sort((a, b) => b.score - a.score);
  const used = new Set<string>();
  for (const day of plan.dailyItinerary ?? []) {
    for (const stop of [...day.morning, ...day.afternoon, ...day.evening]) {
      if (stop.knowledgeId) used.add(stop.knowledgeId);
      if (stop.providerPlaceId) used.add(stop.providerPlaceId);
      const match = pool.find((item) => item.place.name.toLowerCase().trim() === stop.name.toLowerCase().trim());
      if (match) used.add(match.place.id);
    }
  }

  const weekdayBase = prefs.dates?.start ? new Date(`${prefs.dates.start}T12:00:00`).getUTCDay() : 1;
  const budgets = slotBudgets(prefs);

  const dailyItinerary = (plan.dailyItinerary ?? []).map((day, index) => {
    const weekday = (weekdayBase + index) % 7;
    const morning = [...day.morning];
    const afternoon = [...day.afternoon];
    const evening = [...day.evening];

    const fill = (slot: DaySlot, current: ItineraryActivity[], otherSlots: ItineraryActivity[]) => {
      const budget = budgets[slot];
      const extras = pickForSlot(
        pool,
        slot,
        weekday,
        {
          min: Math.max(0, budget.min - current.length),
          max: Math.max(0, budget.max - current.length),
        },
        used,
        prefs,
        undefined,
        current.map((item) => item.type),
        otherSlots.map((item) => item.type)
      );
      current.push(...extras.map((item) => toItineraryFiller(item, prefs)));
    };

    fill("morning", morning, [...afternoon, ...evening]);
    if (morning.length === 0) morning.push(neighborhoodWalk(prefs, "morning"));
    fill("afternoon", afternoon, [...morning, ...evening]);
    if (afternoon.length === 0) afternoon.push(neighborhoodWalk(prefs, "afternoon", morning[0]));
    fill("evening", evening, [...morning, ...afternoon]);
    if (evening.length === 0) {
      evening.push(neighborhoodWalk(prefs, "evening", afternoon.at(-1) ?? morning[0]));
    }

    return { ...day, morning, afternoon, evening };
  });

  return { ...plan, dailyItinerary };
}

function isGroceryOrErrand(place: NormalizedPlace): boolean {
  if (isExcludedGoogleTypes(place.googleTypes)) return true;
  const haystack = `${place.name} ${place.category ?? ""} ${place.type}`.toLowerCase();
  return /\b(grocery|supermarket|walmart|lidl|aldi|kroger|publix|safeway|tesco|carrefour|whole foods|trader joe)\b/.test(
    haystack
  );
}

function isUsablePlace(place: NormalizedPlace): boolean {
  if (!place.name || place.name.length < 2) return false;
  if (!place.providerPlaceId) return false;
  if (place.latitude == null || place.longitude == null) return false;
  if (place.businessStatus === "CLOSED_PERMANENTLY") return false;
  if (isGroceryOrErrand(place)) return false;
  return true;
}

export function formatRetrievalLog(result: PlaceRetrievalResult): string {
  const debug = result.debug;
  const queryLines = debug
    ? Object.entries(debug.queryResultCounts).map(([id, count]) => `  → ${id}: ${count} results`)
    : result.searches.map((s) => `  → ${s}`);
  const top = (debug?.topScores ?? result.ranked.slice(0, 12).map((r) => ({
    name: r.place.name,
    type: r.place.type,
    score: r.score,
    reasons: r.reasons,
    neighborhood: r.place.neighborhood,
    rating: r.place.rating,
    reviewCount: r.place.reviewCount,
  })))
    .slice(0, 12)
    .map((r, i) => {
      const meta = [
        r.neighborhood,
        r.rating != null ? `${r.rating.toFixed(1)}★` : null,
        r.reviewCount != null ? `${r.reviewCount} reviews` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `  ${i + 1}. ${r.name} [${r.type}] score ${r.score}${meta ? ` · ${meta}` : ""}${
        r.reasons.length ? ` — ${r.reasons.join("; ")}` : ""
      }`;
    })
    .join("\n");
  return [
    "PLACE SEARCHES",
    ...(result.providers?.length ? [`  providers: ${result.providers.join(", ")}`] : []),
    ...queryLines,
    `RETRIEVED → ${result.retrievedCount} unique places after merge`,
    debug
      ? `FILTERED → removed ${debug.removedInvalid} invalid, ${debug.removedOutOfRadius} out of radius · ${result.filteredCount} remain`
      : `FILTERED → ${result.filteredCount} valid candidates`,
    `RANKED → ${debug?.rankedCount ?? result.ranked.length} scored candidates`,
    top,
    `SELECTED → ${result.selected.length} places for the planner`,
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
      photoUrl: found.place.photoUrls?.[0],
      source: "verified",
    };
  };

  const dailyItinerary: DailyItinerary[] = (plan.dailyItinerary ?? []).map((day) => {
    const slots = {
      morning: day.morning.map(matchActivity).filter(Boolean) as ItineraryActivity[],
      afternoon: day.afternoon.map(matchActivity).filter(Boolean) as ItineraryActivity[],
      evening: day.evening.map(matchActivity).filter(Boolean) as ItineraryActivity[],
    };
    return { ...day, ...slots };
  });

  const stayCenter = placesCentroid([
    ...retrieval.selected.map((item) => item.place),
    ...dailyItinerary.flatMap((day) => [...day.morning, ...day.afternoon, ...day.evening]),
  ]);
  const hotelRecs = selectStayHotels(
    retrieval.hotels.length ? retrieval.hotels : [],
    prefs,
    stayCenter
  ).map((item) => {
    const existing = plan.hotelRecommendations.find(
      (h) => h.name.toLowerCase() === item.place.name.toLowerCase()
    );
    return toHotelRecommendation(
      item.place as import("./types").NormalizedHotel,
      existing?.whyRecommended || item.reasons[0],
      prefs.budgetLabel
    );
  });

  const dining = retrieval.diningAndNightlife.slice(0, 12);
  const restaurantRecs = dining.map((item, index) => {
    const existing = plan.restaurants.find((r) => r.name.toLowerCase() === item.place.name.toLowerCase());
    return toRestaurantRecommendation(item.place, index, existing?.whyRecommended);
  });

  const activityRecs = topRatedFromRetrieval(retrieval).map((item) => {
    const existing = plan.activities.find((a) => a.name.toLowerCase() === item.place.name.toLowerCase());
    return toActivityRecommendation(item.place, existing?.whyRecommended);
  });

  const filled = ensureItineraryFilled(
    {
      ...plan,
      destination: prefs.destination || plan.destination || retrieval.city,
      country: prefs.country || plan.country || retrieval.country,
      destinationLabel: prefs.destinationLabel || plan.destinationLabel,
      destinationLatitude: prefs.latitude ?? plan.destinationLatitude,
      destinationLongitude: prefs.longitude ?? plan.destinationLongitude,
      destinationPhotoUrl: retrieval.destinationPhotoUrl || plan.destinationPhotoUrl,
      dailyItinerary,
      hotelRecommendations: hotelRecs.length ? hotelRecs : [],
      restaurants: restaurantRecs,
      activities: activityRecs,
    },
    retrieval,
    prefs
  );

  let verified = 0;
  let total = 0;
  for (const day of filled.dailyItinerary) {
    for (const act of [...day.morning, ...day.afternoon, ...day.evening]) {
      total += 1;
      if (act.providerPlaceId && byId.has(act.providerPlaceId)) verified += 1;
    }
  }

  return { plan: filled, verified, total };
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
  const stay = accommodationFromNightly(prefs.budgetAmount, prefs.tripLength, prefs.travelers);
  const stayCenter = placesCentroid(retrieval.selected.map((item) => item.place));
  const hotelRecs = selectStayHotels(retrieval.hotels, prefs, stayCenter).map((item) =>
    toHotelRecommendation(
      item.place as import("./types").NormalizedHotel,
      item.reasons[0],
      prefs.budgetLabel
    )
  );
  const restaurantRecs = retrieval.diningAndNightlife.slice(0, 12).map((item, index) =>
    toRestaurantRecommendation(item.place, index, item.reasons[0])
  );
  const activityRecs = topRatedFromRetrieval(retrieval).map((item) =>
    toActivityRecommendation(item.place, item.reasons[0])
  );

  return {
    tripSummary: `A ${prefs.tripLength}-day ${prefs.travelStyle.toLowerCase()} trip to ${prefs.destinationLabel || prefs.destination || retrieval.city} shaped around ${prefs.selectedInterests.slice(0, 3).join(", ").toLowerCase() || "your preferences"}.`,
    destination: prefs.destination || retrieval.city,
    country: prefs.country || retrieval.country,
    destinationLabel: prefs.destinationLabel || [prefs.destination || retrieval.city, prefs.country || retrieval.country].filter(Boolean).join(", "),
    destinationLatitude: prefs.latitude ?? retrieval.latitude,
    destinationLongitude: prefs.longitude ?? retrieval.longitude,
    destinationPhotoUrl: retrieval.destinationPhotoUrl,
    dates: prefs.dates ? `${prefs.dates.start} – ${prefs.dates.end}` : "Flexible dates",
    duration: prefs.tripLength,
    estimatedBudget: budget.total,
    nightlyStayBudget: stay.nightly,
    stayNights: stay.nights,
    stayRooms: stay.rooms,
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

function topRatedFromRetrieval(retrieval: PlaceRetrievalResult): RankedPlace[] {
  if (retrieval.topRated?.length) return retrieval.topRated.slice(0, 32);
  return pickTopRatedMix(
    uniquePlaces([
      ...retrieval.selected,
      ...retrieval.ranked,
      ...retrieval.restaurants,
      ...retrieval.diningAndNightlife,
    ]),
    32
  );
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
