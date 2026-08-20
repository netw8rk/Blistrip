import type { KnowledgeAttraction, KnowledgeNeighborhood } from "@/lib/knowledge/types";
import type { EnhancedTripPlanningContext, AttractionScore } from "./types";

function matchesDislike(attraction: KnowledgeAttraction, dislikes: string[]): boolean {
  const nameDesc = `${attraction.name} ${attraction.description} ${attraction.category}`.toLowerCase();
  for (const dislike of dislikes) {
    const d = dislike.toLowerCase();
    if (d === "museums" && (attraction.category === "museum" || nameDesc.includes("museum"))) return true;
    if (d === "nightlife" && (attraction.category === "nightlife" || nameDesc.includes("club"))) return true;
    if (d === "shopping" && (attraction.category === "shopping" || nameDesc.includes("shop"))) return true;
    if (d === "crowds" && attraction.importance >= 9) return true;
    if (d === "long walks" && attraction.indoorOutdoor === "outdoor" && attraction.approximateDuration.includes("3")) return true;
  }
  return false;
}

export function scoreAttraction(
  attraction: KnowledgeAttraction,
  context: EnhancedTripPlanningContext,
  neighborhood?: KnowledgeNeighborhood
): AttractionScore {
  if (matchesDislike(attraction, context.dislikes ?? [])) {
    return { attraction, score: -100, reasons: ["Filtered by user dislikes"] };
  }

  let score = 0;
  const reasons: string[] = [];

  // Interest match (0–40)
  let interestPoints = 0;
  for (const interest of context.interests) {
    if (attraction.bestFor.includes(interest)) interestPoints += 8;
    if (attraction.tags.includes(interest)) interestPoints += 5;
  }
  interestPoints = Math.min(40, interestPoints);
  score += interestPoints;
  if (interestPoints >= 15) reasons.push("Strong interest match");

  // Importance (0–20)
  const importancePoints = (attraction.importance / 10) * 20;
  score += importancePoints;
  if (attraction.importance >= 8) reasons.push("Must-see destination highlight");

  // Budget match (0–15)
  if (context.budget) {
    const budgetOrder = ["budget", "moderate", "premium", "luxury"];
    const userLevel = budgetOrder.indexOf(context.budget);
    const attrLevel = budgetOrder.indexOf(attraction.priceLevel);
    const diff = attrLevel - userLevel;
    if (diff <= 0) {
      score += 15;
      if (diff < 0) reasons.push("Good value for budget");
    } else if (diff === 1) {
      score += 8;
    } else {
      score -= 5;
    }
  } else {
    score += 8;
  }

  // Traveler / style fit (0–10)
  if (context.travelers?.toLowerCase().includes("family") && attraction.bestFor.includes("family")) {
    score += 10;
    reasons.push("Family-friendly");
  }
  if (context.travelers?.toLowerCase().includes("solo") && attraction.bestFor.includes("solo")) {
    score += 8;
  }

  // Neighborhood boost (0–10)
  if (neighborhood && context.interests.some((i) => neighborhood.bestFor.includes(i))) {
    score += 6;
  }

  // Pace fit — longer activities penalized for packed pace on short trips
  const durationLower = attraction.approximateDuration.toLowerCase();
  if (context.pace === "packed" && durationLower.includes("half day")) {
    score -= 3;
  }
  if (context.pace === "slow" && attraction.category === "nightlife") {
    score += 3;
  }

  // Dislike penalty already handled; category-specific boosts
  if (context.dislikes.includes("museums") && attraction.category === "museum") {
    score = -100;
  }

  return { attraction, score: Math.round(score * 10) / 10, reasons };
}

export function rankAttractions(
  attractions: KnowledgeAttraction[],
  context: EnhancedTripPlanningContext,
  neighborhoods: KnowledgeNeighborhood[] = []
): AttractionScore[] {
  const neighborhoodMap = new Map(neighborhoods.map((n) => [n.id, n]));

  return attractions
    .map((a) =>
      scoreAttraction(a, context, neighborhoodMap.get(a.neighborhoodId))
    )
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function rankTopActivities(
  ranked: AttractionScore[],
  count: number
): AttractionScore[] {
  return ranked.slice(0, count);
}
