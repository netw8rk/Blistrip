import { buildTripProfile } from "../lib/planning/trip-profile";
import { buildSearchRequirements } from "../lib/planning/search-requirements";
import { buildUserPreferences } from "../lib/planning/preferences";
import { isOpenDuringSlot, parseClockRange } from "../lib/travel/opening-hours";
import { rankPlaces, constrainItineraryToPool } from "../lib/travel/retrieve-places";
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
    budget: "$1,000–$2,000",
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
    ["Budget traveler", { travelStyle: "Budget", budget: "<$500", interests: ["Food", "Local experiences"] }],
    ["Luxury traveler", { travelStyle: "Luxury", budget: "$4,000+", interests: ["Food", "Culture"] }],
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

  console.log("\nOpening hours:");
  assert(parseClockRange("Monday: 11:00 AM – 10:00 PM")?.open === 11, "parses Google morning open time");
  assert(isOpenDuringSlot(["Monday: 11:00 AM – 10:00 PM"], "evening", 1), "restaurant is open in the evening");
  assert(!isOpenDuringSlot(["Monday: Closed"], "morning", 1), "closed Monday is rejected for Monday morning");
  assert(isOpenDuringSlot(undefined, "morning", 1), "missing hours are not treated as closed");

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

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
