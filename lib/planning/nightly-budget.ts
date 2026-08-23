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
  if (nightly < 80) return 2;
  if (nightly < 150) return 3;
  if (nightly < 250) return 4;
  return undefined;
}
