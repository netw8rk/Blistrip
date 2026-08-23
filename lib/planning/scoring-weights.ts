/**
 * Additive scoring weights for `scorePlace`.
 *
 * Typical total is roughly 0–120 points. Preference match is the largest
 * signal because the questionnaire is the source of personalization.
 * Quality uses rating × review-count confidence, not raw stars.
 *
 * Tune these values here. Do not scatter replacements through retrieve-places.
 */
export const SCORING_WEIGHTS = {
  /** Multiplied by the 1–10 interest score for most place types. */
  interestMatch: 5,
  /** Multiplied by the 1–10 nightlife score for bars/clubs. */
  nightlifeMatch: 6,
  /** Legacy raw-rating multiplier (kept for compatibility). Prefer reviewConfidence. */
  rating: 1.5,
  ratingCap: 8,
  /** Bonus when a venue has enough reviews to be established. */
  reviewSignal: 1,
  /**
   * Multiplied by rating × log-confidence (0–1).
   * A 5.0 with 3 reviews stays far below a 4.7 with thousands of reviews.
   */
  reviewConfidence: 2.2,
  reviewConfidenceCap: 12,
  budgetFit: 10,
  localVenue: 14,
  touristPenalty: 12,
  hoursKnown: 1,
  hoursCap: 4,
  familyNightlifePenalty: 24,
  dislikePenalty: 80,
  crowdDislike: 18,
  shoppingDislike: 80,
  longWalkDislike: 8,
  expensiveDislike: 10,
  closedTemporarily: 20,
  closedPermanently: 200,
  mismatchPenalty: 5,
  travelerFit: 10,
  dietaryFit: 14,
  dietaryClash: 16,
  /** Max selected places per neighborhood in the candidate pool. */
  neighborhoodCap: 3,
};

/**
 * Confidence-aware quality points.
 * log10(reviews+1) / log10(250) reaches full confidence around ~250 reviews.
 */
export function reviewConfidenceScore(rating?: number, reviewCount?: number): number {
  if (rating == null) return 0;
  const reviews = Math.max(0, reviewCount ?? 0);
  const confidence = Math.min(1, Math.log10(reviews + 1) / Math.log10(250));
  return Math.min(
    rating * confidence * SCORING_WEIGHTS.reviewConfidence,
    SCORING_WEIGHTS.reviewConfidenceCap
  );
}
