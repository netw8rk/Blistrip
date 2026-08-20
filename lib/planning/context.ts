import type { TripPlannerInput } from "@/types/trip";
import type { TravelStyle, BudgetLevel } from "@/lib/knowledge/types";
import { mapInterestToTravelStyle, mapBudgetToLevel } from "@/lib/knowledge/taxonomy";
import type { EnhancedTripPlanningContext, FieldState, PlanningMode } from "./types";
import type { TripPlan } from "@/types/trip";

const DISLIKE_PATTERNS: { pattern: RegExp; dislike: string; interests?: TravelStyle[] }[] = [
  { pattern: /\bhate\s+museums?\b|\bno\s+museums?\b|\bdon'?t\s+(like|want)\s+museums?\b/i, dislike: "museums", interests: ["culture"] },
  { pattern: /\bhate\s+nightlife\b|\bno\s+clubs?\b|\bnot\s+into\s+nightlife\b/i, dislike: "nightlife", interests: ["nightlife"] },
  { pattern: /\bhate\s+crowds?\b|\bavoid\s+tourists?\b|\bno\s+tourist\s+traps?\b/i, dislike: "crowds" },
  { pattern: /\bno\s+shopping\b|\bhate\s+shopping\b/i, dislike: "shopping" },
  { pattern: /\bvegetarian\b|\bvegan\b/i, dislike: "meat-heavy", interests: ["food"] },
  { pattern: /\bno\s+long\s+walks?\b|\blimited\s+mobility\b|\bwheelchair\b/i, dislike: "long walks" },
];

const PREFERENCE_PATTERNS: { pattern: RegExp; interest: TravelStyle }[] = [
  { pattern: /\bnightlife\b|\bclubs?\b|\bbars?\b/i, interest: "nightlife" },
  { pattern: /\bfood\b|\brestaurants?\b|\bcuisine\b|\beat\b/i, interest: "food" },
  { pattern: /\bhistory\b|\bhistorical\b/i, interest: "history" },
  { pattern: /\barchitecture\b|\bbuildings?\b/i, interest: "architecture" },
  { pattern: /\bmuseums?\b|\bculture\b|\bart\b/i, interest: "culture" },
  { pattern: /\bnature\b|\bparks?\b|\bhiking\b/i, interest: "nature" },
  { pattern: /\brelax\b|\brelaxed\b|\bslow\b/i, interest: "relaxation" },
  { pattern: /\badventure\b|\bactive\b/i, interest: "adventure" },
  { pattern: /\bluxury\b|\bupscale\b|\bhigh[- ]end\b/i, interest: "luxury" },
  { pattern: /\bbudget\b|\bcheap\b|\baffordable\b/i, interest: "budget" },
];

function fieldState<T>(value: T | undefined, inferred = false): FieldState {
  if (value === undefined || value === null || value === "") return "unknown";
  return inferred ? "inferred" : "known";
}

function parseFreeText(text: string): { dislikes: string[]; interests: TravelStyle[]; tripGoals: string[] } {
  const dislikes: string[] = [];
  const interests: TravelStyle[] = [];
  const tripGoals: string[] = [];

  for (const { pattern, dislike, interests: related } of DISLIKE_PATTERNS) {
    if (pattern.test(text)) {
      dislikes.push(dislike);
      if (related) {
        for (const r of related) {
          if (!interests.includes(r)) interests.push(r);
        }
      }
    }
  }

  for (const { pattern, interest } of PREFERENCE_PATTERNS) {
    if (pattern.test(text) && !interests.includes(interest)) {
      interests.push(interest);
    }
  }

  if (/\bhoneymoon\b|\banniversary\b/i.test(text)) tripGoals.push("romantic occasion");
  if (/\bbirthday\b/i.test(text)) tripGoals.push("celebration");
  if (/\bfirst time\b|\bfirst visit\b/i.test(text)) tripGoals.push("first visit");

  return { dislikes, interests, tripGoals };
}

export function inferPlanningMode(
  input: TripPlannerInput,
  userMessage?: string,
  existingPlan?: TripPlan
): PlanningMode {
  const msg = (userMessage ?? "").toLowerCase();

  if (msg) {
    if (
      /\b(hotel|flight|available tonight|opening hours|ticket availability|book tonight)\b/i.test(msg) &&
      /\b(cheapest|available|price|cost|book)\b/i.test(msg)
    ) {
      return "live_data_query";
    }
    if (/\b(cheaper|under \$|reduce budget|save money|cut cost)\b/i.test(msg) && !/\b(hotel|flight|tonight)\b/i.test(msg)) {
      return "budget_optimization";
    }
    if (/\b(cheapest)\b/i.test(msg) && /\b(hotel|flight|tonight)\b/i.test(msg)) {
      return "live_data_query";
    }
    if (/\b(move|day \d|swap|switch|reschedule)\b/i.test(msg)) {
      return "itinerary_edit";
    }
    if (/\b(hate|don't like|avoid|no more|remove|without)\b/i.test(msg)) {
      return "preference_change";
    }
    if (/\b(what should|recommend|suggest|things to do|activities)\b/i.test(msg)) {
      return "recommendation";
    }
    if (/\b(better|improve|optimize|fix)\b.*\b(itinerary|trip|plan)\b/i.test(msg)) {
      return "trip_optimization";
    }
    if (/\b(hotel|flight|available tonight|opening hours|ticket availability)\b/i.test(msg)) {
      return "live_data_query";
    }
  }

  if (existingPlan && userMessage) return "itinerary_edit";
  if (input.destinationUnknown) return "destination_discovery";
  if (input.destination) return "specific_destination";
  return "specific_destination";
}

export function buildEnhancedPlanningContext(
  input: TripPlannerInput,
  options?: {
    userMessage?: string;
    existingPlan?: TripPlan;
    priorContext?: EnhancedTripPlanningContext;
  }
): EnhancedTripPlanningContext {
  const prior = options?.priorContext;
  const freeText = [
    input.additionalNotes ?? "",
    input.destinationDescription ?? "",
    options?.userMessage ?? "",
  ].join(" ");

  const parsed = parseFreeText(freeText);

  const interests: TravelStyle[] = [
    ...(prior?.interests ?? []),
    ...input.interests.map(mapInterestToTravelStyle).filter((s): s is TravelStyle => s !== null),
    ...parsed.interests,
  ];

  const uniqueInterests = [...new Set(interests)];

  const travelStyleMap: Record<string, TravelStyle> = {
    Budget: "budget",
    Comfortable: "culture",
    Luxury: "luxury",
    Backpacker: "backpacker",
    "Mix of everything": "culture",
  };

  const style = travelStyleMap[input.travelStyle];
  if (style && !uniqueInterests.includes(style)) {
    uniqueInterests.push(style);
  }

  const paceMap: Record<string, "slow" | "balanced" | "packed"> = {
    "Slow and relaxed": "slow",
    Balanced: "balanced",
    "Pack everything in": "packed",
  };

  let tripLength: number | undefined;
  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    tripLength = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  } else if (options?.existingPlan?.duration) {
    tripLength = options.existingPlan.duration;
  } else if (prior?.tripLength) {
    tripLength = prior.tripLength;
  }

  const dislikes = [...new Set([...(prior?.dislikes ?? []), ...parsed.dislikes])];

  const destination =
    prior?.destination ??
    (input.destinationUnknown ? undefined : input.destination || options?.existingPlan?.destination);

  const budget = input.budget ? mapBudgetToLevel(input.budget) : prior?.budget;
  const budgetAmount = input.customBudget ?? prior?.budgetAmount;

  const mode = inferPlanningMode(input, options?.userMessage, options?.existingPlan);

  const fieldStates: Record<string, FieldState> = {
    destination: fieldState(destination, !!prior?.destination),
    tripLength: fieldState(tripLength, !input.startDate),
    budget: fieldState(budget, !input.budget),
    budgetAmount: fieldState(budgetAmount),
    interests: uniqueInterests.length > 0 ? (input.interests.length > 0 ? "known" : "inferred") : "unknown",
    pace: fieldState(paceMap[input.pace] ?? prior?.pace, !input.pace),
    travelers: fieldState(input.travelers || prior?.travelers),
  };

  const clarifyingQuestions = buildClarifyingQuestions({
    mode,
    destination,
    tripLength,
    budget,
    budgetAmount,
    travelStyle: input.travelStyle,
    interests: uniqueInterests,
    dates:
      input.startDate && input.endDate
        ? { start: input.startDate, end: input.endDate }
        : prior?.dates,
    destinationUnknown: input.destinationUnknown,
  });

  return {
    destination,
    origin: prior?.origin,
    dates:
      input.startDate && input.endDate
        ? { start: input.startDate, end: input.endDate }
        : prior?.dates,
    tripLength: tripLength || prior?.tripLength || 5,
    budget: budget as BudgetLevel | undefined,
    budgetAmount,
    travelers: input.travelers || prior?.travelers,
    travelerType: prior?.travelerType,
    interests: uniqueInterests,
    dislikes,
    pace: paceMap[input.pace] ?? prior?.pace ?? "balanced",
    accommodationPreference: prior?.accommodationPreference,
    nightlifePreference: parsed.interests.includes("nightlife") ? 9 : prior?.nightlifePreference,
    foodPreference: parsed.interests.includes("food") ? 9 : prior?.foodPreference,
    transportationPreference: prior?.transportationPreference,
    mode,
    mustSee: prior?.mustSee,
    avoid: dislikes,
    tripGoals: [...new Set([...(prior?.tripGoals ?? []), ...parsed.tripGoals])],
    clarifyingQuestions,
    fieldStates,
    rawNotes: input.additionalNotes,
    rawDestinationDescription: input.destinationDescription,
  };
}

function buildClarifyingQuestions(params: {
  mode: PlanningMode;
  destination?: string;
  tripLength?: number;
  budget?: string;
  budgetAmount?: number;
  travelStyle?: string;
  interests: TravelStyle[];
  dates?: { start: string; end: string };
  destinationUnknown: boolean;
}): string[] {
  const questions: string[] = [];

  if (params.mode === "live_data_query") return questions;

  if (params.destinationUnknown && params.interests.length === 0) {
    questions.push("What kind of trip vibe are you after — food, nightlife, history, beaches, or a mix?");
    return questions.slice(0, 2);
  }

  if (params.destinationUnknown && !params.budget && !params.budgetAmount) {
    questions.push("What's your approximate total budget for the trip?");
  }

  if (params.destination && !params.dates && !params.tripLength) {
    questions.push(`What month or dates are you thinking for ${params.destination}?`);
  }

  if (params.budgetAmount && params.budgetAmount < 800) {
    const wantsLuxury =
      params.budget === "luxury" ||
      (params as { travelStyle?: string }).travelStyle === "Luxury";
    if (wantsLuxury) {
      questions.push(
        "Your budget is quite tight for a luxury style — should I optimize for value while keeping comfort where it matters?"
      );
    }
  }

  return questions.slice(0, 3);
}
