import { popularDestinations } from "@/lib/images";
import type { TripPlannerInput } from "@/types/trip";

export function pickRandomPlannerDestination(
  excludeDestination?: string
): Pick<
  TripPlannerInput,
  | "destination"
  | "destinationCountry"
  | "destinationLabel"
  | "destinationLatitude"
  | "destinationLongitude"
  | "destinationUnknown"
  | "destinationDescription"
> {
  const exclude = excludeDestination?.trim().toLowerCase();
  const pool = exclude
    ? popularDestinations.filter((dest) => dest.name.toLowerCase() !== exclude)
    : popularDestinations;
  const pick = pool[Math.floor(Math.random() * pool.length)] ?? popularDestinations[0];

  return {
    destination: pick.name,
    destinationCountry: pick.country,
    destinationLabel: `${pick.name}, ${pick.country}`,
    destinationLatitude: pick.latitude,
    destinationLongitude: pick.longitude,
    destinationUnknown: false,
    destinationDescription: "",
  };
}
