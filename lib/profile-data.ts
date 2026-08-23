import { buildUserPreferences } from "@/lib/planning/preferences";
import { getActiveTrip, getAllTripPlans, getSavedTrips } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import type { SavedTrip, TripPlan, TripPlannerInput, UserPreferences } from "@/types/trip";

export type SavedPlaceCategory = "food" | "hotels" | "activities";

export interface ProfileSavedPlace {
  id: string;
  name: string;
  category: SavedPlaceCategory;
  destination: string;
  photoUrl?: string;
  tripId: string;
}

export interface ProfileTripCard {
  id: string;
  destination: string;
  country: string;
  datesLabel: string;
  duration: number;
  budget: number;
  isUpcoming: boolean;
}

export interface ProfileStats {
  tripCount: number;
  countryCount: number;
  savedPlaceCount: number;
}

const COUNTRY_FLAGS: Record<string, string> = {
  "Czech Republic": "🇨🇿",
  Hungary: "🇭🇺",
  Poland: "🇵🇱",
  Austria: "🇦🇹",
  France: "🇫🇷",
  Spain: "🇪🇸",
  Portugal: "🇵🇹",
  Italy: "🇮🇹",
  Netherlands: "🇳🇱",
  Germany: "🇩🇪",
  "United Kingdom": "🇬🇧",
  Turkey: "🇹🇷",
  Japan: "🇯🇵",
  "United States": "🇺🇸",
};

const PLACE_FILTERS = ["All", "Food", "Hotels", "Activities"] as const;
export type SavedPlaceFilter = (typeof PLACE_FILTERS)[number];
export { PLACE_FILTERS };

export function countryFlag(country: string): string {
  return COUNTRY_FLAGS[country] ?? "📍";
}

export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BT";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function collectTripPlans(): TripPlan[] {
  if (typeof window === "undefined") return [];
  const saved = getSavedTrips();
  const active = getActiveTrip();
  const allPlans = Object.values(getAllTripPlans());
  const byId = new Map<string, TripPlan>();

  for (const plan of allPlans) byId.set(plan.id, plan);
  for (const savedTrip of saved) byId.set(savedTrip.id, savedTrip.tripPlan);
  if (active) byId.set(active.id, active);

  return [...byId.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

function parseTripStart(plan: TripPlan): Date | null {
  const start = plan.plannerInput?.startDate;
  if (!start) return null;
  const date = new Date(`${start}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTripDates(plan: TripPlan): string {
  const start = plan.plannerInput?.startDate;
  const end = plan.plannerInput?.endDate;
  if (start && end) {
    const startDate = new Date(`${start}T12:00:00`);
    const endDate = new Date(`${end}T12:00:00`);
    if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
      const sameMonth = startDate.getMonth() === endDate.getMonth();
      const startLabel = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const endLabel = endDate.toLocaleDateString("en-US", {
        month: sameMonth ? undefined : "short",
        day: "numeric",
      });
      return `${startLabel}–${endLabel}`;
    }
  }
  if (plan.dates && plan.dates !== "Flexible dates") return plan.dates;
  return "Dates flexible";
}

function isUpcomingTrip(plan: TripPlan): boolean {
  const start = parseTripStart(plan);
  if (!start) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return start >= today;
}

export function getProfileStats(): ProfileStats {
  const trips = collectTripPlans();
  const countries = new Set(trips.map((trip) => trip.country).filter(Boolean));
  const places = extractSavedPlaces(getSavedTrips());

  return {
    tripCount: trips.length,
    countryCount: countries.size,
    savedPlaceCount: places.length,
  };
}

export function getProfileTrips(): {
  upcoming: ProfileTripCard | null;
  recent: ProfileTripCard | null;
  pastCount: number;
} {
  const trips = collectTripPlans();
  const cards = trips.map((plan) => ({
    id: plan.id,
    destination: plan.destination,
    country: plan.country,
    datesLabel: formatTripDates(plan),
    duration: plan.duration,
    budget: plan.estimatedBudget,
    isUpcoming: isUpcomingTrip(plan),
  }));

  const upcoming = cards.find((trip) => trip.isUpcoming) ?? null;
  const pastCount = cards.filter((trip) => !trip.isUpcoming).length;

  return { upcoming, recent: upcoming ? null : cards[0] ?? null, pastCount };
}

export function extractSavedPlaces(savedTrips: SavedTrip[]): ProfileSavedPlace[] {
  const places: ProfileSavedPlace[] = [];
  const seen = new Set<string>();

  for (const savedTrip of savedTrips) {
    const plan = savedTrip.tripPlan;
    const destination = plan.destination;

    for (const restaurant of plan.restaurants) {
      const key = `food:${restaurant.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      places.push({
        id: key,
        name: restaurant.name,
        category: "food",
        destination,
        photoUrl: restaurant.photoUrl,
        tripId: plan.id,
      });
    }

    for (const hotel of plan.hotelRecommendations) {
      const key = `hotels:${hotel.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      places.push({
        id: key,
        name: hotel.name,
        category: "hotels",
        destination,
        photoUrl: hotel.photoUrl,
        tripId: plan.id,
      });
    }

    for (const activity of plan.activities) {
      const key = `activities:${activity.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      places.push({
        id: key,
        name: activity.name,
        category: "activities",
        destination,
        photoUrl: activity.photoUrl,
        tripId: plan.id,
      });
    }
  }

  return places;
}

export function filterSavedPlaces(
  places: ProfileSavedPlace[],
  filter: SavedPlaceFilter
): ProfileSavedPlace[] {
  if (filter === "All") return places;
  if (filter === "Food") return places.filter((place) => place.category === "food");
  if (filter === "Hotels") return places.filter((place) => place.category === "hotels");
  return places.filter((place) => place.category === "activities");
}

export function getPreferenceBars(prefs: UserPreferences): Array<{ label: string; score: number }> {
  const input: TripPlannerInput = {
    destination: "",
    destinationUnknown: false,
    flexibleDates: false,
    budget: prefs.budgetPreference,
    travelers: "Couple",
    interests: prefs.favoriteActivities,
    travelStyle: prefs.travelStyle,
    pace: prefs.preferredPace,
  };
  const scores = buildUserPreferences(input).scores;

  return [
    { label: "Food", score: scores.food },
    { label: "History", score: scores.history },
    { label: "Nature", score: scores.nature },
    { label: "Nightlife", score: scores.nightlife },
  ];
}

export function formatTripBudget(amount: number): string {
  return `${formatCurrency(amount)} budget`;
}
