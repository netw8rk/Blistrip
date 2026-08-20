import {
  getDestination,
  getNeighborhoods,
  getAttractions,
  getDayTrips,
} from "@/lib/knowledge";
import type {
  KnowledgeNeighborhood,
  KnowledgeAttraction,
  KnowledgeDayTrip,
} from "@/lib/knowledge";
import Link from "next/link";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dest = await getDestination(id);
  return { title: dest ? `${dest.city} — Knowledge Base` : "Not Found" };
}

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const destination = await getDestination(id);
  if (!destination) notFound();

  const [neighborhoods, attractions, dayTrips] = await Promise.all([
    getNeighborhoods(destination.id),
    getAttractions(destination.id),
    getDayTrips(destination.id),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/admin/knowledge"
          className="text-sm text-primary hover:text-primary-hover transition-colors"
        >
          ← All Destinations
        </Link>

        <div className="mt-6 mb-8">
          <h1 className="text-2xl font-semibold">
            {destination.city}, {destination.country}
          </h1>
          <p className="text-sm text-foreground-secondary mt-1">
            {destination.description}
          </p>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(destination.scores).map(([key, value]) => (
              <div key={key} className="rounded border border-border bg-surface p-2 text-center">
                <p className="text-lg font-semibold">{value}/10</p>
                <p className="text-[10px] text-foreground-secondary capitalize">{key}</p>
              </div>
            ))}
          </div>
        </div>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">
            Neighborhoods ({neighborhoods.length})
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {neighborhoods.map((n) => (
              <NeighborhoodCard key={n.id} neighborhood={n} />
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">
            Attractions ({attractions.length})
          </h2>
          <div className="space-y-2">
            {attractions.map((a) => (
              <AttractionRow key={a.id} attraction={a} />
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">
            Day Trips ({dayTrips.length})
          </h2>
          <div className="space-y-2">
            {dayTrips.map((dt) => (
              <DayTripRow key={dt.id} dayTrip={dt} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function NeighborhoodCard({ neighborhood }: { neighborhood: KnowledgeNeighborhood }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="font-medium">{neighborhood.name}</h3>
      <p className="text-xs text-foreground-secondary mt-1">{neighborhood.description}</p>
      <p className="text-[10px] text-muted mt-2">Vibe: {neighborhood.vibe}</p>
      <div className="mt-2 flex gap-2 text-[10px]">
        <span>🎉 {neighborhood.scores.nightlife}</span>
        <span>🍽️ {neighborhood.scores.food}</span>
        <span>🏛️ {neighborhood.scores.architecture}</span>
        <span>🛡️ {neighborhood.scores.safety}</span>
      </div>
    </div>
  );
}

function AttractionRow({ attraction }: { attraction: KnowledgeAttraction }) {
  return (
    <div className="rounded border border-border bg-surface p-3 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium truncate">{attraction.name}</h4>
          <span className="shrink-0 rounded-full bg-primary-muted px-1.5 py-0.5 text-[9px] text-primary">
            {attraction.category}
          </span>
        </div>
        <p className="text-xs text-foreground-secondary mt-0.5 line-clamp-1">
          {attraction.description}
        </p>
      </div>
      <div className="text-right text-[10px] text-muted shrink-0">
        <p>⏱ {attraction.approximateDuration}</p>
        <p>💰 {attraction.priceLevel}</p>
        <p>⭐ {attraction.importance}/10</p>
      </div>
    </div>
  );
}

function DayTripRow({ dayTrip }: { dayTrip: KnowledgeDayTrip }) {
  return (
    <div className="rounded border border-border bg-surface p-3">
      <h4 className="text-sm font-medium">{dayTrip.name}</h4>
      <p className="text-xs text-foreground-secondary mt-0.5">{dayTrip.description}</p>
      <div className="mt-1 flex gap-3 text-[10px] text-muted">
        <span>Duration: {dayTrip.duration}</span>
        <span>Travel: {dayTrip.travelTime}</span>
        <span>Cost: {dayTrip.costLevel}</span>
      </div>
    </div>
  );
}
