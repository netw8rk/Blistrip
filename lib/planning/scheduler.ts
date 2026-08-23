import type { KnowledgeNeighborhood } from "@/lib/knowledge/types";
import type {
  AttractionScore,
  EnhancedTripPlanningContext,
  PlannedActivity,
  PlannedDay,
  StructuredItineraryDraft,
} from "./types";
import { estimateWalkMinutes, haversineKm, orderByProximity, parseDurationMinutes } from "./geo";

const PACE_SLOTS: Record<string, { morning: number; afternoon: number; evening: number }> = {
  slow: { morning: 2, afternoon: 2, evening: 2 },
  balanced: { morning: 3, afternoon: 3, evening: 3 },
  packed: { morning: 3, afternoon: 4, evening: 3 },
};

const EVENING_CATEGORIES = new Set(["nightlife", "food"]);
const MORNING_CATEGORIES = new Set(["viewpoint", "park", "landmark", "historical", "architecture"]);

function toPlannedActivity(
  scored: AttractionScore,
  neighborhoodName?: string,
  travelMinutes?: number
): PlannedActivity {
  const a = scored.attraction;
  return {
    id: a.id,
    knowledgeId: a.id,
    name: a.name,
    type: a.category,
    description: a.description,
    neighborhood: neighborhoodName,
    latitude: a.latitude,
    longitude: a.longitude,
    durationMinutes: parseDurationMinutes(a.approximateDuration),
    estimatedCostLevel: a.priceLevel,
    reason: scored.reasons[0] ?? a.whyVisit,
    travelTimeFromPreviousMinutes: travelMinutes,
    reservationRecommended: a.bookingRequired,
    source: "blistrip",
  };
}

function assignTimeSlot(category: string): "morning" | "afternoon" | "evening" {
  if (EVENING_CATEGORIES.has(category)) return "evening";
  if (MORNING_CATEGORIES.has(category)) return "morning";
  return "afternoon";
}

function groupByNeighborhood(
  scored: AttractionScore[]
): Map<string, AttractionScore[]> {
  const groups = new Map<string, AttractionScore[]>();
  for (const s of scored) {
    const key = s.attraction.neighborhoodId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return groups;
}

export function buildStructuredItinerary(
  ranked: AttractionScore[],
  context: EnhancedTripPlanningContext,
  destination: { city: string; country: string },
  neighborhoods: KnowledgeNeighborhood[]
): StructuredItineraryDraft {
  const duration = context.tripLength ?? 5;
  const pace = context.pace ?? "balanced";
  const slots = PACE_SLOTS[pace] ?? PACE_SLOTS.balanced;
  const maxPerDay = slots.morning + slots.afternoon + slots.evening;
  const maxTotal = duration * maxPerDay;

  const selected = ranked.slice(0, maxTotal);
  const neighborhoodMap = new Map(neighborhoods.map((n) => [n.id, n]));
  const groups = groupByNeighborhood(selected);

  // Order neighborhoods by total score of their attractions
  const neighborhoodOrder = [...groups.entries()]
    .map(([id, items]) => ({
      id,
      name: neighborhoodMap.get(id)?.name ?? "City Center",
      totalScore: items.reduce((sum, i) => sum + i.score, 0),
      items,
    }))
    .sort((a, b) => b.totalScore - a.totalScore);

  const days: PlannedDay[] = [];
  const usedIds = new Set<string>();
  const geographicNotes: string[] = [];

  for (let day = 1; day <= duration; day++) {
    const neighborhoodIdx = (day - 1) % Math.max(neighborhoodOrder.length, 1);
    const primary = neighborhoodOrder[neighborhoodIdx];
    let dayPool: AttractionScore[] = primary ? [...primary.items] : [];

    // Fill from other neighborhoods if needed
    if (dayPool.length < maxPerDay) {
      for (const alt of neighborhoodOrder) {
        if (alt.id === primary?.id) continue;
        for (const item of alt.items) {
          if (!usedIds.has(item.attraction.id) && dayPool.length < maxPerDay) {
            dayPool.push(item);
          }
        }
      }
    }

    dayPool = dayPool.filter((s) => !usedIds.has(s.attraction.id)).slice(0, maxPerDay);

    const scoreById = new Map(dayPool.map((s) => [s.attraction.id, s]));
    const geoOrdered = orderByProximity(
      dayPool.map((s) => s.attraction)
    );

    const morning: PlannedActivity[] = [];
    const afternoon: PlannedActivity[] = [];
    const evening: PlannedActivity[] = [];
    const slotCounts = { morning: 0, afternoon: 0, evening: 0 };
    const slotLimits = { ...slots };

    let prevLat: number | undefined;
    let prevLng: number | undefined;

    for (const attraction of geoOrdered) {
      const scored = scoreById.get(attraction.id)!;
      usedIds.add(scored.attraction.id);

      let travelMinutes: number | undefined;
      if (prevLat !== undefined && prevLng !== undefined) {
        const dist = haversineKm(prevLat, prevLng, attraction.latitude, attraction.longitude);
        travelMinutes = estimateWalkMinutes(dist);
        if (travelMinutes > 25) {
          geographicNotes.push(
            `Day ${day}: ${travelMinutes}min travel between ${scored.attraction.name} and previous stop — grouped where possible.`
          );
        }
      }
      prevLat = attraction.latitude;
      prevLng = attraction.longitude;

      const neighborhoodName = neighborhoodMap.get(scored.attraction.neighborhoodId)?.name;
      const activity = toPlannedActivity(scored, neighborhoodName, travelMinutes);
      const slot = assignTimeSlot(scored.attraction.category);

      if (slotCounts[slot] < slotLimits[slot]) {
        if (slot === "morning") morning.push(activity);
        else if (slot === "afternoon") afternoon.push(activity);
        else evening.push(activity);
        slotCounts[slot]++;
      } else if (slotCounts.afternoon < slotLimits.afternoon) {
        afternoon.push(activity);
        slotCounts.afternoon++;
      } else if (slotCounts.morning < slotLimits.morning) {
        morning.push(activity);
        slotCounts.morning++;
      } else if (slotCounts.evening < slotLimits.evening) {
        evening.push(activity);
        slotCounts.evening++;
      }
    }

    const focusName = primary?.name ?? destination.city;
    days.push({
      day,
      title: `Day ${day} — ${focusName.split("(")[0].trim()}`,
      neighborhoodFocus: focusName,
      morning,
      afternoon,
      evening,
    });
  }

  return {
    destination: destination.city,
    country: destination.country,
    duration,
    pace,
    days,
    selectedAttractionIds: [...usedIds],
    geographicNotes: [...new Set(geographicNotes)].slice(0, 5),
  };
}
