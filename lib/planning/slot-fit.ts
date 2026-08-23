import type { PlaceType } from "@/lib/travel/types";
import { isOpenDuringSlot, opensForBreakfast, type DaySlot } from "@/lib/travel/opening-hours";
import type { UserTripPreferences } from "./preferences";

export interface SlotBudget {
  min: number;
  max: number;
}

export interface DaySlotBudgets {
  morning: SlotBudget;
  afternoon: SlotBudget;
  evening: SlotBudget;
}

const SLOT_TYPES: Record<DaySlot, PlaceType[]> = {
  morning: ["cafe", "park", "market", "museum", "landmark", "church", "attraction", "activity"],
  afternoon: ["museum", "landmark", "park", "attraction", "shop", "activity", "church", "cafe", "market", "restaurant"],
  evening: ["restaurant", "bar", "nightclub", "cafe"],
};

const FORBIDDEN_TYPES: Record<DaySlot, PlaceType[]> = {
  morning: ["bar", "nightclub", "hotel", "hostel", "apartment"],
  afternoon: ["nightclub", "hotel", "hostel", "apartment"],
  evening: ["museum", "shop", "church", "market", "hotel", "hostel", "apartment"],
};

export function slotBudgets(prefs: UserTripPreferences): DaySlotBudgets {
  const pace = prefs.pace;
  const s = prefs.scores;

  const morning: SlotBudget =
    pace === "slow" ? { min: 1, max: 2 } : pace === "packed" ? { min: 2, max: 3 } : { min: 1, max: 2 };
  const afternoon: SlotBudget =
    pace === "slow" ? { min: 1, max: 2 } : pace === "packed" ? { min: 2, max: 3 } : { min: 2, max: 3 };
  const evening: SlotBudget =
    pace === "slow" ? { min: 1, max: 1 } : pace === "packed" ? { min: 1, max: 3 } : { min: 1, max: 2 };

  if (s.relaxation >= 8 && pace !== "packed") {
    morning.max = Math.min(morning.max, 2);
    afternoon.max = Math.min(afternoon.max, 2);
    evening.max = 1;
  }

  if (s.food >= 6) {
    evening.min = 1;
    evening.max = Math.max(evening.max, pace === "packed" ? 2 : 2);
  }

  if (s.nightlife >= 6 && prefs.travelers !== "Family" && !prefs.dislikes.includes("nightlife")) {
    evening.max = pace === "slow" ? 2 : pace === "packed" ? 3 : 2;
  }

  if (prefs.travelers === "Family") {
    evening.max = Math.min(evening.max, 2);
  }

  return { morning, afternoon, evening };
}

export function placeTypeFitsSlot(
  type: PlaceType | string | undefined,
  slot: DaySlot,
  prefs: UserTripPreferences,
  options?: { openInSlot?: boolean; breakfastHours?: boolean }
): boolean {
  const placeType = (type as PlaceType) || "other";
  if (FORBIDDEN_TYPES[slot].includes(placeType)) return false;
  if (placeType === "experience") return true;

  if (slot === "morning" && placeType === "restaurant") {
    return options?.breakfastHours === true;
  }

  if (slot === "evening" && (placeType === "bar" || placeType === "nightclub")) {
    if (prefs.travelers === "Family") return false;
    if (prefs.dislikes.includes("nightlife")) return false;
    if (prefs.scores.nightlife < 6 && prefs.scores.localExperiences < 7) return false;
  }

  if (SLOT_TYPES[slot].includes(placeType)) return true;

  if (
    slot === "evening" &&
    ["park", "landmark", "attraction"].includes(placeType) &&
    options?.openInSlot &&
    prefs.scores.food < 6 &&
    prefs.scores.nightlife < 6
  ) {
    return true;
  }

  return false;
}

export function placeFitsSlot(
  place: {
    type: PlaceType | string;
    openingHours?: string[];
  },
  slot: DaySlot,
  weekday: number,
  prefs: UserTripPreferences
): boolean {
  const openInSlot = isOpenDuringSlot(place.openingHours, slot, weekday);
  if (!openInSlot) return false;

  const breakfastHours = place.type === "restaurant" ? opensForBreakfast(place.openingHours, weekday) : false;

  return placeTypeFitsSlot(place.type, slot, prefs, { openInSlot, breakfastHours });
}

/** Bars and clubs are the same evening activity family; other types stand alone. */
export function activityFamily(type: string | undefined): string {
  if (type === "bar" || type === "nightclub") return "nightlife";
  return type || "other";
}

/**
 * How many of the same family are allowed in one morning/afternoon/evening.
 * Default is 1 so a slot cannot become three cafes or three bars.
 * Packed nightlife trips may have dinner + a bar, or a bar + a club, not three of one kind.
 */
export function maxFamilyPerSlot(
  family: string,
  slot: DaySlot,
  prefs: UserTripPreferences
): number {
  if (family === "nightlife" && slot === "evening" && prefs.scores.nightlife >= 8 && prefs.pace === "packed") {
    return 2;
  }
  return 1;
}

/** Same exact type across the whole day. Lunch + dinner restaurants are the exception. */
export function maxTypePerDay(type: string | undefined): number {
  if (type === "restaurant") return 2;
  return 1;
}

export function canAddTypeToSlot(
  type: string | undefined,
  slot: DaySlot,
  prefs: UserTripPreferences,
  slotTypes: Array<string | undefined>,
  dayTypes: Array<string | undefined> = [],
  options?: { relaxForMinimum?: boolean }
): boolean {
  if (!type || type === "experience") return true;
  if (options?.relaxForMinimum) return true;

  const family = activityFamily(type);
  const sameTypeInSlot = slotTypes.filter((item) => item === type).length;
  if (sameTypeInSlot >= 1) return false;

  const familyInSlot = slotTypes.filter((item) => activityFamily(item) === family).length;
  if (familyInSlot >= maxFamilyPerSlot(family, slot, prefs)) return false;

  const sameTypeInDay = dayTypes.filter((item) => item === type).length;
  if (sameTypeInDay >= maxTypePerDay(type)) return false;

  return true;
}

export function slotPreferenceBoost(
  type: PlaceType | string,
  slot: DaySlot,
  prefs: UserTripPreferences
): number {
  const s = prefs.scores;
  if (slot === "morning") {
    if (type === "cafe") return s.food + s.relaxation;
    if (type === "park") return s.nature + s.relaxation;
    if (type === "museum" || type === "landmark") return Math.max(s.culture, s.history, s.architecture);
    if (type === "market") return Math.max(s.food, s.localExperiences);
  }
  if (slot === "afternoon") {
    if (type === "restaurant") return s.food;
    if (type === "park") return s.nature + s.relaxation;
    if (type === "museum" || type === "landmark" || type === "attraction") {
      return Math.max(s.culture, s.history, s.architecture, s.adventure);
    }
    if (type === "shop") return s.shopping;
    if (type === "activity") return s.adventure;
  }
  if (slot === "evening") {
    if (type === "restaurant") return s.food * 2;
    if (type === "bar" || type === "nightclub") return s.nightlife * 2;
    if (type === "cafe") return s.food + s.relaxation;
  }
  return 0;
}
