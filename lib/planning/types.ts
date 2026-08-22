import type {
  DestinationMatch,
  KnowledgeAttraction,
  RetrievedContext,
  TripPlanningContext,
} from "@/lib/knowledge/types";

export type FieldState = "known" | "unknown" | "inferred";

export type PlanningMode =
  | "specific_destination"
  | "destination_discovery"
  | "trip_optimization"
  | "itinerary_edit"
  | "recommendation"
  | "budget_optimization"
  | "preference_change"
  | "live_data_query";

export interface EnhancedTripPlanningContext extends TripPlanningContext {
  mode: PlanningMode;
  alternativeDestinations?: string[];
  mustSee?: string[];
  avoid?: string[];
  specialOccasion?: string;
  tripGoals?: string[];
  dislikes: string[];
  clarifyingQuestions: string[];
  fieldStates: Record<string, FieldState>;
  rawNotes?: string;
  rawDestinationDescription?: string;
}

export interface AttractionScore {
  attraction: KnowledgeAttraction;
  score: number;
  reasons: string[];
}

export interface PlannedActivity {
  id: string;
  knowledgeId?: string;
  name: string;
  type: string;
  description: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  durationMinutes: number;
  estimatedCostLevel: string;
  reason: string;
  travelTimeFromPreviousMinutes?: number;
  reservationRecommended: boolean;
  source: "blistrip" | "ai_estimate" | "verified";
  provider?: string;
  providerPlaceId?: string;
  address?: string;
  mapsUrl?: string;
  photoUrl?: string;
}

export interface PlannedDay {
  day: number;
  title: string;
  neighborhoodFocus?: string;
  morning: PlannedActivity[];
  afternoon: PlannedActivity[];
  evening: PlannedActivity[];
}

export interface StructuredItineraryDraft {
  destination: string;
  country: string;
  duration: number;
  pace: string;
  days: PlannedDay[];
  selectedAttractionIds: string[];
  geographicNotes: string[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  day?: number;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface BudgetLineItem {
  amount: number;
  confidence: "known" | "estimated" | "unknown";
}

export interface BudgetEstimate {
  accommodation: BudgetLineItem;
  food: BudgetLineItem;
  activities: BudgetLineItem;
  transportation: BudgetLineItem;
  other: BudgetLineItem;
  total: number;
  exceedsBudget?: boolean;
  overage?: number;
  optimizationSuggestions?: string[];
}

export interface PlanningPipelineResult {
  context: EnhancedTripPlanningContext;
  retrieved: RetrievedContext | null;
  discoveryMatches: DestinationMatch[] | null;
  rankedAttractions: AttractionScore[];
  draftItinerary: StructuredItineraryDraft | null;
  validation: ValidationResult;
  clarifyingQuestions: string[];
  budgetEstimate: BudgetEstimate | null;
}

export interface RefineTripRequest {
  tripPlan: import("@/types/trip").TripPlan;
  message: string;
}

export interface RefineTripResult {
  tripPlan: import("@/types/trip").TripPlan;
  intent: PlanningMode;
  changesSummary: string;
  validation: ValidationResult;
  liveDataUnavailable?: boolean;
}
