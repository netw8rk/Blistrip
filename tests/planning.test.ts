import {
  buildEnhancedPlanningContext,
  runPlanningPipeline,
  rankAttractions,
  buildStructuredItinerary,
  validateStructuredItinerary,
  applyTripEdit,
  estimateTripBudget,
  inferPlanningMode,
} from "../lib/planning";
import { retrieveContextForDestination } from "../lib/knowledge";
import type { TripPlannerInput, TripPlan } from "../types/trip";
import { enrichTripPlan } from "../lib/mock-data";

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

  console.log("\n=== TRIP PLANNING ENGINE TESTS ===\n");

  const pragueInput: TripPlannerInput = {
    destination: "Prague",
    destinationUnknown: false,
    startDate: "2026-06-01",
    endDate: "2026-06-06",
    flexibleDates: false,
    budget: "$1,000–$2,000",
    travelers: "Couple",
    interests: ["History", "Architecture"],
    travelStyle: "Comfortable",
    pace: "Balanced",
  };

  // TEST 1: 5 days Prague, history + architecture
  console.log("TEST 1: Prague history + architecture");
  const pipeline1 = await runPlanningPipeline(pragueInput);
  assert(pipeline1.draftItinerary !== null, "Generates structured draft itinerary");
  assert(pipeline1.draftItinerary!.duration === 5, "Correct trip length");
  assert(pipeline1.rankedAttractions.length > 0, "Ranks attractions");
  const histArchCount = pipeline1.rankedAttractions.slice(0, 10).filter(
    (s) =>
      s.attraction.bestFor.includes("history") ||
      s.attraction.bestFor.includes("architecture") ||
      s.attraction.category === "historical" ||
      s.attraction.category === "architecture"
  ).length;
  assert(histArchCount >= 5, "Top attractions match history/architecture interests");
  if (pipeline1.draftItinerary) {
    const v1 = validateStructuredItinerary(pipeline1.draftItinerary, pipeline1.context);
    assert(v1.valid, "Draft passes validation");
  }

  // TEST 2: Destination discovery — $1000, nightlife + food
  console.log("\nTEST 2: Destination discovery — budget nightlife + food");
  const discoveryInput: TripPlannerInput = {
    destination: "",
    destinationUnknown: true,
    destinationDescription: "Nightlife and food, around $1000 for 5 days",
    flexibleDates: true,
    budget: "$500–$1,000",
    customBudget: 1000,
    travelers: "Friends",
    interests: ["Nightlife", "Food"],
    travelStyle: "Budget",
    pace: "Balanced",
  };
  const pipeline2 = await runPlanningPipeline(discoveryInput);
  assert(pipeline2.discoveryMatches !== null && pipeline2.discoveryMatches.length >= 3, "Returns multiple destination candidates");
  assert(pipeline2.context.mode === "destination_discovery", "Correct planning mode");
  assert(pipeline2.budgetEstimate !== null, "Produces budget estimate");
  if (pipeline2.budgetEstimate) {
    assert(pipeline2.budgetEstimate.total > 0, "Budget estimate is positive");
  }

  // TEST 3: Hate museums
  console.log("\nTEST 3: Museum dislike filtering");
  const noMuseumInput: TripPlannerInput = {
    ...pragueInput,
    additionalNotes: "I hate museums",
  };
  const ctx3 = buildEnhancedPlanningContext(noMuseumInput);
  assert(ctx3.dislikes.includes("museums"), "Parses museum dislike from notes");
  const retrieved3 = await retrieveContextForDestination("prague", ctx3);
  const ranked3 = rankAttractions(retrieved3.attractions, ctx3, retrieved3.neighborhoods);
  const museumInTop = ranked3.slice(0, 15).some((s) => s.attraction.category === "museum");
  assert(!museumInTop, "Museums excluded from top ranked attractions");

  // TEST 4: Make trip cheaper
  console.log("\nTEST 4: Budget optimization");
  const mockTrip: TripPlan = enrichTripPlan({
    tripSummary: "Test trip",
    destination: "Prague",
    country: "Czech Republic",
    dates: "Flexible",
    duration: 5,
    estimatedBudget: 2000,
    travelStyle: "Comfortable",
    interests: ["History"],
    recommendedNeighborhood: "Old Town",
    neighborhoodReason: "Central",
    neighborhoods: [],
    hotelRecommendations: [],
    activities: [],
    restaurants: [],
    transportation: [],
    dailyItinerary: [{ day: 1, title: "Day 1", morning: [], afternoon: [], evening: [] }],
    budgetBreakdown: { accommodation: 800, food: 500, activities: 400, transportation: 150, other: 150 },
    travelTips: [],
    packingRecommendations: [],
    travelEssentials: [],
  });
  const edit4 = await applyTripEdit(mockTrip, "Make my trip cheaper");
  assert(edit4.intent === "budget_optimization", "Detects budget optimization intent");
  assert(edit4.tripPlan.estimatedBudget < 2000, "Reduces estimated budget");

  // TEST 5: Move castle to day 3
  console.log("\nTEST 5: Partial itinerary edit — move activity");
  const tripWithCastle: TripPlan = {
    ...mockTrip,
    dailyItinerary: [
      {
        day: 1,
        title: "Day 1",
        morning: [{ name: "Prague Castle", description: "Castle visit", whyRecommended: "Iconic" }],
        afternoon: [],
        evening: [],
      },
      { day: 2, title: "Day 2", morning: [], afternoon: [], evening: [] },
      { day: 3, title: "Day 3", morning: [], afternoon: [], evening: [] },
    ],
  };
  const edit5 = await applyTripEdit(tripWithCastle, "Move Prague Castle to day 3");
  const day3 = edit5.tripPlan.dailyItinerary.find((d) => d.day === 3);
  assert(day3?.morning.some((a) => a.name.includes("Prague Castle")), "Castle moved to day 3");
  assert(
    !edit5.tripPlan.dailyItinerary.find((d) => d.day === 1)?.morning.some((a) => a.name.includes("Prague Castle")),
    "Castle removed from day 1"
  );

  // TEST 6: Give me 10 activities
  console.log("\nTEST 6: Top 10 relevant activities");
  const ctx6 = buildEnhancedPlanningContext(pragueInput);
  const retrieved6 = await retrieveContextForDestination("prague", ctx6);
  const ranked6 = rankAttractions(retrieved6.attractions, ctx6, retrieved6.neighborhoods);
  const top10 = ranked6.slice(0, 10);
  assert(top10.length === 10, "Returns 10 activities");
  assert(top10.every((s) => s.score > 0), "All scored attractions are relevant (positive score)");

  // TEST 7: Relaxed 3-day trip
  console.log("\nTEST 7: Relaxed pacing");
  const relaxedInput: TripPlannerInput = {
    ...pragueInput,
    startDate: "2026-06-01",
    endDate: "2026-06-04",
    pace: "Slow and relaxed",
  };
  const pipeline7 = await runPlanningPipeline(relaxedInput);
  assert(pipeline7.context.pace === "slow", "Parses relaxed pace");
  if (pipeline7.draftItinerary) {
    const maxActivities = Math.max(
      ...pipeline7.draftItinerary.days.map(
        (d) => d.morning.length + d.afternoon.length + d.evening.length
      )
    );
    assert(maxActivities <= 4, "Relaxed pace limits daily activities");
  }

  // TEST 8: Live hotel query — must not fabricate
  console.log("\nTEST 8: Live data unavailable handling");
  const edit8 = await applyTripEdit(mockTrip, "What's the cheapest hotel available tonight?");
  assert(edit8.intent === "live_data_query", "Detects live data query");
  assert(edit8.changesSummary.toLowerCase().includes("connected") || edit8.changesSummary.toLowerCase().includes("live"), "Does not fabricate live data answer");

  // TEST 9: Unknown destination
  console.log("\nTEST 9: Unknown destination");
  const unknownInput: TripPlannerInput = {
    ...pragueInput,
    destination: "NonexistentCity",
  };
  const pipeline9 = await runPlanningPipeline(unknownInput);
  assert(
    pipeline9.validation.issues.some((i) => i.code === "unknown_destination"),
    "Gracefully handles unknown destination"
  );

  // TEST 10: Conflicting preferences
  console.log("\nTEST 10: Conflicting luxury + low budget");
  const conflictInput: TripPlannerInput = {
    ...pragueInput,
    travelStyle: "Luxury",
    customBudget: 500,
    budget: "<$500",
  };
  const ctx10 = buildEnhancedPlanningContext(conflictInput);
  assert(ctx10.clarifyingQuestions.length > 0, "Surfaces tradeoff clarifying question for conflicting prefs");

  // Geographic grouping sanity check
  console.log("\nBONUS: Geographic grouping");
  const ctxGeo = buildEnhancedPlanningContext(pragueInput);
  const retrievedGeo = await retrieveContextForDestination("prague", ctxGeo);
  const rankedGeo = rankAttractions(retrievedGeo.attractions, ctxGeo, retrievedGeo.neighborhoods);
  const draftGeo = buildStructuredItinerary(
    rankedGeo,
    ctxGeo,
    { city: "Prague", country: "Czech Republic" },
    retrievedGeo.neighborhoods
  );
  assert(draftGeo.days.every((d) => d.title.includes("—")), "Days have neighborhood-focused titles");
  assert(draftGeo.selectedAttractionIds.length > 0, "Selects knowledge-backed attractions");

  // Intent classification
  console.log("\nBONUS: Intent classification");
  assert(inferPlanningMode(pragueInput, "Move castle to day 2") === "itinerary_edit", "Classifies edit intent");
  assert(inferPlanningMode(pragueInput, "Make it cheaper") === "budget_optimization", "Classifies budget intent");

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
