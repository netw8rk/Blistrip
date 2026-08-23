import type { TravelStyle, AttractionType, BudgetLevel } from "./types";

export const TRAVEL_STYLES: { id: TravelStyle; label: string; description: string }[] = [
  { id: "budget", label: "Budget", description: "Maximizing experiences while minimizing cost" },
  { id: "luxury", label: "Luxury", description: "Premium experiences and comfort" },
  { id: "backpacker", label: "Backpacker", description: "Adventurous, hostel-hopping, social" },
  { id: "nightlife", label: "Nightlife", description: "Bars, clubs, late-night culture" },
  { id: "food", label: "Food & Drink", description: "Culinary exploration and local flavors" },
  { id: "history", label: "History", description: "Historical sites and stories" },
  { id: "architecture", label: "Architecture", description: "Buildings, design, urban landscapes" },
  { id: "culture", label: "Culture", description: "Museums, art, local traditions" },
  { id: "nature", label: "Nature", description: "Parks, gardens, natural scenery" },
  { id: "adventure", label: "Adventure", description: "Active, outdoor, thrill-seeking" },
  { id: "romantic", label: "Romantic", description: "Couples, intimate experiences" },
  { id: "solo", label: "Solo", description: "Independent exploration, easy to navigate alone" },
  { id: "family", label: "Family", description: "Kid-friendly, safe, varied activities" },
  { id: "relaxation", label: "Relaxation", description: "Slow pace, spas, unwinding" },
  { id: "photography", label: "Photography", description: "Photogenic spots, visual beauty" },
];

export const ATTRACTION_TYPES: { id: AttractionType; label: string }[] = [
  { id: "landmark", label: "Landmark" },
  { id: "museum", label: "Museum" },
  { id: "historical", label: "Historical Site" },
  { id: "architecture", label: "Architecture" },
  { id: "viewpoint", label: "Viewpoint" },
  { id: "market", label: "Market" },
  { id: "neighborhood", label: "Neighborhood" },
  { id: "park", label: "Park & Garden" },
  { id: "nightlife", label: "Nightlife" },
  { id: "food", label: "Food & Drink" },
  { id: "shopping", label: "Shopping" },
  { id: "religious", label: "Religious Site" },
  { id: "cultural", label: "Cultural Venue" },
  { id: "outdoor", label: "Outdoor Activity" },
  { id: "day-trip", label: "Day Trip" },
];

export function mapInterestToTravelStyle(interest: string): TravelStyle | null {
  const mapping: Record<string, TravelStyle> = {
    nightlife: "nightlife",
    history: "history",
    food: "food",
    culture: "culture",
    nature: "nature",
    beaches: "relaxation",
    adventure: "adventure",
    relaxation: "relaxation",
    shopping: "culture",
    sports: "adventure",
    architecture: "architecture",
    "local experiences": "culture",
  };
  return mapping[interest.toLowerCase()] ?? null;
}

export function mapBudgetToLevel(budget: string, nightly?: number): BudgetLevel {
  const amount = nightly ?? parseNightlyFromLabel(budget);
  if (amount < 80 || budget.includes("Under $80") || budget.includes("<$500")) return "budget";
  if (amount < 150 || budget.includes("$80–$150")) return "moderate";
  if (amount < 250 || budget.includes("$150–$250") || budget.includes("$1,000–$2,000")) return "premium";
  if (amount >= 250 || budget.includes("$400") || budget.includes("Luxury")) return "luxury";
  return "moderate";
}

function parseNightlyFromLabel(budget: string): number {
  if (budget.includes("Under $80") || budget.includes("<$500")) return 65;
  if (budget.includes("$80–$150") || budget.includes("$500–$1,000")) return 115;
  if (budget.includes("$150–$250") || budget.includes("$1,000–$2,000")) return 200;
  if (budget.includes("$250–$400") || budget.includes("$2,000–$4,000")) return 325;
  if (budget.includes("$400") || budget.includes("$4,000")) return 500;
  return 200;
}

