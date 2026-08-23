import type { TripPlan, TripPlannerInput } from "@/types/trip";
import { haversineKm } from "./geo";

const COUNTRY_ALIASES: Record<string, string> = {
  us: "united states",
  usa: "united states",
  "united states of america": "united states",
  uk: "united kingdom",
  "great britain": "united kingdom",
  "czech republic": "czechia",
  czechia: "czechia",
};

export interface ConfirmedDestination {
  city: string;
  country: string;
  state?: string;
  label: string;
  latitude?: number;
  longitude?: number;
  confirmed: boolean;
}

export function parseRegionFromLabel(label?: string): { city?: string; state?: string; country?: string } {
  if (!label?.trim()) return {};
  const parts = label.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return {
      city: parts[0],
      state: parts.slice(1, -1).join(", "),
      country: parts[parts.length - 1],
    };
  }
  if (parts.length === 2) {
    return { city: parts[0], country: parts[1] };
  }
  return { city: parts[0] };
}

export function normalizeCountry(value: string): string {
  const key = value.trim().toLowerCase();
  return COUNTRY_ALIASES[key] ?? key;
}

export function countriesMatch(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return normalizeCountry(a) === normalizeCountry(b);
}

export function getConfirmedDestination(input: TripPlannerInput): ConfirmedDestination | null {
  if (input.destinationUnknown) return null;
  const city = input.destination?.trim();
  if (!city) return null;

  const parsed = parseRegionFromLabel(input.destinationLabel);
  const country = input.destinationCountry?.trim() || parsed.country || "";
  const state = input.destinationState?.trim() || parsed.state;
  const label = input.destinationLabel?.trim() || [city, state, country].filter(Boolean).join(", ");
  return {
    city,
    country,
    state,
    label,
    latitude: input.destinationLatitude,
    longitude: input.destinationLongitude,
    confirmed: input.destinationLatitude != null && input.destinationLongitude != null,
  };
}

export function knowledgeMatchesConfirmed(
  confirmed: ConfirmedDestination,
  knowledge: { city: string; country: string; latitude: number; longitude: number }
): boolean {
  if (confirmed.city.toLowerCase() !== knowledge.city.toLowerCase()) return false;
  if (confirmed.latitude != null && confirmed.longitude != null) {
    return haversineKm(confirmed.latitude, confirmed.longitude, knowledge.latitude, knowledge.longitude) < 50;
  }
  return !confirmed.country || countriesMatch(confirmed.country, knowledge.country);
}

export function applyConfirmedDestination<T extends Partial<TripPlan>>(
  plan: T,
  confirmed: ConfirmedDestination
): T {
  return {
    ...plan,
    destination: confirmed.city,
    country: confirmed.country || plan.country || "",
    destinationLabel: confirmed.label,
    destinationLatitude: confirmed.latitude,
    destinationLongitude: confirmed.longitude,
  };
}

export function mapsUrlForDestination(confirmed: Pick<ConfirmedDestination, "latitude" | "longitude" | "label">): string | undefined {
  if (confirmed.latitude == null || confirmed.longitude == null) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${confirmed.latitude},${confirmed.longitude}`)}`;
}
