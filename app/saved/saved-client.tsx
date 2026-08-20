"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Trash2, ArrowRight, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSavedTrips, deleteSavedTrip } from "@/lib/storage";
import { track } from "@/lib/analytics";
import type { SavedTrip } from "@/types/trip";
import { formatCurrency } from "@/lib/utils";

export default function SavedTripsClient() {
  const [trips, setTrips] = useState<SavedTrip[]>([]);

  useEffect(() => {
    setTrips(getSavedTrips());
  }, []);

  const handleDelete = (id: string) => {
    deleteSavedTrip(id);
    setTrips(getSavedTrips());
    track("delete_trip", { id });
  };

  if (trips.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <Bookmark className="h-12 w-12 text-primary mb-4" />
        <h1 className="text-2xl font-bold mb-2">No saved trips yet</h1>
        <p className="text-foreground-secondary mb-6 max-w-sm">
          Plan a trip and save it to access it anytime from here.
        </p>
        <Link href="/planner">
          <Button>Plan My Trip</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <p className="eyebrow mb-2">Your Collection</p>
      <h1 className="text-3xl font-bold mb-8">Saved Trips</h1>
      <div className="space-y-4">
        {trips.map((trip) => (
          <Card key={trip.id} className="p-5 hover:border-border-accent transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-foreground-secondary" />
                  <h3 className="font-semibold text-lg text-destination">{trip.destination}</h3>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="accent">{trip.duration} Days</Badge>
                  <Badge variant="accent">{formatCurrency(trip.estimatedBudget)}</Badge>
                  {trip.interests.slice(0, 3).map((i) => (
                    <Badge key={i} variant="outline">{i}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted">
                  Saved {new Date(trip.savedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/trip/${trip.id}`}>
                  <Button size="sm">
                    View Trip
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(trip.id)}
                  aria-label="Delete trip"
                >
                  <Trash2 className="h-4 w-4 text-muted hover:text-red-400" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
