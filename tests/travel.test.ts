import { getCached, setCache, clearCache } from "../lib/travel/cache";
import { registerTravelProvider, getConfiguredProviders } from "../lib/travel/registry";
import { haversineKm, estimateWalkMinutes } from "../lib/planning/geo";
import { validateAgentOutput, removeDuplicateItineraryItems } from "../lib/ai/validator";
import type { TripPlan, ItineraryActivity } from "../types/trip";
import type { EnhancedTripPlanningContext } from "../lib/planning/types";
import type { TravelDataProvider, NormalizedPlace, PlaceSearchResult } from "../lib/travel/types";

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.error(`  ✗ ${name}`);
      failed++;
    }
  }

  console.log("\n=== TRAVEL DATA LAYER TESTS ===\n");

  // --- Cache tests ---
  console.log("Cache:");
  clearCache();
  assert(getCached("test") === null, "empty cache returns null");

  setCache("test", { data: "hello" }, 5000);
  const cached = getCached<{ data: string }>("test");
  assert(cached?.data === "hello", "set and get works");

  setCache("expired", { data: "old" }, 1);
  await new Promise((r) => setTimeout(r, 10));
  assert(getCached("expired") === null, "expired entries return null");

  clearCache();
  assert(getCached("test") === null, "clearCache removes all entries");

  // --- Provider registry tests ---
  console.log("\nRegistry:");
  const mockProvider: TravelDataProvider = {
    name: "test_provider",
    isConfigured: () => true,
    async searchPlaces() {
      return { places: [], totalFound: 0, provider: "test_provider", cached: false };
    },
  };

  registerTravelProvider(mockProvider);
  const providers = getConfiguredProviders();
  assert(providers.some((p) => p.name === "test_provider"), "provider is registered");

  // --- Place normalization tests ---
  console.log("\nNormalization:");
  const normalizedPlace: NormalizedPlace = {
    id: "google_places_abc123",
    provider: "google_places",
    providerPlaceId: "abc123",
    name: "Test Restaurant",
    type: "restaurant",
    city: "Prague",
    country: "Czech Republic",
    latitude: 50.0755,
    longitude: 14.4378,
    rating: 4.5,
    reviewCount: 200,
    priceLevel: 2,
    source: "verified",
    fetchedAt: new Date().toISOString(),
  };

  assert(normalizedPlace.provider === "google_places", "provider field set correctly");
  assert(normalizedPlace.source === "verified", "source is verified");
  assert(normalizedPlace.providerPlaceId === "abc123", "providerPlaceId preserved");
  assert(typeof normalizedPlace.latitude === "number", "latitude is a number");
  assert(typeof normalizedPlace.longitude === "number", "longitude is a number");

  // --- Geographic calculation tests ---
  console.log("\nGeographic calculations:");
  const pragueCastle = { lat: 50.0909, lng: 14.4006 };
  const charlesBridge = { lat: 50.0865, lng: 14.4114 };
  const dist = haversineKm(pragueCastle.lat, pragueCastle.lng, charlesBridge.lat, charlesBridge.lng);
  assert(dist > 0.5 && dist < 1.5, `Prague Castle → Charles Bridge is ~${dist.toFixed(2)}km`);

  const walkTime = estimateWalkMinutes(dist);
  assert(walkTime > 5 && walkTime < 25, `walking time ~${walkTime} min is reasonable`);

  const zeroDistance = haversineKm(50.0, 14.0, 50.0, 14.0);
  assert(zeroDistance === 0, "same point gives zero distance");

  // --- Itinerary validation tests ---
  console.log("\nItinerary validation:");
  const mockContext: EnhancedTripPlanningContext = {
    mode: "specific_destination",
    destination: "Prague",
    interests: ["nightlife", "food"],
    budget: "moderate",
    budgetAmount: 1500,
    pace: "balanced",
    travelers: "friends",
    tripLength: 5,
    dislikes: [],
    clarifyingQuestions: [],
    fieldStates: {},
  };

  const validPlan: Omit<TripPlan, "id" | "createdAt"> = {
    tripSummary: "A 5-day trip to Prague",
    destination: "Prague",
    country: "Czech Republic",
    dates: "Flexible dates",
    duration: 5,
    estimatedBudget: 1400,
    travelStyle: "Comfortable",
    interests: ["Nightlife", "Food"],
    recommendedNeighborhood: "Old Town",
    neighborhoodReason: "Central location",
    neighborhoods: [],
    hotelRecommendations: [],
    activities: [],
    restaurants: [],
    transportation: [],
    dailyItinerary: [
      {
        day: 1,
        title: "Arrival",
        morning: [{ name: "Prague Castle", description: "Castle", whyRecommended: "Historic", source: "curated" }],
        afternoon: [{ name: "Charles Bridge", description: "Bridge", whyRecommended: "Iconic", source: "curated" }],
        evening: [{ name: "Jazz Dock", description: "Jazz club", whyRecommended: "Nightlife", source: "curated" }],
      },
    ],
    budgetBreakdown: { accommodation: 500, food: 400, activities: 250, transportation: 150, other: 100 },
    travelTips: [],
    packingRecommendations: [],
    travelEssentials: [],
  };

  const validResult = validateAgentOutput(validPlan, mockContext, null);
  assert(validResult.valid, "valid plan passes validation");

  // Test destination mismatch
  const mismatchPlan = { ...validPlan, destination: "Budapest" };
  const mismatchResult = validateAgentOutput(mismatchPlan, mockContext, null);
  assert(!mismatchResult.valid, "destination mismatch is caught");
  assert(mismatchResult.issues.some((i) => i.code === "destination_mismatch"), "destination_mismatch issue reported");

  // Test missing destination
  const noDestPlan = { ...validPlan, destination: "" };
  const noDestResult = validateAgentOutput(noDestPlan, mockContext, null);
  assert(!noDestResult.valid, "missing destination is caught");

  // Test duplicate detection
  const dupPlan = {
    ...validPlan,
    dailyItinerary: [
      {
        day: 1,
        title: "Day 1",
        morning: [{ name: "Prague Castle", description: "Castle", whyRecommended: "Historic" }],
        afternoon: [{ name: "Prague Castle", description: "Castle again", whyRecommended: "More history" }],
        evening: [],
      },
    ],
  };
  const dupResult = validateAgentOutput(dupPlan, mockContext, null);
  assert(dupResult.issues.some((i) => i.code === "duplicate_itinerary_item"), "duplicate items detected");

  // Test duplicate removal
  const repaired = removeDuplicateItineraryItems(dupPlan);
  const afterRepair = repaired.dailyItinerary[0];
  const totalActivities = afterRepair.morning.length + afterRepair.afternoon.length + afterRepair.evening.length;
  assert(totalActivities === 1, "duplicate removal keeps only first occurrence");

  // Test budget validation
  const overBudgetPlan = { ...validPlan, estimatedBudget: 3000 };
  const overBudgetResult = validateAgentOutput(overBudgetPlan, mockContext, null);
  assert(overBudgetResult.issues.some((i) => i.code === "budget_inconsistent"), "budget inconsistency detected");

  // Test overpacked day
  const overpackedPlan = {
    ...validPlan,
    dailyItinerary: [
      {
        day: 1,
        title: "Day 1",
        morning: Array.from({ length: 4 }, (_, i) => ({ name: `M${i}`, description: "", whyRecommended: "" })),
        afternoon: Array.from({ length: 3 }, (_, i) => ({ name: `A${i}`, description: "", whyRecommended: "" })),
        evening: [],
      },
    ],
  };
  const overpackedResult = validateAgentOutput(overpackedPlan, mockContext, null);
  assert(overpackedResult.issues.some((i) => i.code === "overpacked_day"), "overpacked day detected");

  // Test unverified places warning
  const unverifiedPlan = {
    ...validPlan,
    hotelRecommendations: [
      { name: "Fake Hotel", description: "", priceRange: "", whyRecommended: "", rating: 4, bookingUrl: "" },
    ],
    restaurants: [
      { name: "Fake Restaurant", cuisine: "", priceRange: "", whyRecommended: "", location: "", category: "cheap" as const, bookingUrl: "" },
    ],
  };
  const unverifiedResult = validateAgentOutput(unverifiedPlan, mockContext, null);
  assert(unverifiedResult.issues.some((i) => i.code === "unverified_places"), "unverified places flagged");

  // Test geographic spread warning
  const geoSpreadPlan = {
    ...validPlan,
    dailyItinerary: [
      {
        day: 1,
        title: "Day 1",
        morning: [{ name: "Place A", description: "", whyRecommended: "", latitude: 50.0, longitude: 14.4 } as ItineraryActivity],
        afternoon: [{ name: "Place B", description: "", whyRecommended: "", latitude: 50.2, longitude: 14.6 } as ItineraryActivity],
        evening: [],
      },
    ],
  };
  const geoResult = validateAgentOutput(geoSpreadPlan, mockContext, null);
  assert(geoResult.issues.some((i) => i.code === "excessive_travel"), "excessive travel distance flagged");

  // --- API failure handling tests ---
  console.log("\nAPI failure handling:");
  const failingProvider: TravelDataProvider = {
    name: "failing_provider",
    isConfigured: () => true,
    async searchPlaces() {
      throw new Error("API connection failed");
    },
  };

  let searchDidntCrash = true;
  try {
    await failingProvider.searchPlaces!({ city: "Prague" });
    searchDidntCrash = false;
  } catch {
    searchDidntCrash = true;
  }
  assert(searchDidntCrash, "failing provider throws but app can catch it");

  console.log("\nVerified place overlay:");
  const { applyVerifiedPlacesToPlan } = await import("../lib/travel/fetch-trip-places");
  const { mapOsmTypeForTest: mapOsm } = await import("../lib/travel/providers/openstreetmap");
  assert(mapOsm({ amenity: "restaurant" }) === "restaurant", "OSM restaurant type maps correctly");
  assert(mapOsm({ tourism: "hotel" }) === "hotel", "OSM hotel type maps correctly");
  assert(mapOsm({ amenity: "bar" }) === "bar", "OSM bar type maps correctly");

  const overlaid = applyVerifiedPlacesToPlan(validPlan, {
    city: "Tokyo",
    country: "Japan",
    provider: "openstreetmap",
    hotels: [{
      ...normalizedPlace,
      name: "Hotel Gracery Shinjuku",
      type: "hotel",
      city: "Tokyo",
      country: "Japan",
      providerPlaceId: "node/1",
    }],
    restaurants: [{
      ...normalizedPlace,
      name: "Ichiran Shinjuku",
      type: "restaurant",
      city: "Tokyo",
      category: "ramen",
      providerPlaceId: "node/2",
    }],
    attractions: [{
      ...normalizedPlace,
      name: "Senso-ji",
      type: "attraction",
      city: "Tokyo",
      providerPlaceId: "node/3",
    }],
    bars: [],
    cafes: [],
  }, ["Food"]);

  assert(overlaid.hotelRecommendations[0].name === "Hotel Gracery Shinjuku", "verified hotel overwrites invented hotels");
  assert(overlaid.hotelRecommendations[0].source === "verified", "hotel source is verified");
  assert(overlaid.restaurants[0].name === "Ichiran Shinjuku", "verified restaurant is used");
  assert(overlaid.activities.some((a) => a.name === "Senso-ji"), "verified attraction is included");

  console.log("\nPreference-driven retrieval:");
  const { buildUserPreferences } = await import("../lib/planning/preferences");
  const { buildOsmQueries, rankPlaces, constrainItineraryToPool } = await import("../lib/travel/retrieve-places");

  const nightlifeInput = {
    destination: "Prague",
    destinationUnknown: false,
    flexibleDates: true,
    budget: "$1,000–$2,000",
    travelers: "Friends",
    interests: ["Nightlife", "Food", "Local experiences"],
    travelStyle: "Comfortable",
    pace: "Balanced",
  };
  const historyInput = {
    ...nightlifeInput,
    travelers: "Couple",
    interests: ["History", "Architecture", "Culture"],
    pace: "Slow and relaxed",
    additionalNotes: "I hate nightlife",
  };
  const natureInput = {
    ...nightlifeInput,
    interests: ["Nature", "Adventure"],
    travelStyle: "Backpacker",
    pace: "Pack everything in",
  };

  const prefA = buildUserPreferences(nightlifeInput);
  const prefB = buildUserPreferences(historyInput);
  const prefC = buildUserPreferences(natureInput);
  const queriesA = buildOsmQueries(prefA).map((q) => q.id);
  const queriesB = buildOsmQueries(prefB).map((q) => q.id);
  const queriesC = buildOsmQueries(prefC).map((q) => q.id);

  assert(prefA.scores.nightlife >= 8 && prefB.scores.nightlife <= 2, "nightlife score differs by profile");
  assert(prefB.scores.history >= 8 && prefA.scores.history <= 3, "history score differs by profile");
  assert(queriesA.includes("nightlife") && !queriesB.includes("nightlife"), "OSM searches change with nightlife preference");
  assert(queriesB.includes("historic") || queriesB.includes("museums"), "history profile searches historic/museums");
  assert(queriesC.includes("parks") || queriesC.includes("adventure"), "nature profile searches parks/adventure");
  assert(queriesA.join(",") !== queriesB.join(","), "profile A and B produce different OSM query sets");

  const fakePool: import("../lib/travel/types").NormalizedPlace[] = [
    { ...normalizedPlace, name: "Cross Club", type: "nightclub", providerPlaceId: "n/1", osmTags: { amenity: "nightclub" } },
    { ...normalizedPlace, name: "Lokál Pub", type: "bar", providerPlaceId: "n/2", osmTags: { amenity: "pub" } },
    { ...normalizedPlace, name: "Prague Castle", type: "landmark", providerPlaceId: "n/3", osmTags: { historic: "castle" } },
    { ...normalizedPlace, name: "National Museum", type: "museum", providerPlaceId: "n/4", osmTags: { tourism: "museum" } },
    { ...normalizedPlace, name: "Letná Park", type: "park", providerPlaceId: "n/5", osmTags: { leisure: "park" } },
    { ...normalizedPlace, name: "Kantýna", type: "restaurant", providerPlaceId: "n/6", osmTags: { amenity: "restaurant" } },
  ];
  const rankedA = rankPlaces(fakePool, prefA);
  const rankedB = rankPlaces(fakePool, prefB);
  assert(rankedA[0].place.type === "nightclub" || rankedA[0].place.type === "bar" || rankedA[0].place.type === "restaurant", "nightlife/food profile ranks venues first");
  assert(rankedB[0].place.type === "landmark" || rankedB[0].place.type === "museum", "history profile ranks castle/museum first");
  assert(rankedA[0].place.name !== rankedB[0].place.name, "different profiles rank different top places");

  const hallucinated = {
    ...validPlan,
    dailyItinerary: [{
      day: 1,
      title: "Day 1",
      morning: [{ name: "Invented Magic Castle", description: "", whyRecommended: "" }],
      afternoon: [{ name: "Prague Castle", description: "", whyRecommended: "", providerPlaceId: "n/3" }],
      evening: [],
    }],
  };
  const constrained = constrainItineraryToPool(hallucinated, {
    city: "Prague",
    country: "Czechia",
    searches: ["historic"],
    retrievedCount: 6,
    filteredCount: 6,
    ranked: rankedB,
    selected: rankedB,
    hotels: [],
    restaurants: rankedB.filter((r) => r.place.type === "restaurant"),
    diningAndNightlife: [],
  }, prefB);
  assert(!constrained.plan.dailyItinerary[0].morning.some((a) => a.name === "Invented Magic Castle"), "hallucinated place is rejected");
  assert(constrained.plan.dailyItinerary[0].afternoon.some((a) => a.name === "Prague Castle"), "verified pool place is kept");

  const { generateMockTrip } = await import("../lib/mock-data");
  const charlotteMock = generateMockTrip({
    destination: "Charlotte, NC",
    destinationUnknown: false,
    flexibleDates: true,
    budget: "$1,000–$2,000",
    travelers: "Solo",
    interests: ["Nightlife", "Food"],
    travelStyle: "Comfortable",
    pace: "Balanced",
  });
  assert(charlotteMock.destination === "Charlotte, NC", "mock fallback keeps requested destination");
  assert(!charlotteMock.hotelRecommendations.some((h) => h.name === "Hotel Josef"), "Charlotte fallback does not use Prague hotels");
  assert(!charlotteMock.neighborhoods.some((n) => n.name === "Žižkov"), "Charlotte fallback does not use Prague neighborhoods");

  console.log("\nDestination suggestions:");
  const { mapNominatimToSuggestions } = await import("../lib/travel/suggest-places");
  const mapped = mapNominatimToSuggestions(
    [
      {
        osm_id: 1,
        osm_type: "relation",
        name: "Charlotte",
        lat: "35.2271",
        lon: "-80.8431",
        addresstype: "city",
        address: { city: "Charlotte", state: "North Carolina", country: "United States" },
      },
      {
        osm_id: 2,
        osm_type: "relation",
        name: "Charlotte",
        lat: "42.5636",
        lon: "-84.8358",
        addresstype: "city",
        address: { city: "Charlotte", state: "Michigan", country: "United States" },
      },
      {
        osm_id: 3,
        osm_type: "node",
        name: "Some cafe",
        lat: "35.22",
        lon: "-80.84",
        type: "cafe",
        addresstype: "amenity",
      },
    ],
    "Charlotte"
  );
  assert(mapped.length === 2, "keeps distinct city matches and drops amenities");
  assert(mapped[0].label.includes("North Carolina"), "labels include state for disambiguation");
  assert(mapped[1].country === "United States", "keeps country from Nominatim");

  console.log("\nExact destination radius:");
  const { isWithinRadiusKm, DESTINATION_MATCH_KM } = await import("../lib/planning/geo");
  const charlotteNc = { lat: 35.2271, lon: -80.8431 };
  const charlotteFlHotel = { lat: 26.9906, lon: -82.0901 };
  const uptownHotel = { lat: 35.2278, lon: -80.8431 };
  assert(
    isWithinRadiusKm(uptownHotel.lat, uptownHotel.lon, charlotteNc.lat, charlotteNc.lon, DESTINATION_MATCH_KM),
    "keeps a hotel in Charlotte NC"
  );
  assert(
    !isWithinRadiusKm(
      charlotteFlHotel.lat,
      charlotteFlHotel.lon,
      charlotteNc.lat,
      charlotteNc.lon,
      DESTINATION_MATCH_KM
    ),
    "rejects a Charlotte Florida hotel for a Charlotte NC search"
  );

  console.log("\nGoogle place links:");
  const { googlePhotoProxyUrl, googlePlacePageUrl } = await import("../lib/travel/google-links");
  assert(
    googlePhotoProxyUrl("places/ChIJ123/photos/Abc") === "/api/places/photo?name=places%2FChIJ123%2Fphotos%2FAbc",
    "builds a local photo proxy URL"
  );
  assert(googlePhotoProxyUrl("https://example.com/x") === undefined, "rejects non-Google photo names");
  assert(
    googlePlacePageUrl({
      name: "Mint Museum",
      provider: "google_places",
      providerPlaceId: "ChIJ123",
    }).includes("query_place_id=ChIJ123"),
    "builds a Google Maps page URL from a place ID"
  );

  // --- Summary ---
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
