import { Suspense } from "react";
import { TripResults } from "@/components/trip/trip-results";

export const dynamic = "force-dynamic";

interface TripPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: TripPageProps) {
  const { id } = await params;
  return {
    title: "Your Trip Plan",
    description: `Personalized travel plan — ${id}`,
  };
}

export default async function TripPage({ params }: TripPageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <p className="text-sm text-muted">Loading your trip…</p>
        </div>
      }
    >
      <TripResults key={id} tripId={id} />
    </Suspense>
  );
}
