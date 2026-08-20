import {
  getAllDestinations,
  getDestination,
  getNeighborhoods,
  getAttractions,
  searchAttractions,
  getDayTrips,
  searchDestinations,
  findDestinationsByPreferences,
  buildPlanningContext,
  retrieveContextForDestination,
} from "../lib/knowledge";
import type { TripPlannerInput } from "../types/trip";

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

  console.log("\n=== KNOWLEDGE BASE RETRIEVAL TESTS ===\n");

  // 1. Search Prague for architecture
  console.log("1. Search Prague for architecture");
  const pragueArch = await searchAttractions("prague", ["architecture"]);
  assert(pragueArch.length > 0, "Returns architecture attractions in Prague");
  assert(
    pragueArch[0].bestFor.includes("architecture") || pragueArch[0].tags.includes("architecture"),
    "Top result is relevant to architecture"
  );

  // 2. Search Prague for nightlife
  console.log("\n2. Search Prague for nightlife");
  const pragueNight = await searchAttractions("prague", ["nightlife"]);
  assert(pragueNight.length > 0, "Returns nightlife attractions in Prague");

  // 3. Search Prague for history + architecture
  console.log("\n3. Search Prague for history + architecture");
  const pragueHistArch = await searchAttractions("prague", ["history", "architecture"]);
  assert(pragueHistArch.length > 0, "Returns history+architecture results");
  assert(pragueHistArch.length >= 5, "Returns at least 5 relevant attractions");

  // 4. Find destinations for a budget traveler
  console.log("\n4. Find destinations for a budget traveler");
  const budgetContext = buildPlanningContext({
    destination: "",
    destinationUnknown: true,
    flexibleDates: true,
    budget: "<$500",
    travelers: "Solo",
    interests: ["History"],
    travelStyle: "Budget",
    pace: "Balanced",
  } as TripPlannerInput);
  const budgetMatches = await findDestinationsByPreferences(budgetContext);
  assert(budgetMatches.length > 0, "Returns destination matches");
  assert(budgetMatches[0].score > 50, "Top match has score > 50");
  const budgetCities = budgetMatches.slice(0, 3).map((m) => m.destination.city);
  assert(
    budgetCities.some((c) => ["Prague", "Kraków", "Budapest"].includes(c)),
    "Budget destinations include known budget-friendly cities"
  );

  // 5. Find destinations for a nightlife traveler
  console.log("\n5. Find destinations for a nightlife traveler");
  const nightlifeContext = buildPlanningContext({
    destination: "",
    destinationUnknown: true,
    flexibleDates: true,
    budget: "$1,000–$2,000",
    travelers: "Friends",
    interests: ["Nightlife"],
    travelStyle: "Comfortable",
    pace: "Balanced",
  } as TripPlannerInput);
  const nightlifeMatches = await findDestinationsByPreferences(nightlifeContext);
  assert(nightlifeMatches.length > 0, "Returns nightlife matches");
  const nightlifeCities = nightlifeMatches.slice(0, 3).map((m) => m.destination.city);
  assert(
    nightlifeCities.some((c) => ["Berlin", "Prague", "Budapest", "Barcelona"].includes(c)),
    "Nightlife results include strong nightlife cities"
  );

  // 6. Find destinations for food + culture
  console.log("\n6. Find destinations for food + culture traveler");
  const foodCultureContext = buildPlanningContext({
    destination: "",
    destinationUnknown: true,
    flexibleDates: true,
    budget: "$1,000–$2,000",
    travelers: "Couple",
    interests: ["Food", "Culture"],
    travelStyle: "Comfortable",
    pace: "Slow and relaxed",
  } as TripPlannerInput);
  const foodCultureMatches = await findDestinationsByPreferences(foodCultureContext);
  assert(foodCultureMatches.length > 0, "Returns food+culture matches");
  const topFoodCities = foodCultureMatches.slice(0, 5).map((m) => m.destination.city);
  assert(
    topFoodCities.some((c) => ["Paris", "Rome", "Lisbon", "Barcelona"].includes(c)),
    "Food+culture results include expected cities"
  );

  // 7. Ensure irrelevant destinations score lower
  console.log("\n7. Irrelevant destinations score lower");
  const beachContext = buildPlanningContext({
    destination: "",
    destinationUnknown: true,
    flexibleDates: true,
    budget: "$1,000–$2,000",
    travelers: "Couple",
    interests: ["Beaches"],
    travelStyle: "Comfortable",
    pace: "Slow and relaxed",
  } as TripPlannerInput);
  const beachMatches = await findDestinationsByPreferences(beachContext);
  const pragueBeachScore = beachMatches.find((m) => m.destination.city === "Prague")?.score ?? 0;
  const barcelonaBeachScore = beachMatches.find((m) => m.destination.city === "Barcelona")?.score ?? 0;
  assert(
    barcelonaBeachScore > pragueBeachScore,
    "Barcelona scores higher than Prague for beaches"
  );

  // 8. Ensure AI receives retrieved context
  console.log("\n8. AI receives retrieved context");
  const retrievedCtx = await retrieveContextForDestination("prague", budgetContext);
  assert(retrievedCtx.destination !== null, "Retrieved context has destination");
  assert(retrievedCtx.neighborhoods.length > 0, "Retrieved context has neighborhoods");
  assert(retrievedCtx.attractions.length > 0, "Retrieved context has attractions");
  assert(retrievedCtx.dayTrips.length > 0, "Retrieved context has day trips");

  // 9. No live prices fabricated (check data integrity)
  console.log("\n9. No live prices fabricated");
  const allDests = await getAllDestinations();
  for (const d of allDests) {
    const attractions = await getAttractions(d.id);
    for (const a of attractions) {
      assert(
        !a.description.includes("€") && !a.description.includes("$"),
        `${d.city}/${a.name}: No specific prices in description`
      );
      if (!assert) break;
    }
  }

  // 10. Unknown destination doesn't crash
  console.log("\n10. Unknown destination doesn't crash");
  const unknown = await getDestination("atlantis");
  assert(unknown === null, "Returns null for unknown destination");
  const unknownNeighborhoods = await getNeighborhoods("atlantis");
  assert(unknownNeighborhoods.length === 0, "Returns empty neighborhoods for unknown");
  const unknownContext = await retrieveContextForDestination("atlantis");
  assert(unknownContext.destination === null, "Retrieved context is empty for unknown");

  // 11. All destinations have required data
  console.log("\n11. All destinations have required data");
  for (const d of allDests) {
    const n = await getNeighborhoods(d.id);
    const a = await getAttractions(d.id);
    assert(n.length >= 3, `${d.city} has >= 3 neighborhoods (got ${n.length})`);
    assert(a.length >= 20, `${d.city} has >= 20 attractions (got ${a.length})`);
  }

  // Summary
  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
