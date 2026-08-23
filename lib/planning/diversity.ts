import type { NormalizedPlace } from "@/lib/travel/types";
import type { UserTripPreferences } from "./preferences";
import type { PlannedDay, StructuredItineraryDraft } from "./types";
import {
  classifyPlace,
  entertainmentExpressionKinds,
  foodExpressionKinds,
  interestForKind,
  type ActivityKind,
  type InterestCategory,
  type PlaceTaxonomy,
} from "./activity-taxonomy";
import { recentUsePenalty } from "./recent-places";

export { clearRecentPlaces } from "./recent-places";

export const DIVERSITY_CONFIG = {
  /** 0.15 = more deterministic, 0.45 = more exploration. */
  temperature: 0.32,
  /** Keep randomness inside this fraction of the top score. */
  qualityBand: 0.15,
  /** Absolute floor so a 40-point place cannot beat a 90 via luck. */
  minBandPoints: 8,
  maxBandPoints: 14,
  firstRepeat: 6,
  secondRepeat: 18,
  thirdRepeat: 34,
  extraRepeat: 50,
  recentUseWeight: 1,
  unusedNoveltyBonus: 3,
  sameDayShapePenalty: 16,
};

export interface DiversityDebug {
  temperature: number;
  seed: number;
  tripKindCounts: Record<string, number>;
  dayShapes: string[];
  itineraryScore?: number;
  scoreBreakdown?: Record<string, number>;
  rejected: Array<{ name: string; reason: string }>;
}

export class DiversityTracker {
  readonly seed: number;
  readonly temperature: number;
  readonly city: string;
  readonly kinds = new Map<ActivityKind, number>();
  readonly interests = new Map<InterestCategory, number>();
  readonly types = new Map<string, number>();
  readonly dayShapes: string[] = [];
  readonly rejected: Array<{ name: string; reason: string }> = [];
  private rngState: number;

  constructor(options: { seed?: number; temperature?: number; city?: string } = {}) {
    this.seed = options.seed ?? Date.now() % 1_000_000;
    this.temperature = options.temperature ?? DIVERSITY_CONFIG.temperature;
    this.city = options.city ?? "";
    this.rngState = this.seed || 1;
  }

  classify(place: NormalizedPlace): PlaceTaxonomy {
    return classifyPlace(place);
  }

  nextRandom(): number {
    this.rngState = (this.rngState * 1664525 + 1013904223) >>> 0;
    return this.rngState / 0x100000000;
  }

  record(place: NormalizedPlace) {
    const taxonomy = this.classify(place);
    this.kinds.set(taxonomy.primaryKind, (this.kinds.get(taxonomy.primaryKind) ?? 0) + 1);
    this.interests.set(taxonomy.interestCategory, (this.interests.get(taxonomy.interestCategory) ?? 0) + 1);
    this.types.set(place.type, (this.types.get(place.type) ?? 0) + 1);
  }

  recordDayShape(shape: string) {
    this.dayShapes.push(shape);
  }

  repetitionPenalty(place: NormalizedPlace, prefs: UserTripPreferences): number {
    const taxonomy = this.classify(place);
    const used = this.kinds.get(taxonomy.primaryKind) ?? 0;
    if (used <= 0) return 0;

    const allowed = allowedRepeats(taxonomy.primaryKind, prefs);
    const steps = [0, DIVERSITY_CONFIG.firstRepeat, DIVERSITY_CONFIG.secondRepeat, DIVERSITY_CONFIG.thirdRepeat, DIVERSITY_CONFIG.extraRepeat];
    let penalty = steps[Math.min(used, steps.length - 1)];
    if (used < allowed) penalty *= 0.4;
    return penalty;
  }

  noveltyBonus(place: NormalizedPlace): number {
    const recent = recentUsePenalty(this.city, place.providerPlaceId || place.id);
    if (recent <= 0 && (this.kinds.get(this.classify(place).primaryKind) ?? 0) === 0) {
      return DIVERSITY_CONFIG.unusedNoveltyBonus;
    }
    return -recent * DIVERSITY_CONFIG.recentUseWeight;
  }

  selectionScore(
    relevance: number,
    place: NormalizedPlace,
    prefs: UserTripPreferences
  ): number {
    return (
      relevance +
      this.noveltyBonus(place) -
      this.repetitionPenalty(place, prefs)
    );
  }

  pickFromBand<T extends { score: number; place: NormalizedPlace }>(items: T[]): T | undefined {
    if (!items.length) return undefined;
    const ranked = [...items].sort((a, b) => b.score - a.score);
    const top = ranked[0].score;
    const bandWidth = Math.min(
      DIVERSITY_CONFIG.maxBandPoints,
      Math.max(DIVERSITY_CONFIG.minBandPoints, top * DIVERSITY_CONFIG.qualityBand)
    );
    const band = ranked.filter((item) => item.score >= top - bandWidth);
    if (band.length === 1) return band[0];

    const temperature = Math.max(0.08, this.temperature);
    const weights = band.map((item) => Math.exp((item.score - top) / (temperature * Math.max(bandWidth, 1))));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = this.nextRandom() * total;
    for (let index = 0; index < band.length; index += 1) {
      cursor -= weights[index];
      if (cursor <= 0) return band[index];
    }
    return band[0];
  }

  snapshot(): DiversityDebug {
    return {
      temperature: this.temperature,
      seed: this.seed,
      tripKindCounts: Object.fromEntries(this.kinds),
      dayShapes: [...this.dayShapes],
      rejected: this.rejected.slice(0, 20),
    };
  }
}

export function allowedRepeats(kind: ActivityKind, prefs: UserTripPreferences): number {
  const days = Math.max(1, prefs.tripLength);
  const interest = interestForKind(kind);
  const strength = interestStrength(interest, prefs);
  if (strength >= 8) return Math.max(3, Math.ceil(days * 0.8));
  if (strength >= 6) return Math.max(2, Math.ceil(days * 0.55));
  return Math.max(1, Math.ceil(days * 0.35));
}

export function interestStrength(interest: InterestCategory, prefs: UserTripPreferences): number {
  const s = prefs.scores;
  switch (interest) {
    case "culture":
      return Math.max(s.history, s.architecture, s.culture);
    case "food":
      return s.food;
    case "entertainment":
      return s.nightlife;
    case "outdoor":
      return Math.max(s.nature, s.beaches, s.adventure, s.relaxation);
    case "exploration":
      return Math.max(s.localExperiences, s.shopping);
    case "experience":
      return Math.max(s.adventure, s.localExperiences);
    default:
      return 0;
  }
}

export function availableInterests(prefs: UserTripPreferences): InterestCategory[] {
  const interests: InterestCategory[] = [];
  const push = (interest: InterestCategory, score: number, blocked = false) => {
    if (blocked || score < 6) return;
    interests.push(interest);
  };
  push("culture", interestStrength("culture", prefs), prefs.dislikes.includes("museums") && interestStrength("culture", prefs) < 8);
  push("food", interestStrength("food", prefs));
  push(
    "entertainment",
    interestStrength("entertainment", prefs),
    prefs.dislikes.includes("nightlife") || prefs.travelers === "Family"
  );
  push("outdoor", interestStrength("outdoor", prefs), prefs.dislikes.includes("long walks"));
  push("exploration", interestStrength("exploration", prefs), prefs.dislikes.includes("shopping") && prefs.scores.localExperiences < 6);
  push("experience", interestStrength("experience", prefs));
  if (!interests.length) {
    if (prefs.scores.food >= 4) interests.push("food");
    interests.push("culture");
  }
  return interests;
}

export interface DayShape {
  morning: InterestCategory;
  afternoon: InterestCategory;
  evening: InterestCategory;
  morningKinds?: ActivityKind[];
  afternoonKinds?: ActivityKind[];
  eveningKinds?: ActivityKind[];
}

export function buildDayShapes(prefs: UserTripPreferences, seed: number): DayShape[] {
  const interests = availableInterests(prefs);
  const days = Math.max(1, prefs.tripLength);
  const morningPool = interests.filter((item) => item !== "entertainment");
  const afternoonPool = interests.filter((item) => item !== "entertainment");
  const eveningPool = interests.filter((item) => item === "food" || item === "entertainment" || item === "culture");
  const morningOptions = morningPool.length ? morningPool : ["culture"];
  const afternoonOptions = afternoonPool.length ? afternoonPool : morningOptions;
  const eveningOptions = eveningPool.length ? eveningPool : ["food"];

  return Array.from({ length: days }, (_, index) => {
    const morning = morningOptions[(index + seed) % morningOptions.length];
    let afternoon = afternoonOptions[(index + seed + 1) % afternoonOptions.length];
    if (afternoon === morning && afternoonOptions.length > 1) {
      afternoon = afternoonOptions[(index + seed + 2) % afternoonOptions.length];
    }
    const evening = eveningOptions[(index + seed + (prefs.scores.nightlife >= 6 ? 0 : 1)) % eveningOptions.length];
    return {
      morning,
      afternoon,
      evening,
      morningKinds: kindsForInterest(morning, "morning"),
      afternoonKinds: kindsForInterest(afternoon, "afternoon"),
      eveningKinds: kindsForInterest(evening, "evening"),
    };
  });
}

function kindsForInterest(interest: InterestCategory, slot: "morning" | "afternoon" | "evening"): ActivityKind[] {
  if (interest === "food") {
    if (slot === "morning") return ["bakery", "cafe", "food_market"];
    if (slot === "afternoon") return ["food_market", "cafe", "restaurant"];
    return ["restaurant", "tasting", "food_market"];
  }
  if (interest === "entertainment") return entertainmentExpressionKinds();
  if (interest === "culture") {
    return slot === "evening" ? ["landmark", "theater"] : ["historical_site", "architecture", "landmark", "museum", "gallery"];
  }
  if (interest === "outdoor") return ["park", "viewpoint", "waterfront", "hiking"];
  if (interest === "exploration") return ["neighborhood", "market", "shopping", "food_market"];
  return ["tour", "adventure", "neighborhood"];
}

export function shapeBoost(place: NormalizedPlace, shape: DayShape | undefined, slot: "morning" | "afternoon" | "evening"): number {
  if (!shape) return 0;
  const taxonomy = classifyPlace(place);
  const target = shape[slot];
  const kinds = slot === "morning" ? shape.morningKinds : slot === "afternoon" ? shape.afternoonKinds : shape.eveningKinds;
  let boost = 0;
  if (taxonomy.interestCategory === target) boost += 10;
  if (kinds?.includes(taxonomy.primaryKind)) boost += 8;
  if (target === "food" && foodExpressionKinds().includes(taxonomy.primaryKind) && taxonomy.primaryKind !== "restaurant" && slot !== "evening") {
    boost += 4;
  }
  if (slot === "morning" && taxonomy.primaryKind === "restaurant") boost -= 6;
  if (slot === "evening" && taxonomy.primaryKind === "cafe") boost -= 4;
  return boost;
}

export function scoreItineraryDraft(
  draft: StructuredItineraryDraft,
  prefs: UserTripPreferences,
  tracker?: DiversityTracker
): { total: number; breakdown: Record<string, number> } {
  const stops = draft.days.flatMap((day) => [...day.morning, ...day.afternoon, ...day.evening]);
  const kinds = stops.map((stop) => classifyPlace({ name: stop.name, type: stop.type }).primaryKind);
  const uniqueKinds = new Set(kinds);
  const uniqueTypes = new Set(stops.map((stop) => stop.type));
  const shapes = draft.days.map(dayShapeKey);
  const uniqueShapes = new Set(shapes);

  const preferenceFit = Math.min(40, uniqueKinds.size * 4);
  const diversity = Math.min(24, uniqueTypes.size * 3 + uniqueKinds.size * 2);
  const structure = Math.min(16, uniqueShapes.size * 5);
  const paceFit = paceScore(draft, prefs);
  const repetition = repetitionScore(kinds);
  const novelty = tracker ? Math.min(10, tracker.seed % 7) : 4;

  const breakdown = {
    preferenceFit,
    diversity,
    structure,
    paceFit,
    novelty,
    repetition: -repetition,
  };
  return { total: preferenceFit + diversity + structure + paceFit + novelty - repetition, breakdown };
}

function dayShapeKey(day: PlannedDay): string {
  const slot = (stops: PlannedDay["morning"]) =>
    classifyPlace({ name: stops[0]?.name, type: stops[0]?.type }).interestCategory;
  return [slot(day.morning), slot(day.afternoon), slot(day.evening)].join(">");
}

function paceScore(draft: StructuredItineraryDraft, prefs: UserTripPreferences): number {
  const perDay = draft.days.map((day) => day.morning.length + day.afternoon.length + day.evening.length);
  const avg = perDay.reduce((sum, count) => sum + count, 0) / Math.max(1, perDay.length);
  const target = prefs.pace === "slow" ? 4 : prefs.pace === "packed" ? 7 : 5.5;
  return Math.max(0, 12 - Math.abs(avg - target) * 3);
}

function repetitionScore(kinds: ActivityKind[]): number {
  const counts = new Map<ActivityKind, number>();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  let penalty = 0;
  for (const count of counts.values()) {
    if (count >= 4) penalty += 18;
    else if (count >= 3) penalty += 10;
  }
  return penalty;
}

export function formatDiversityLog(debug: DiversityDebug): string {
  return [
    "DIVERSITY",
    `  seed ${debug.seed} · temperature ${debug.temperature}`,
    `  kinds: ${Object.entries(debug.tripKindCounts).map(([kind, count]) => `${kind}:${count}`).join(", ") || "(none)"}`,
    `  day shapes: ${debug.dayShapes.join(" | ") || "(none)"}`,
    debug.itineraryScore != null ? `  itinerary score ${debug.itineraryScore}` : "",
    debug.scoreBreakdown
      ? `  breakdown: ${Object.entries(debug.scoreBreakdown).map(([key, value]) => `${key} ${value}`).join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
