export type TravelStyle =
  | "budget"
  | "luxury"
  | "backpacker"
  | "nightlife"
  | "food"
  | "history"
  | "architecture"
  | "culture"
  | "nature"
  | "adventure"
  | "romantic"
  | "solo"
  | "family"
  | "relaxation"
  | "photography";

export type AttractionType =
  | "landmark"
  | "museum"
  | "historical"
  | "architecture"
  | "viewpoint"
  | "market"
  | "neighborhood"
  | "park"
  | "nightlife"
  | "food"
  | "shopping"
  | "religious"
  | "cultural"
  | "outdoor"
  | "day-trip";

export type BudgetLevel = "budget" | "moderate" | "premium" | "luxury";
export type IndoorOutdoor = "indoor" | "outdoor" | "both";

export interface KnowledgeDestination {
  id: string;
  city: string;
  country: string;
  region: string;
  description: string;
  shortDescription: string;
  latitude: number;
  longitude: number;
  budgetLevel: BudgetLevel;
  idealTripLength: { min: number; max: number };
  bestMonths: number[];
  travelStyles: TravelStyle[];
  strengths: string[];
  weaknesses: string[];
  scores: {
    nightlife: number;
    food: number;
    history: number;
    architecture: number;
    nature: number;
    beach: number;
    culture: number;
    family: number;
    solo: number;
    romantic: number;
  };
}

export interface KnowledgeNeighborhood {
  id: string;
  destinationId: string;
  name: string;
  description: string;
  vibe: string;
  bestFor: TravelStyle[];
  budgetLevel: BudgetLevel;
  scores: {
    nightlife: number;
    food: number;
    architecture: number;
    safety: number;
  };
  latitude: number;
  longitude: number;
  notableAttractions: string[];
}

export interface KnowledgeAttraction {
  id: string;
  destinationId: string;
  name: string;
  category: AttractionType;
  description: string;
  whyVisit: string;
  bestFor: TravelStyle[];
  approximateDuration: string;
  priceLevel: BudgetLevel;
  indoorOutdoor: IndoorOutdoor;
  neighborhoodId: string;
  latitude: number;
  longitude: number;
  tags: TravelStyle[];
  importance: number;
  bookingRequired: boolean;
}

export interface KnowledgeDayTrip {
  id: string;
  destinationId: string;
  name: string;
  description: string;
  duration: string;
  costLevel: BudgetLevel;
  travelTime: string;
  bestFor: TravelStyle[];
  tags: TravelStyle[];
}

export interface TripPlanningContext {
  destination?: string;
  origin?: string;
  dates?: { start: string; end: string };
  tripLength?: number;
  budget?: BudgetLevel;
  budgetAmount?: number;
  travelers?: string;
  travelerType?: string;
  interests: TravelStyle[];
  dislikes?: string[];
  pace?: "slow" | "balanced" | "packed";
  accommodationPreference?: BudgetLevel;
  nightlifePreference?: number;
  foodPreference?: number;
  transportationPreference?: string;
}

export interface DestinationMatch {
  destination: KnowledgeDestination;
  score: number;
  matchReasons: string[];
}

export interface RetrievedContext {
  destination: KnowledgeDestination | null;
  neighborhoods: KnowledgeNeighborhood[];
  attractions: KnowledgeAttraction[];
  dayTrips: KnowledgeDayTrip[];
  matchScore?: number;
  matchReasons?: string[];
}
