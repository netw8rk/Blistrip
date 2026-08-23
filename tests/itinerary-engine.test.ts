import { buildTripProfile } from "../lib/planning/trip-profile";
import { buildSearchRequirements, buildTopRatedCatalogRequirements } from "../lib/planning/search-requirements";
import { buildUserPreferences } from "../lib/planning/preferences";
import { isOpenDuringSlot, opensForBreakfast, parseClockRange } from "../lib/travel/opening-hours";
import { canAddTypeToSlot, placeFitsSlot, slotBudgets } from "../lib/planning/slot-fit";
import { buildDraftFromRankedPlaces, pickTopRatedMix, rankPlaces, constrainItineraryToPool } from "../lib/travel/retrieve-places";
import { runCriticRepairLoop } from "../lib/planning/critic";
import type { TripPlannerInput } from "../types/trip";
import type { NormalizedPlace } from "../lib/travel/types";

const basePlace: NormalizedPlace = {
  id: "p1",
  provider: "openstreetmap",
  providerPlaceId: "node/1",
  name: "Sample Place",
  type: "attraction",
  city: "Charlotte",
  country: "United States",
  latitude: 35.2271,
  longitude: -80.8431,
  source: "verified",
  fetchedAt: new Date().toISOString(),
};

function profile(partial: Partial<TripPlannerInput>): ReturnType<typeof buildTripProfile> {
  return buildTripProfile({
    destination: "Charlotte",
    destinationUnknown: false,
    destinationCountry: "United States",
    destinationState: "North Carolina",
    destinationLabel: "Charlotte, North Carolina, United States",
    destinationLatitude: 35.2271,
    destinationLongitude: -80.8431,
    flexibleDates: true,
    budget: "$150–$250/night",
    travelers: "Couple",
    interests: ["Food"],
    travelStyle: "Comfortable",
    pace: "Balanced",
    ...partial,
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`  ✓ ${name}`);
      passed += 1;
    } else {
      console.error(`  ✗ ${name}`);
      failed += 1;
    }
  }

  console.log("\n=== ITINERARY ENGINE TESTS ===\n");

  console.log("Trip profiles:");
  const cases: Array<[string, Partial<TripPlannerInput>]> = [
    ["Budget traveler", { travelStyle: "Budget", budget: "Under $80/night", interests: ["Food", "Local experiences"] }],
    ["Luxury traveler", { travelStyle: "Luxury", budget: "$400+/night", interests: ["Food", "Culture"] }],
    ["History-focused", { interests: ["History", "Architecture"], travelers: "Couple" }],
    ["Food-focused", { interests: ["Food", "Local experiences"], additionalNotes: "Vegetarian" }],
    ["Nightlife-focused", { interests: ["Nightlife", "Food"], travelers: "Friends" }],
    ["Relaxed traveler", { pace: "Slow and relaxed", interests: ["Relaxation", "Nature"] }],
    ["Fast-paced traveler", { pace: "Pack everything in", interests: ["Adventure", "History"] }],
    ["Family traveler", { travelers: "Family", interests: ["Nature", "Food"] }],
    ["Couple", { travelers: "Couple", interests: ["Culture", "Food"] }],
    ["Solo traveler", { travelers: "Solo", interests: ["Nightlife", "History"] }],
  ];

  const requirementSets = cases.map(([label, input]) => {
    const built = profile(input);
    const reqs = buildSearchRequirements(built);
    assert(reqs.length > 0, `${label} produces search requirements`);
    return { label, built, reqs };
  });

  const nightlife = requirementSets.find((item) => item.label === "Nightlife-focused")!;
  const history = requirementSets.find((item) => item.label === "History-focused")!;
  const relaxed = requirementSets.find((item) => item.label === "Relaxed traveler")!;
  const food = requirementSets.find((item) => item.label === "Food-focused")!;

  assert(nightlife.reqs.some((item) => item.id === "nightlife"), "nightlife traveler searches bars");
  assert(history.reqs.some((item) => item.id === "historic" || item.id === "museums"), "history traveler searches landmarks/museums");
  assert(relaxed.built.pace === "slow", "relaxed traveler maps to slow pace");
  assert(food.built.dietary.includes("vegetarian"), "food notes become dietary preferences");
  assert(nightlife.reqs.map((item) => item.id).join(",") !== history.reqs.map((item) => item.id).join(","), "different users produce different searches");
  assert(!nightlife.reqs.some((item) => item.id === "attractions"), "nightlife trip does not add generic attractions");
  assert(!food.reqs.some((item) => item.id === "attractions"), "food trip does not add generic attractions");
  assert(
    food.reqs.some((item) => item.id === "restaurants" && item.query.includes("vegetarian")),
    "food notes change the restaurant search"
  );
  const catalog = buildTopRatedCatalogRequirements(food.built);
  assert(catalog.some((item) => item.id === "catalog-restaurants"), "top-rated catalog includes restaurants");
  assert(catalog.some((item) => item.id === "catalog-bars"), "top-rated catalog includes bars");
  assert(catalog.some((item) => item.id === "catalog-parks"), "top-rated catalog includes parks");
  assert(
    catalog.some((item) => item.placeType === "restaurant") &&
      food.reqs.some((item) => item.placeType === "restaurant"),
    "restaurant search stays in both interest and catalog pools"
  );

  console.log("\nOpening hours:");
  assert(parseClockRange("Monday: 11:00 AM – 10:00 PM")?.open === 11, "parses Google morning open time");
  assert(isOpenDuringSlot(["Monday: 11:00 AM – 10:00 PM"], "evening", 1), "restaurant is open in the evening");
  assert(!isOpenDuringSlot(["Monday: Closed"], "morning", 1), "closed Monday is rejected for Monday morning");
  assert(isOpenDuringSlot(undefined, "morning", 1), "missing hours are not treated as closed");
  assert(!opensForBreakfast(["Monday: 5:00 PM – 11:00 PM"], 1), "dinner-only hours are not breakfast");
  assert(opensForBreakfast(["Monday: 7:00 AM – 2:00 PM"], 1), "early open counts as breakfast");

  console.log("\nSlot fit:");
  const foodPrefs = food.built.prefs;
  const nightPrefs = nightlife.built.prefs;
  assert(
    !placeFitsSlot({ type: "bar", openingHours: ["Monday: 4:00 PM – 2:00 AM"] }, "morning", 1, nightPrefs),
    "bars are not placed in the morning"
  );
  assert(
    placeFitsSlot({ type: "bar", openingHours: ["Monday: 4:00 PM – 2:00 AM"] }, "evening", 1, nightPrefs),
    "bars can be placed in the evening"
  );
  assert(
    !placeFitsSlot({ type: "restaurant", openingHours: ["Monday: 5:00 PM – 11:00 PM"] }, "morning", 1, foodPrefs),
    "dinner-only restaurants are not placed in the morning"
  );
  assert(
    placeFitsSlot({ type: "restaurant", openingHours: ["Monday: 5:00 PM – 11:00 PM"] }, "evening", 1, foodPrefs),
    "dinner restaurants go in the evening"
  );
  assert(
    placeFitsSlot({ type: "cafe", openingHours: ["Monday: 7:00 AM – 3:00 PM"] }, "morning", 1, foodPrefs),
    "cafes can go in the morning"
  );
  assert(
    !placeFitsSlot({ type: "museum", openingHours: ["Monday: 10:00 AM – 5:00 PM"] }, "evening", 1, history.built.prefs),
    "museums are not placed in the evening"
  );
  const slowBudgets = slotBudgets(relaxed.built.prefs);
  const packedBudgets = slotBudgets(profile({ pace: "Pack everything in", interests: ["Nightlife", "Food"] }).prefs);
  assert(slowBudgets.morning.max <= 2 && slowBudgets.evening.max <= 2, "slow pace keeps slots short");
  assert(packedBudgets.evening.max >= 2, "nightlife + packed pace allows a fuller evening");
  assert(!canAddTypeToSlot("cafe", "morning", foodPrefs, ["cafe"]), "a morning slot rejects a second cafe");
  assert(canAddTypeToSlot("park", "morning", foodPrefs, ["cafe"]), "a morning cafe can be followed by a park");
  assert(!canAddTypeToSlot("cafe", "afternoon", foodPrefs, [], ["cafe"]), "the same day does not get a second cafe");
  assert(canAddTypeToSlot("restaurant", "evening", foodPrefs, [], ["restaurant"]), "lunch and dinner restaurants are allowed");
  assert(!canAddTypeToSlot("bar", "evening", nightPrefs, ["bar"]), "an evening slot rejects a second bar");

  console.log("\nScoring + hallucination guard:");
  const pool = [
    { ...basePlace, id: "bar", name: "The Wooden Robot", type: "bar" as const, providerPlaceId: "n/bar" },
    { ...basePlace, id: "museum", name: "Mint Museum", type: "museum" as const, providerPlaceId: "n/museum" },
    { ...basePlace, id: "food", name: "Leah & Louise", type: "restaurant" as const, providerPlaceId: "n/food" },
  ];
  const rankedNight = rankPlaces(pool, nightlife.built.prefs);
  const rankedHistory = rankPlaces(pool, history.built.prefs);
  assert(rankedNight[0].place.type === "bar" || rankedNight[0].place.type === "restaurant", "nightlife/food ranks venues first");
  assert(rankedHistory[0].place.type === "museum", "history ranks the museum first");

  const dietPool = [
    { ...basePlace, id: "veg", name: "Viva Chicken Vegetarian", type: "restaurant" as const, category: "vegetarian", providerPlaceId: "n/veg" },
    { ...basePlace, id: "steak", name: "Capital Grille Steakhouse", type: "restaurant" as const, category: "steakhouse", providerPlaceId: "n/steak" },
    { ...basePlace, id: "museum2", name: "Levine Museum", type: "museum" as const, providerPlaceId: "n/museum2" },
  ];
  const rankedDiet = rankPlaces(dietPool, food.built.prefs);
  assert(rankedDiet[0].place.name === "Viva Chicken Vegetarian", "vegetarian notes rank matching restaurants first");
  assert(rankedDiet[0].score > (rankedDiet.find((item) => item.place.id === "steak")?.score ?? 0), "steakhouse ranks below vegetarian match");
  assert((rankedDiet.find((item) => item.place.type === "museum")?.score ?? 0) < rankedDiet[0].score, "unselected museum ranks below food matches");

  const mixPool = [
    { place: { ...basePlace, id: "r1", name: "Restaurant A", type: "restaurant" as const, rating: 4.8, reviewCount: 400, providerPlaceId: "r1" }, score: 10, reasons: [] },
    { place: { ...basePlace, id: "r2", name: "Restaurant B", type: "restaurant" as const, rating: 4.7, reviewCount: 200, providerPlaceId: "r2" }, score: 9, reasons: [] },
    { place: { ...basePlace, id: "bar1", name: "Bar A", type: "bar" as const, rating: 4.6, reviewCount: 180, providerPlaceId: "bar1" }, score: 8, reasons: [] },
    { place: { ...basePlace, id: "park1", name: "Park A", type: "park" as const, rating: 4.7, reviewCount: 900, providerPlaceId: "park1" }, score: 8, reasons: [] },
    { place: { ...basePlace, id: "mus1", name: "Museum A", type: "museum" as const, rating: 4.5, reviewCount: 300, providerPlaceId: "mus1" }, score: 7, reasons: [] },
    { place: { ...basePlace, id: "hot1", name: "Hotel A", type: "hotel" as const, rating: 4.9, reviewCount: 2000, providerPlaceId: "hot1" }, score: 6, reasons: [] },
    { place: { ...basePlace, id: "groc1", name: "Harris Teeter Grocery", type: "shop" as const, rating: 4.8, reviewCount: 3000, providerPlaceId: "groc1" }, score: 5, reasons: [] },
  ];
  const mix = pickTopRatedMix(mixPool, 5);
  assert(mix.length === 5, "top-rated mix returns the requested count");
  assert(!mix.some((item) => item.place.type === "hotel"), "top-rated mix excludes hotels");
  assert(!mix.some((item) => /grocery/i.test(item.place.name)), "top-rated mix excludes grocery stores");
  assert(mix.some((item) => item.place.type === "restaurant"), "top-rated mix includes restaurants");
  assert(mix.some((item) => item.place.type === "bar"), "top-rated mix includes bars");
  assert(mix.some((item) => item.place.type === "park"), "top-rated mix includes parks");

  const hallucinated = {
    destination: "Charlotte",
    country: "United States",
    tripSummary: "",
    dates: "Flexible dates",
    duration: 3,
    estimatedBudget: 1500,
    travelStyle: "Comfortable",
    interests: ["History"],
    recommendedNeighborhood: "Uptown",
    neighborhoodReason: "",
    neighborhoods: [],
    hotelRecommendations: [],
    activities: [],
    restaurants: [],
    transportation: [],
    dailyItinerary: [
      {
        day: 1,
        title: "Day 1",
        morning: [{ name: "Invented Castle", description: "", whyRecommended: "" }],
        afternoon: [{ name: "Mint Museum", description: "", whyRecommended: "", providerPlaceId: "n/museum" }],
        evening: [],
      },
    ],
    budgetBreakdown: { accommodation: 1, food: 1, activities: 1, transportation: 1, other: 1 },
    travelTips: [],
    packingRecommendations: [],
    travelEssentials: [],
  };
  const retrieval = {
    city: "Charlotte",
    country: "United States",
    searches: ["historic"],
    retrievedCount: 3,
    filteredCount: 3,
    ranked: rankedHistory,
    selected: rankedHistory,
    hotels: [],
    restaurants: rankedHistory.filter((item) => item.place.type === "restaurant"),
    diningAndNightlife: [],
    providers: ["openstreetmap"],
  };
  const constrained = constrainItineraryToPool(hallucinated, retrieval, history.built.prefs);
  assert(
    !constrained.plan.dailyItinerary[0].morning.some((stop) => stop.name === "Invented Castle"),
    "fabricated POI is removed"
  );
  assert(
    constrained.plan.dailyItinerary[0].afternoon.some((stop) => stop.name === "Mint Museum"),
    "verified museum is kept"
  );

  const critic = runCriticRepairLoop(
    hallucinated,
    retrieval,
    history.built.prefs,
    {
      destination: "Charlotte",
      country: "United States",
      tripLength: 3,
      travelers: "Couple",
      interests: ["history"],
      budget: "moderate",
      budgetAmount: 1500,
      pace: "balanced",
      travelStyle: ["culture"],
      dates: undefined,
      mode: "specific_destination",
      dislikes: [],
      clarifyingQuestions: [],
      fieldStates: {},
    },
    [
      {
        day: 1,
        title: "Assembled",
        morning: [{ name: "Mint Museum", description: "Uptown", whyRecommended: "History", providerPlaceId: "n/museum", source: "verified" }],
        afternoon: [],
        evening: [],
      },
    ]
  );
  const criticStops = critic.plan.dailyItinerary.flatMap((day) => [
    ...day.morning,
    ...day.afternoon,
    ...day.evening,
  ]);
  assert(criticStops.some((stop) => stop.name === "Mint Museum"), "critic keeps a verified assembled stop");
  assert(!criticStops.some((stop) => stop.name === "Invented Castle"), "critic does not keep a fabricated stop");

  console.log("\nFull-day fill:");
  const sparse = {
    ...hallucinated,
    duration: 3,
    dailyItinerary: [
      {
        day: 1,
        title: "Day 1",
        morning: [{ name: "Mint Museum", description: "", whyRecommended: "", providerPlaceId: "n/museum" }],
        afternoon: [],
        evening: [],
      },
      { day: 2, title: "Day 2", morning: [], afternoon: [], evening: [] },
      {
        day: 3,
        title: "Day 3",
        morning: [{ name: "Invented Castle", description: "", whyRecommended: "" }],
        afternoon: [],
        evening: [],
      },
    ],
  };
  const filled = constrainItineraryToPool(sparse, retrieval, history.built.prefs).plan;
  for (const day of filled.dailyItinerary) {
    assert(day.morning.length > 0, `day ${day.day} morning is filled`);
    assert(day.afternoon.length > 0, `day ${day.day} afternoon is filled`);
    assert(day.evening.length > 0, `day ${day.day} evening is filled`);
  }
  assert(
    !filled.dailyItinerary.some((day) => day.morning.some((stop) => stop.name === "Invented Castle")),
    "fill does not restore fabricated stops"
  );

  console.log("\nDay guide notes:");
  const { writeDayGuideNote } = await import("../lib/travel/day-guide");
  const arrivalNote = writeDayGuideNote(
    {
      day: 1,
      title: "Arrive",
      morning: [{ name: "Café Savoy", description: "", whyRecommended: "", type: "cafe" }],
      afternoon: [{ name: "Charles Bridge", description: "", whyRecommended: "", type: "landmark" }],
      evening: [{ name: "Lokál", description: "", whyRecommended: "", type: "restaurant" }],
    },
    "Prague",
    4
  );
  assert(arrivalNote.includes("Café Savoy"), "arrival note names the first stop");
  assert(arrivalNote.includes("Charles Bridge"), "arrival note names a sight");
  assert(!/insert locatoin|we will start the day off slow/i.test(arrivalNote), "arrival note is not the sample script");
  const lastNote = writeDayGuideNote(
    {
      day: 4,
      title: "Leave",
      morning: [{ name: "Letná Park", description: "", whyRecommended: "", type: "park" }],
      afternoon: [{ name: "Old Town Square", description: "", whyRecommended: "", type: "landmark" }],
      evening: [],
    },
    "Prague",
    4
  );
  assert(/last|leaving|leave/i.test(lastNote), "last day sounds like a send-off");

  console.log("\nSlot type variety:");
  const cafeHeavyPool = [
    "Amelie's",
    "Not Just Coffee",
    "Mugs Coffee",
    "Hex Coffee",
  ].map((name, index) => ({
    place: {
      ...basePlace,
      id: `cafe${index}`,
      name,
      type: "cafe" as const,
      providerPlaceId: `n/cafe${index}`,
      latitude: 35.227 + index * 0.002,
      longitude: -80.843,
    },
    score: 50 - index,
    reasons: ["matches selected interests"],
  }));
  const mixedDayPool = [
    ...cafeHeavyPool,
    {
      place: { ...basePlace, id: "park-day", name: "Romare Bearden Park", type: "park" as const, providerPlaceId: "n/park-day", latitude: 35.228, longitude: -80.844 },
      score: 30,
      reasons: ["fits a relaxed morning"],
    },
    {
      place: { ...basePlace, id: "museum-day", name: "Mint Museum Uptown", type: "museum" as const, providerPlaceId: "n/museum-day", latitude: 35.226, longitude: -80.845 },
      score: 28,
      reasons: ["matches culture"],
    },
    {
      place: { ...basePlace, id: "rest-day", name: "Leah & Louise", type: "restaurant" as const, providerPlaceId: "n/rest-day", latitude: 35.229, longitude: -80.842 },
      score: 40,
      reasons: ["matches food"],
    },
    {
      place: { ...basePlace, id: "bar-day", name: "The Wooden Robot", type: "bar" as const, providerPlaceId: "n/bar-day", latitude: 35.23, longitude: -80.841 },
      score: 36,
      reasons: ["matches nightlife"],
    },
  ];
  const varietyDraft = buildDraftFromRankedPlaces(
    {
      city: "Charlotte",
      country: "United States",
      searches: ["cafes"],
      retrievedCount: mixedDayPool.length,
      filteredCount: mixedDayPool.length,
      ranked: mixedDayPool,
      selected: mixedDayPool,
      hotels: [],
      restaurants: mixedDayPool.filter((item) => item.place.type === "restaurant"),
      diningAndNightlife: mixedDayPool.filter((item) => ["restaurant", "bar", "cafe"].includes(item.place.type)),
    },
    food.built.prefs
  );
  const morningTypes = varietyDraft.days[0].morning.map((stop) => stop.type);
  const cafeMornings = morningTypes.filter((type) => type === "cafe").length;
  assert(cafeMornings <= 1, "morning does not stack multiple coffee shops");
  assert(new Set(morningTypes).size === morningTypes.length, "morning stops are different activity types");
  const eveningTypes = varietyDraft.days[0].evening.map((stop) => stop.type);
  const restaurantEvenings = eveningTypes.filter((type) => type === "restaurant").length;
  assert(restaurantEvenings <= 1, "evening does not stack multiple restaurants");

  console.log("\nDiversity engine:");
  const { classifyPlace } = await import("../lib/planning/activity-taxonomy");
  const { DiversityTracker, buildDayShapes } = await import("../lib/planning/diversity");
  const { clearRecentPlaces } = await import("../lib/planning/recent-places");
  clearRecentPlaces();

  assert(classifyPlace({ name: "Café Savoy", type: "cafe" }).interestCategory === "food", "cafes are a food interest, not a whole day plan");
  assert(classifyPlace({ name: "Paris Bakery", type: "cafe", googleTypes: ["bakery"] }).primaryKind === "bakery", "bakeries are a distinct food expression");
  assert(classifyPlace({ name: "National Museum", type: "museum" }).interestCategory === "culture", "museums map to culture");
  assert(classifyPlace({ name: "Cross Club", type: "nightclub" }).interestCategory === "entertainment", "clubs map to entertainment");

  const tracker = new DiversityTracker({ seed: 1, city: "Prague" });
  const restaurant = { ...basePlace, id: "r", name: "U Fleků", type: "restaurant" as const, providerPlaceId: "r" };
  const first = tracker.repetitionPenalty(restaurant, food.built.prefs);
  tracker.record(restaurant);
  tracker.record(restaurant);
  tracker.record(restaurant);
  const later = tracker.repetitionPenalty(restaurant, food.built.prefs);
  assert(first === 0, "first restaurant has no repetition penalty");
  assert(later > first, "repeating the same activity kind is penalized");

  const low = { place: { ...basePlace, id: "low", name: "Weak Cafe", type: "cafe" as const, providerPlaceId: "low" }, score: 40, relevance: 40 };
  const highA = { place: { ...basePlace, id: "highA", name: "Strong Cafe", type: "cafe" as const, providerPlaceId: "highA" }, score: 90, relevance: 90 };
  const highB = { place: { ...basePlace, id: "highB", name: "Also Strong Cafe", type: "cafe" as const, providerPlaceId: "highB" }, score: 88, relevance: 88 };
  const bandPick = new DiversityTracker({ seed: 4 }).pickFromBand([low, highA, highB]);
  assert(bandPick?.place.id !== "low", "controlled randomness stays inside the high-quality band");

  const shapes = buildDayShapes(nightlife.built.prefs, 3);
  assert(shapes.length === nightlife.built.prefs.tripLength, "one day shape per trip day");
  assert(new Set(shapes.map((shape) => `${shape.morning}-${shape.afternoon}-${shape.evening}`)).size >= 2, "day structures rotate instead of repeating a template");

  const richPool = [
    ...["Cafe A", "Cafe B", "Bakery A"].map((name, index) => ({
      place: { ...basePlace, id: `f${index}`, name, type: "cafe" as const, providerPlaceId: `f${index}`, googleTypes: name.includes("Bakery") ? ["bakery"] : ["cafe"], latitude: 35.22 + index * 0.002, longitude: -80.84 },
      score: 46,
      reasons: ["food"],
    })),
    ...["Museum A", "Museum B", "Castle A", "Church A"].map((name, index) => ({
      place: { ...basePlace, id: `c${index}`, name, type: (name.startsWith("Museum") ? "museum" : name.startsWith("Church") ? "church" : "landmark") as "museum" | "church" | "landmark", providerPlaceId: `c${index}`, latitude: 35.23 + index * 0.002, longitude: -80.85 },
      score: 48,
      reasons: ["culture"],
    })),
    ...["Park A", "Overlook A"].map((name, index) => ({
      place: { ...basePlace, id: `o${index}`, name, type: "park" as const, providerPlaceId: `o${index}`, latitude: 35.24 + index * 0.002, longitude: -80.86 },
      score: 44,
      reasons: ["outdoor"],
    })),
    ...["Dinner A", "Dinner B", "Dinner C"].map((name, index) => ({
      place: { ...basePlace, id: `d${index}`, name, type: "restaurant" as const, providerPlaceId: `d${index}`, latitude: 35.25 + index * 0.002, longitude: -80.87 },
      score: 47,
      reasons: ["food"],
    })),
    ...["Bar A", "Bar B", "Club A"].map((name, index) => ({
      place: { ...basePlace, id: `n${index}`, name, type: (name.startsWith("Club") ? "nightclub" : "bar") as "bar" | "nightclub", providerPlaceId: `n${index}`, latitude: 35.26 + index * 0.002, longitude: -80.88 },
      score: 45,
      reasons: ["nightlife"],
    })),
    {
      place: { ...basePlace, id: "mkt", name: "7th Street Public Market", type: "market" as const, providerPlaceId: "mkt", latitude: 35.225, longitude: -80.841 },
      score: 43,
      reasons: ["food market"],
    },
  ];
  const richRetrieval = {
    city: "Charlotte",
    country: "United States",
    searches: [],
    retrievedCount: richPool.length,
    filteredCount: richPool.length,
    ranked: richPool,
    selected: richPool,
    hotels: [],
    restaurants: richPool.filter((item) => item.place.type === "restaurant"),
    diningAndNightlife: richPool.filter((item) => ["restaurant", "bar", "nightclub", "cafe"].includes(item.place.type)),
  };
  const mixedPrefs = profile({
    interests: ["History", "Architecture", "Food", "Nightlife"],
    travelers: "Friends",
    pace: "Balanced",
  }).prefs;
  const tripA = buildDraftFromRankedPlaces(richRetrieval, mixedPrefs, { seed: 11, candidates: 1 });
  const tripB = buildDraftFromRankedPlaces(richRetrieval, mixedPrefs, { seed: 29, candidates: 1 });
  const namesA = tripA.days.flatMap((day) => [...day.morning, ...day.afternoon, ...day.evening].map((stop) => stop.name)).join("|");
  const namesB = tripB.days.flatMap((day) => [...day.morning, ...day.afternoon, ...day.evening].map((stop) => stop.name)).join("|");
  assert(namesA !== namesB, "similar profiles can produce different place selections");
  const morningCafeDays = tripA.days.filter((day) => day.morning.every((stop) => stop.type === "cafe")).length;
  assert(morningCafeDays < tripA.days.length, "not every morning is only coffee shops");
  const restaurantStops = tripA.days.flatMap((day) => [...day.morning, ...day.afternoon, ...day.evening]).filter((stop) => stop.type === "restaurant");
  assert(restaurantStops.length <= mixedPrefs.tripLength + 1, "food interest does not become a restaurant in every slot");

  const { buildPlanFromRetrieval } = await import("../lib/travel/retrieve-places");
  const { estimateTripBudget } = await import("../lib/planning/budget");
  const draftPlan = buildPlanFromRetrieval(
    richRetrieval,
    tripA,
    estimateTripBudget(
      {
        destination: "Charlotte",
        country: "United States",
        tripLength: mixedPrefs.tripLength,
        travelers: "Friends",
        interests: ["history", "food", "nightlife"],
        budget: "moderate",
        budgetAmount: 1500,
        pace: "balanced",
        travelStyle: ["culture"],
        dates: undefined,
        mode: "specific_destination",
        dislikes: [],
        clarifyingQuestions: [],
        fieldStates: {},
      },
      tripA
    ),
    mixedPrefs
  );
  const filledCritic = runCriticRepairLoop(
    draftPlan,
    richRetrieval,
    mixedPrefs,
    {
      destination: "Charlotte",
      country: "United States",
      tripLength: mixedPrefs.tripLength,
      travelers: "Friends",
      interests: ["history", "food", "nightlife"],
      budget: "moderate",
      budgetAmount: 1500,
      pace: "balanced",
      travelStyle: ["culture"],
      dates: undefined,
      mode: "specific_destination",
      dislikes: [],
      clarifyingQuestions: [],
      fieldStates: {},
    },
    draftPlan.dailyItinerary
  );
  assert(filledCritic.plan.dailyItinerary.length === tripA.days.length, "critic refill does not crash after diversity picks");

  console.log("\nDislikes, quality confidence, and discovery:");
  const { parseDislikes } = await import("../lib/planning/preferences");
  const { reviewConfidenceScore } = await import("../lib/planning/scoring-weights");
  const { scorePlace } = await import("../lib/travel/retrieve-places");
  const { deriveProviderTags } = await import("../lib/travel/place-tags");

  assert(parseDislikes("Avoid tourist traps and no shopping").includes("crowds"), "notes parse tourist-trap dislike");
  assert(parseDislikes("Avoid tourist traps and no shopping").includes("shopping"), "notes parse shopping dislike");
  assert(parseDislikes("I don't want to wake up early").includes("early mornings"), "notes parse early-morning dislike");
  assert(
    reviewConfidenceScore(4.7, 5000) > reviewConfidenceScore(5.0, 3),
    "4.7 with thousands of reviews beats 5.0 with 3 reviews"
  );

  const famous = {
    ...basePlace,
    id: "famous",
    name: "Famous Tower",
    type: "attraction" as const,
    rating: 4.7,
    reviewCount: 8000,
    providerPlaceId: "f1",
    googleTypes: ["tourist_attraction"],
    tags: ["touristy", "popular"],
  };
  const crowdPrefs = buildUserPreferences({
    destination: "Charlotte",
    destinationUnknown: false,
    flexibleDates: true,
    budget: "$150–$250/night",
    travelers: "Couple",
    interests: ["History"],
    travelStyle: "Comfortable",
    pace: "Balanced",
    additionalNotes: "Avoid tourist traps",
  });
  const noCrowdPrefs = buildUserPreferences({
    destination: "Charlotte",
    destinationUnknown: false,
    flexibleDates: true,
    budget: "$150–$250/night",
    travelers: "Couple",
    interests: ["History"],
    travelStyle: "Comfortable",
    pace: "Balanced",
  });
  assert(crowdPrefs.dislikes.includes("crowds"), "tourist-trap notes become a crowds dislike");
  assert(
    scorePlace(famous, crowdPrefs).score < scorePlace(famous, noCrowdPrefs).score,
    "crowds dislike lowers tourist-attraction scores"
  );

  const sports = profile({ interests: ["Sports", "Adventure"] });
  assert(
    buildSearchRequirements(sports).some((item) => item.id === "sports"),
    "sports interest adds stadium/venue searches"
  );
  const couple = requirementSets.find((item) => item.label === "Couple")!;
  assert(couple.reqs.some((item) => item.id === "culture-arts"), "culture traveler searches galleries/theaters");
  assert(deriveProviderTags({ type: "museum", reviewCount: 20 }).includes("cultural"), "museums get cultural provider tags");
  assert(deriveProviderTags({ type: "attraction", reviewCount: 5000 }).includes("popular"), "high review count is tagged popular");

  console.log("\nNightly stay budget:");
  const { parseNightlyBudget, accommodationFromNightly, nightlyStayLabel } = await import("../lib/planning/nightly-budget");
  assert(parseNightlyBudget("$150–$250/night") === 200, "mid band is $200 a night");
  assert(nightlyStayLabel("$150–$250/night") === "$150–$250/night", "hotel cards use the selected nightly label");
  const coupleStay = accommodationFromNightly(200, 5, "Couple");
  assert(coupleStay.nights === 4 && coupleStay.rooms === 1 && coupleStay.amount === 800, "5-day couple stay is $200 × 4 nights");
  const friendsStay = accommodationFromNightly(200, 5, "Friends");
  assert(friendsStay.rooms === 2 && friendsStay.amount === 1600, "friends stay uses two rooms at the same nightly rate");
  const nightlyEstimate = estimateTripBudget(
    {
      destination: "Charlotte",
      tripLength: 5,
      travelers: "Couple",
      interests: ["food"],
      budget: "premium",
      budgetAmount: 200,
      mode: "specific_destination",
      dislikes: [],
      clarifyingQuestions: [],
      fieldStates: {},
    },
    null
  );
  assert(nightlyEstimate.accommodation.amount === 800, "trip estimate accommodation matches nightly × nights");
  assert(nightlyEstimate.total > nightlyEstimate.accommodation.amount, "trip total is stay plus the rest of the trip");

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
