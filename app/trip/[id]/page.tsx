import { TripResults } from "@/components/trip/trip-results";

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
  return <TripResults tripId={id} />;
}
