import type { TripPlannerInput } from "@/types/trip";
import type {
  KnowledgeDestination,
  TripPlanningContext,
  DestinationMatch,
  RetrievedContext,
  TravelStyle,
} from "./types";
import {
  getAllDestinations,
  getDestination,
  getNeighborhoods,
  getAttractions,
  getDayTrips,
} from "./retrieval";
import { buildEnhancedPlanningContext } from "@/lib/planning/context";
/** @deprecated Use buildEnhancedPlanningContext from lib/planning for full context */
export function buildPlanningContext(input: TripPlannerInput) {
  return buildEnhancedPlanningContext(input);
}

export async function findDestinationsByPreferences(
  context: TripPlanningContext
): Promise<DestinationMatch[]> {
  const destinations = await getAllDestinations();
  const matches: DestinationMatch[] = [];

  for (const dest of destinations) {
    const { score, reasons } = scoreDestination(dest, context);
    matches.push({ destination: dest, score, matchReasons: reasons });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches;
}

function scoreDestination(
  dest: KnowledgeDestination,
  context: TripPlanningContext
): { score: number; reasons: string[] } {
  let score = 0;
  let maxPossible = 0;
  const reasons: string[] = [];

  // Interest matching (weighted heavily - 40% of score)
  if (context.interests.length > 0) {
    maxPossible += 40;
    const interestScoreMap: Partial<Record<TravelStyle, keyof KnowledgeDestination["scores"]>> = {
      nightlife: "nightlife",
      food: "food",
      history: "history",
      architecture: "architecture",
      nature: "nature",
      culture: "culture",
      family: "family",
      solo: "solo",
      romantic: "romantic",
      relaxation: "romantic",
    };

    let totalInterestScore = 0;
    let matchedInterests = 0;

    for (const interest of context.interests) {
      const scoreKey = interestScoreMap[interest];
      if (scoreKey && dest.scores[scoreKey] !== undefined) {
        totalInterestScore += dest.scores[scoreKey];
        if (dest.scores[scoreKey] >= 7) matchedInterests++;
      }
      if (dest.travelStyles.includes(interest)) {
        totalInterestScore += 3;
        matchedInterests++;
      }
    }

    const avgInterest = totalInterestScore / Math.max(context.interests.length, 1);
    const interestPoints = Math.min(40, (avgInterest / 13) * 40);
    score += interestPoints;

    if (matchedInterests > 0) {
      reasons.push(
        `Strong match for ${context.interests.slice(0, 3).join(", ")}`
      );
    }
  } else {
    maxPossible += 40;
    score += 20;
  }

  // Budget matching (25% of score)
  maxPossible += 25;
  if (context.budget) {
    const budgetOrder = ["budget", "moderate", "premium", "luxury"];
    const userLevel = budgetOrder.indexOf(context.budget);
    const destLevel = budgetOrder.indexOf(dest.budgetLevel);
    const diff = Math.abs(userLevel - destLevel);

    if (diff === 0) {
      score += 25;
      reasons.push("Perfect budget match");
    } else if (diff === 1) {
      score += 18;
      reasons.push("Close budget match");
    } else if (destLevel < userLevel) {
      score += 15;
      reasons.push("Under budget — good value");
    } else {
      score += 5;
    }
  } else {
    score += 15;
  }

  // Trip length matching (20% of score)
  maxPossible += 20;
  if (context.tripLength) {
    const { min, max } = dest.idealTripLength;
    if (context.tripLength >= min && context.tripLength <= max) {
      score += 20;
      reasons.push(`Ideal for ${context.tripLength}-day trip`);
    } else if (context.tripLength >= min - 1 && context.tripLength <= max + 2) {
      score += 14;
    } else {
      score += 5;
    }
  } else {
    score += 10;
  }

  // Season matching (15% of score)
  maxPossible += 15;
  if (context.dates?.start) {
    const month = new Date(context.dates.start).getMonth() + 1;
    if (dest.bestMonths.includes(month)) {
      score += 15;
      reasons.push("Great time to visit");
    } else {
      score += 7;
    }
  } else {
    score += 10;
  }

  const percentage = Math.round((score / maxPossible) * 100);
  return { score: percentage, reasons };
}

export async function retrieveContextForDestination(
  cityOrId: string,
  context?: TripPlanningContext
): Promise<RetrievedContext> {
  const destination = await getDestination(cityOrId);
  if (!destination) {
    return { destination: null, neighborhoods: [], attractions: [], dayTrips: [] };
  }

  const [neighborhoods, dayTrips] = await Promise.all([
    getNeighborhoods(destination.id),
    getDayTrips(destination.id),
  ]);

  const attractions = await getAttractions(destination.id, {
    interests: context?.interests,
    budget: context?.budget,
    limit: context?.pace === "packed" ? 40 : context?.pace === "slow" ? 15 : 25,
  });

  return { destination, neighborhoods, attractions, dayTrips };
}
