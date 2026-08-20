export interface TripPlannerInput {
  destination: string;
  destinationUnknown: boolean;
  destinationDescription?: string;
  startDate?: string;
  endDate?: string;
  flexibleDates: boolean;
  budget: string;
  customBudget?: number;
  travelers: string;
  interests: string[];
  travelStyle: string;
  pace: string;
  additionalNotes?: string;
}

export interface HotelRecommendation {
  name: string;
  description: string;
  priceRange: string;
  whyRecommended: string;
  rating: number;
  bookingUrl: string;
  neighborhood?: string;
}

export interface ActivityRecommendation {
  name: string;
  description: string;
  price: string;
  duration: string;
  whyRecommended: string;
  bookingUrl: string;
  category?: string;
}

export interface RestaurantRecommendation {
  name: string;
  cuisine: string;
  priceRange: string;
  whyRecommended: string;
  location: string;
  category: "cheap" | "mid-range" | "special-occasion";
  bookingUrl: string;
}

export interface NeighborhoodRecommendation {
  name: string;
  bestFor: string;
  why: string;
}

export interface ItineraryActivity {
  name: string;
  description: string;
  whyRecommended: string;
  /** Linked Blistrip knowledge base ID when sourced from curated data */
  knowledgeId?: string;
  type?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  durationMinutes?: number;
  estimatedCostLevel?: string;
  travelTimeFromPrevious?: number;
  reservationRecommended?: boolean;
  /** blistrip = curated knowledge; ai_estimate = AI assumption */
  source?: "blistrip" | "ai_estimate";
}

export interface DailyItinerary {
  day: number;
  title: string;
  morning: ItineraryActivity[];
  afternoon: ItineraryActivity[];
  evening: ItineraryActivity[];
}

export interface BudgetBreakdown {
  accommodation: number;
  food: number;
  activities: number;
  transportation: number;
  other: number;
}

export interface TravelProduct {
  name: string;
  description: string;
  price: string;
  category: string;
  bookingUrl: string;
}

export interface TripPlan {
  id: string;
  tripSummary: string;
  destination: string;
  country: string;
  dates: string;
  duration: number;
  estimatedBudget: number;
  travelStyle: string;
  interests: string[];
  recommendedNeighborhood: string;
  neighborhoodReason: string;
  neighborhoods: NeighborhoodRecommendation[];
  hotelRecommendations: HotelRecommendation[];
  activities: ActivityRecommendation[];
  restaurants: RestaurantRecommendation[];
  transportation: string[];
  dailyItinerary: DailyItinerary[];
  budgetBreakdown: BudgetBreakdown;
  travelTips: string[];
  packingRecommendations: string[];
  travelEssentials: TravelProduct[];
  createdAt: string;
  plannerInput?: TripPlannerInput;
}

export interface Destination {
  id: string;
  name: string;
  country: string;
  description: string;
  bestFor: string[];
  typicalBudget: string;
  imageUrl: string;
}

export interface SavedTrip {
  id: string;
  destination: string;
  duration: number;
  estimatedBudget: number;
  interests: string[];
  savedAt: string;
  tripPlan: TripPlan;
}

export interface UserPreferences {
  travelStyle: string;
  budgetPreference: string;
  favoriteActivities: string[];
  preferredPace: string;
}

export const TRAVELER_OPTIONS = ["Solo", "Couple", "Friends", "Family"] as const;
export const BUDGET_OPTIONS = ["<$500", "$500–$1,000", "$1,000–$2,000", "$2,000–$4,000", "$4,000+"] as const;
export const INTEREST_OPTIONS = [
  "Nightlife",
  "History",
  "Food",
  "Culture",
  "Nature",
  "Beaches",
  "Adventure",
  "Relaxation",
  "Shopping",
  "Sports",
  "Architecture",
  "Local experiences",
] as const;
export const TRAVEL_STYLE_OPTIONS = ["Budget", "Comfortable", "Luxury", "Backpacker", "Mix of everything"] as const;
export const PACE_OPTIONS = ["Slow and relaxed", "Balanced", "Pack everything in"] as const;
