import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = {
  title: "Stays & Flights",
  description: "Hotel and flight booking is coming soon on Blistrip.",
};

export default function StaysFlightsPage() {
  return (
    <ComingSoon
      eyebrow="Stays / Flights"
      title="Coming soon"
      description="Hotel and flight search is on the way. For now, plan your trip and we'll keep stays and flights in the itinerary notes."
    />
  );
}
