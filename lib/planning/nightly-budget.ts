import type { BudgetLevel } from "@/lib/knowledge/types";

export const NIGHTLY_BUDGET_OPTIONS = [
  "Under $80/night",
  "$80–$150/night",
  "$150–$250/night",
  "$250–$400/night",
  "$400+/night",
] as const;

const NIGHTLY_MIDPOINT: Record<string, number> = {
  "Under $80/night": 65,
  "$80–$150/night": 115,
  "$150–$250/night": 200,
  "$250–$400/night": 325,
  "$400+/night": 500,
  // Older total-trip labels still stored on saved trips
  "<$500": 65,
  "$500–$1,000": 115,
  "$1,000–$2,000": 200,
  "$2,000–$4,000": 325,
  "$4,000+": 500,
};

export function parseNightlyBudget(budget: string, customBudget?: number): number {
  if ((budget === "custom" || budget === "Custom budget") && customBudget && customBudget > 0) {
    return Math.round(customBudget);
  }
  if (customBudget && customBudget > 0 && !NIGHTLY_MIDPOINT[budget]) {
    return Math.round(customBudget);
  }
  return NIGHTLY_MIDPOINT[budget] ?? 200;
}

export function nightlyStayLabel(budget: string, customBudget?: number): string {
  if ((budget === "custom" || budget === "Custom budget") && customBudget && customBudget > 0) {
    return `$${Math.round(customBudget)}/night`;
  }
  if (NIGHTLY_MIDPOINT[budget] && budget.includes("/night")) return budget;
  return `$${parseNightlyBudget(budget, customBudget)}/night`;
}

export function nightlyToBudgetLevel(nightly: number): BudgetLevel {
  if (nightly < 80) return "budget";
  if (nightly < 150) return "moderate";
  if (nightly < 250) return "premium";
  return "luxury";
}

export function nightlyToPrefLevel(nightly: number): "low" | "moderate" | "high" {
  if (nightly < 100) return "low";
  if (nightly < 250) return "moderate";
  return "high";
}

export function stayRooms(travelers?: string): number {
  const lower = (travelers ?? "").toLowerCase();
  if (lower.includes("family") || lower.includes("friends")) return 2;
  return 1;
}

/** Hotel nights for a trip length counted in days (inclusive). */
export function stayNights(days: number): number {
  return Math.max(1, days - 1);
}

export function accommodationFromNightly(
  nightly: number,
  days: number,
  travelers?: string
): { nightly: number; nights: number; rooms: number; amount: number } {
  const nights = stayNights(days);
  const rooms = stayRooms(travelers);
  return {
    nightly: Math.round(nightly),
    nights,
    rooms,
    amount: Math.round(nightly) * nights * rooms,
  };
}

export function googleHotelMaxPriceLevel(nightly: number): number | undefined {
  return googleHotelPriceRange(nightly).max;
}

export function googleHotelPriceRange(nightly: number): { min?: number; max?: number } {
  if (nightly < 80) return { max: 2 };
  if (nightly < 150) return { min: 1, max: 3 };
  if (nightly < 250) return { min: 2, max: 4 };
  if (nightly < 400) return { min: 3 };
  return { min: 4 };
}

export function hotelSearchPhrase(nightly: number): string {
  if (nightly < 80) return "budget hotels hostels motels guesthouses";
  if (nightly < 150) return "3 star midrange hotels";
  if (nightly < 250) return "4 star boutique hotels";
  if (nightly < 400) return "upscale hotels luxury hotels";
  return "5 star luxury hotels";
}

const GOOGLE_PRICE_LEVELS = [
  "PRICE_LEVEL_FREE",
  "PRICE_LEVEL_INEXPENSIVE",
  "PRICE_LEVEL_MODERATE",
  "PRICE_LEVEL_EXPENSIVE",
  "PRICE_LEVEL_VERY_EXPENSIVE",
] as const;

export function googlePriceLevelEnums(range: { min?: number; max?: number }): string[] {
  const min = Math.max(0, range.min ?? 0);
  const max = Math.min(4, range.max ?? 4);
  return GOOGLE_PRICE_LEVELS.slice(min, max + 1);
}

const BUDGET_HOTEL_RE =
  /\b(hostel|motel|guesthouse|guest house|backpacker|capsule|super 8|motel 6|red roof|days inn|travelodge|la quinta|quality inn|comfort inn|econo lodge|econolodge|microtel|rodeway|ibis budget|premier inn)\b/i;
const MID_HOTEL_RE =
  /\b(hilton garden|holiday inn|residence inn|homewood|fairfield|springhill|hyatt place|hyatt house|hampton inn|hampton by hilton|drury|embassy suites|doubletree|aloft|element|moxy|canopy|courtyard|home2|tru by hilton|towneplace)\b/i;
const LUXURY_HOTEL_RE =
  /\b(ritz|four seasons|st\.?\s*regis|mandarin oriental|park hyatt|edition|rosewood|waldorf|peninsula|belmond|fairmont|conrad|soho house|1 hotel|\bw hotels?\b|bulgari|dorchester|raffles|shangri)\b/i;
const UPSCALE_HOTEL_RE =
  /\b(westin|sheraton|renaissance|intercontinental|kimpton|ace hotel|graduate|andaz|thompson|jw marriott|autograph|tribute|luxury collection)\b/i;

export function inferHotelPriceLevel(
  name: string,
  type?: string,
  priceLevel?: number
): number | undefined {
  if (priceLevel != null) return priceLevel;
  if (type === "hostel") return 1;
  if (BUDGET_HOTEL_RE.test(name)) return 1;
  if (LUXURY_HOTEL_RE.test(name)) return 4;
  if (MID_HOTEL_RE.test(name)) return 2;
  if (UPSCALE_HOTEL_RE.test(name)) return 3;
  return undefined;
}

export function hotelFitsNightlyBudget(
  nightly: number,
  name: string,
  type?: string,
  priceLevel?: number
): boolean {
  const estimated = inferHotelPriceLevel(name, type, priceLevel);
  if (estimated == null) return true;
  const { min, max } = googleHotelPriceRange(nightly);
  if (max != null && estimated > max) return false;
  if (min != null && estimated < min - 1) return false;
  return true;
}
