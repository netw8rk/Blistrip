import type {
  KnowledgeDestination,
  KnowledgeNeighborhood,
  KnowledgeAttraction,
  KnowledgeDayTrip,
} from "./types";

interface DestinationModule {
  destination: KnowledgeDestination;
  neighborhoods: KnowledgeNeighborhood[];
  attractions: KnowledgeAttraction[];
  dayTrips: KnowledgeDayTrip[];
}

let _cache: DestinationModule[] | null = null;

async function loadAllDestinations(): Promise<DestinationModule[]> {
  if (_cache) return _cache;

  const modules = await Promise.all([
    import("./data/prague"),
    import("./data/krakow"),
    import("./data/budapest"),
    import("./data/vienna"),
    import("./data/berlin"),
    import("./data/paris"),
    import("./data/lisbon"),
    import("./data/rome"),
    import("./data/barcelona"),
    import("./data/amsterdam"),
  ]);

  _cache = modules.map((m) => ({
    destination: m.destination,
    neighborhoods: m.neighborhoods,
    attractions: m.attractions,
    dayTrips: m.dayTrips,
  }));

  return _cache;
}

export async function getAllDestinations(): Promise<KnowledgeDestination[]> {
  const all = await loadAllDestinations();
  return all.map((m) => m.destination);
}

export async function getDestination(
  cityOrId: string
): Promise<KnowledgeDestination | null> {
  const all = await loadAllDestinations();
  const normalized = cityOrId.toLowerCase();
  const found = all.find(
    (m) =>
      m.destination.id === normalized ||
      m.destination.city.toLowerCase() === normalized
  );
  return found?.destination ?? null;
}

export async function getNeighborhoods(
  destinationId: string
): Promise<KnowledgeNeighborhood[]> {
  const all = await loadAllDestinations();
  const found = all.find((m) => m.destination.id === destinationId);
  return found?.neighborhoods ?? [];
}

export interface AttractionFilters {
  interests?: string[];
  budget?: string;
  indoorOutdoor?: string;
  category?: string;
  neighborhoodId?: string;
  limit?: number;
}

export async function getAttractions(
  destinationId: string,
  filters?: AttractionFilters
): Promise<KnowledgeAttraction[]> {
  const all = await loadAllDestinations();
  const found = all.find((m) => m.destination.id === destinationId);
  if (!found) return [];

  let results = [...found.attractions];

  if (filters?.interests?.length) {
    const interests = filters.interests.map((i) => i.toLowerCase());
    results.sort((a, b) => {
      const aScore = a.bestFor.filter((t) => interests.includes(t)).length +
        a.tags.filter((t) => interests.includes(t)).length;
      const bScore = b.bestFor.filter((t) => interests.includes(t)).length +
        b.tags.filter((t) => interests.includes(t)).length;
      if (bScore !== aScore) return bScore - aScore;
      return b.importance - a.importance;
    });
  } else {
    results.sort((a, b) => b.importance - a.importance);
  }

  if (filters?.budget) {
    const budgetOrder = ["budget", "moderate", "premium", "luxury"];
    const maxLevel = budgetOrder.indexOf(filters.budget);
    if (maxLevel >= 0) {
      results = results.filter(
        (a) => budgetOrder.indexOf(a.priceLevel) <= maxLevel
      );
    }
  }

  if (filters?.indoorOutdoor && filters.indoorOutdoor !== "both") {
    results = results.filter(
      (a) => a.indoorOutdoor === filters.indoorOutdoor || a.indoorOutdoor === "both"
    );
  }

  if (filters?.category) {
    results = results.filter((a) => a.category === filters.category);
  }

  if (filters?.neighborhoodId) {
    results = results.filter((a) => a.neighborhoodId === filters.neighborhoodId);
  }

  if (filters?.limit) {
    results = results.slice(0, filters.limit);
  }

  return results;
}

export async function searchAttractions(
  destinationId: string,
  interests: string[]
): Promise<KnowledgeAttraction[]> {
  return getAttractions(destinationId, { interests });
}

export async function getDayTrips(
  destinationId: string
): Promise<KnowledgeDayTrip[]> {
  const all = await loadAllDestinations();
  const found = all.find((m) => m.destination.id === destinationId);
  return found?.dayTrips ?? [];
}

export async function searchDestinations(criteria: {
  travelStyles?: string[];
  budgetLevel?: string;
  minTripLength?: number;
  maxTripLength?: number;
  month?: number;
}): Promise<KnowledgeDestination[]> {
  const all = await loadAllDestinations();
  let results = all.map((m) => m.destination);

  if (criteria.travelStyles?.length) {
    results = results.filter((d) =>
      criteria.travelStyles!.some((s) => d.travelStyles.includes(s as never))
    );
  }

  if (criteria.budgetLevel) {
    const budgetOrder = ["budget", "moderate", "premium", "luxury"];
    const maxLevel = budgetOrder.indexOf(criteria.budgetLevel);
    if (maxLevel >= 0) {
      results = results.filter(
        (d) => budgetOrder.indexOf(d.budgetLevel) <= maxLevel
      );
    }
  }

  if (criteria.minTripLength) {
    results = results.filter(
      (d) => d.idealTripLength.max >= criteria.minTripLength!
    );
  }

  if (criteria.maxTripLength) {
    results = results.filter(
      (d) => d.idealTripLength.min <= criteria.maxTripLength!
    );
  }

  if (criteria.month) {
    results = results.filter((d) => d.bestMonths.includes(criteria.month!));
  }

  return results;
}

export { loadAllDestinations };
