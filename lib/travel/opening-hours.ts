export type DaySlot = "morning" | "afternoon" | "evening";

const SLOT_HOURS: Record<DaySlot, [number, number]> = {
  morning: [9, 12],
  afternoon: [12, 17],
  evening: [17, 23],
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function getOpeningRange(
  openingHours: string[] | undefined,
  weekday = 1
): { open: number; close: number } | "unknown" | "closed" | "always" {
  if (!openingHours?.length) return "unknown";

  const joined = openingHours.join(" ").toLowerCase();
  if (/24\s*\/\s*7|24 hours|open 24/.test(joined)) return "always";

  const dayName = WEEKDAYS[((weekday % 7) + 7) % 7];
  const line =
    openingHours.find((entry) => entry.toLowerCase().startsWith(dayName)) ??
    openingHours.find((entry) => entry.toLowerCase().includes(dayName));

  if (line && /\bclosed\b/i.test(line)) return "closed";

  const range = parseClockRange(line) ?? parseOsmRange(joined, weekday);
  if (!range) return "unknown";
  if (range.close <= range.open && range.close === 0) return "closed";
  return range;
}

export function isOpenDuringSlot(
  openingHours: string[] | undefined,
  slot: DaySlot,
  weekday = 1
): boolean {
  const range = getOpeningRange(openingHours, weekday);
  if (range === "closed") return false;
  if (range === "unknown" || range === "always") return true;

  const [slotStart, slotEnd] = SLOT_HOURS[slot];
  return range.open < slotEnd && range.close > slotStart;
}

export function opensForBreakfast(openingHours: string[] | undefined, weekday = 1): boolean {
  const range = getOpeningRange(openingHours, weekday);
  if (range === "closed") return false;
  if (range === "unknown" || range === "always") return false;
  return range.open <= 10.5;
}

export function parseClockRange(line?: string): { open: number; close: number } | null {
  if (!line) return null;
  const match = line.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[–\-to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i
  );
  if (!match) return null;

  const open = toHours(Number(match[1]), Number(match[2] || 0), match[3]);
  const close = toHours(Number(match[4]), Number(match[5] || 0), match[6] || match[3]);
  if (open == null || close == null) return null;
  return { open, close: close <= open ? close + 24 : close };
}

function parseOsmRange(text: string, weekday: number): { open: number; close: number } | null {
  const osmDay = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][((weekday % 7) + 7) % 7];
  if (new RegExp(`${osmDay}\\s+off`, "i").test(text)) return { open: 0, close: 0 };
  const match = text.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return {
    open: Number(match[1]) + Number(match[2]) / 60,
    close: Number(match[3]) + Number(match[4]) / 60,
  };
}

function toHours(hour: number, minutes: number, meridian?: string): number | null {
  if (hour > 24) return null;
  let value = hour % 12;
  if (meridian?.toLowerCase() === "pm") value += 12;
  if (meridian?.toLowerCase() === "am" && hour === 12) value = 0;
  if (!meridian && hour === 24) value = 0;
  if (!meridian && hour > 12) value = hour;
  return value + minutes / 60;
}
