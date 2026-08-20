import {
  getAllDestinations,
  getNeighborhoods,
  getAttractions,
  getDayTrips,
} from "@/lib/knowledge";
import type { KnowledgeDestination } from "@/lib/knowledge";
import Link from "next/link";

export const metadata = {
  title: "Knowledge Base — Blistrip Dev",
};

async function getStats() {
  const destinations = await getAllDestinations();
  const stats = await Promise.all(
    destinations.map(async (d) => {
      const neighborhoods = await getNeighborhoods(d.id);
      const attractions = await getAttractions(d.id);
      const dayTrips = await getDayTrips(d.id);
      return {
        destination: d,
        neighborhoodCount: neighborhoods.length,
        attractionCount: attractions.length,
        dayTripCount: dayTrips.length,
      };
    })
  );
  return stats;
}

export default async function AdminKnowledgePage() {
  const stats = await getStats();
  const totalAttractions = stats.reduce((s, d) => s + d.attractionCount, 0);
  const totalNeighborhoods = stats.reduce((s, d) => s + d.neighborhoodCount, 0);
  const totalDayTrips = stats.reduce((s, d) => s + d.dayTripCount, 0);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Knowledge Base</h1>
            <p className="text-sm text-foreground-secondary mt-1">
              Development data inspector
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-primary hover:text-primary-hover transition-colors"
          >
            ← Back to Blistrip
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Destinations" value={stats.length} />
          <StatCard label="Neighborhoods" value={totalNeighborhoods} />
          <StatCard label="Attractions" value={totalAttractions} />
          <StatCard label="Day Trips" value={totalDayTrips} />
        </div>

        <div className="space-y-4">
          {stats.map(({ destination, neighborhoodCount, attractionCount, dayTripCount }) => (
            <DestinationRow
              key={destination.id}
              destination={destination}
              neighborhoods={neighborhoodCount}
              attractions={attractionCount}
              dayTrips={dayTripCount}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-foreground-secondary mt-1">{label}</p>
    </div>
  );
}

function DestinationRow({
  destination,
  neighborhoods,
  attractions,
  dayTrips,
}: {
  destination: KnowledgeDestination;
  neighborhoods: number;
  attractions: number;
  dayTrips: number;
}) {
  return (
    <Link
      href={`/admin/knowledge/${destination.id}`}
      className="block rounded-lg border border-border bg-surface p-4 hover:border-border-accent transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">
            {destination.city}, {destination.country}
          </h3>
          <p className="text-xs text-foreground-secondary mt-0.5">
            {destination.shortDescription}
          </p>
        </div>
        <div className="flex gap-4 text-xs text-foreground-secondary">
          <span>{neighborhoods} neighborhoods</span>
          <span>{attractions} attractions</span>
          <span>{dayTrips} day trips</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {destination.travelStyles.slice(0, 6).map((style) => (
          <span
            key={style}
            className="inline-block rounded-full bg-primary-muted px-2 py-0.5 text-[10px] text-primary"
          >
            {style}
          </span>
        ))}
      </div>
    </Link>
  );
}
