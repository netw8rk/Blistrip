import type { DailyItinerary, ItineraryActivity } from "@/types/trip";

const WALK_NAMES = /^(morning walk|evening stroll|explore the (area|streets))/i;

function realStops(stops: ItineraryActivity[]): ItineraryActivity[] {
  return stops.filter((stop) => {
    if (stop.type === "experience") return false;
    return !WALK_NAMES.test(stop.name);
  });
}

function isSoftStart(stop: ItineraryActivity): boolean {
  const type = stop.type ?? "";
  return type === "cafe" || type === "market" || type === "park" || type === "shop";
}

function isMeal(stop: ItineraryActivity): boolean {
  const type = stop.type ?? "";
  return type === "restaurant" || type === "bar" || type === "nightclub" || type === "cafe";
}

function nameOf(stop?: ItineraryActivity): string | undefined {
  return stop?.name?.trim() || undefined;
}

/** A short, spoken-feeling rundown of the day using the actual stops. */
export function writeDayGuideNote(
  day: DailyItinerary,
  destination: string,
  totalDays: number
): string {
  const city = destination.trim() || "town";
  const morning = realStops(day.morning);
  const afternoon = realStops(day.afternoon);
  const evening = realStops(day.evening);
  const first = day.day === 1;
  const last = day.day === totalDays && totalDays > 1;
  const shape = day.day % 3;

  const start = morning.find(isSoftStart) ?? morning[0];
  const sight = morning.find((stop) => stop !== start) ?? afternoon[0];
  const later = afternoon.find((stop) => stop !== sight) ?? afternoon[1] ?? afternoon[0];
  const night = evening.find(isMeal) ?? evening[0];

  const a = nameOf(start);
  const b = nameOf(sight);
  const c = nameOf(later);
  const d = nameOf(night);

  if (first) {
    if (shape === 1 && a && b && d) {
      return `You'll just be getting in, so I'm not stacking this one. Shake off the trip at ${a}, then wander over to ${b} when you're ready. Tonight, ${d} — early enough that you can actually sleep.`;
    }
    if (a && b && d) {
      return `${city} can wait a beat after you land. Start easy at ${a}, then I'd take you to ${b} so you feel the place without racing it. If you still have legs, ${d} is a good first night.`;
    }
    if (a && d) {
      return `Arrival day. Keep it gentle: ${a} first, then let the city come to you. ${d} later if you want a proper welcome.`;
    }
    if (a) return `Ease into ${city}. I'd start at ${a} and see how you feel before we add anything else.`;
    return `First day in ${city}. Land, drop your bags, and give yourself a slow first look around.`;
  }

  if (last) {
    if (a && b && d) {
      return `Last morning in ${city}. I'd do ${a} while it's still quiet, then one more look at ${b}. If your timing allows, ${d} before you go.`;
    }
    if (a && b) {
      return `You're leaving, so keep it loose. ${a} in the morning, ${b} after that, and don't invent extra errands.`;
    }
    if (a) return `Wrap ${city} the way you started it — ${a}, then head out when you need to.`;
    return `Last day in ${city}. Keep it light and leave a little room to linger.`;
  }

  if (shape === 1 && a && b && c && d) {
    return `This is a real ${city} day. ${a} first, then ${b} and ${c} while you're already out. ${d} when the light goes.`;
  }
  if (shape === 2 && a && b && d) {
    return `I'd spend the morning at ${a} before it fills up, then move on to ${b}. Evening is ${d} — that's the rhythm I'd want if I were with you.`;
  }
  if (a && c && d) {
    return `Start at ${a}, give the afternoon to ${c}, and let ${d} close it out. Close enough to walk, full enough that you'll feel you were actually here.`;
  }
  if (a && b && d) {
    return `${a} in the morning, ${b} after, ${d} at night. That's the day — no bouncing across town.`;
  }
  if (a && d) return `Make ${a} the morning anchor, then wander until ${d}.`;
  if (a) return `Build the day around ${a} and stay nearby. That's how ${city} feels best.`;
  return `A full day in ${city}. Stay in one pocket of the city and let the hours fill themselves.`;
}
