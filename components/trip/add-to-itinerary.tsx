"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  ActivityRecommendation,
  DailyItinerary,
  ItineraryActivity,
  RestaurantRecommendation,
  TripPlan,
} from "@/types/trip";

export type DaySlot = keyof Pick<DailyItinerary, "morning" | "afternoon" | "evening">;

interface AddToItineraryProps {
  trip: TripPlan;
  alreadyAdded: boolean;
  onAdd: (day: number, slot: DaySlot) => void;
}

export function placeAlreadyOnTrip(trip: TripPlan, name: string, placeId?: string): boolean {
  const needle = name.toLowerCase().trim();
  return trip.dailyItinerary.some((day) =>
    [...day.morning, ...day.afternoon, ...day.evening].some((stop) => {
      if (placeId && stop.providerPlaceId && stop.providerPlaceId === placeId) return true;
      return stop.name.toLowerCase().trim() === needle;
    })
  );
}

export function activityToStop(activity: ActivityRecommendation): ItineraryActivity {
  return {
    name: activity.name,
    description: activity.address || activity.description,
    whyRecommended: activity.whyRecommended,
    type: activity.category?.toLowerCase(),
    latitude: activity.latitude,
    longitude: activity.longitude,
    address: activity.address,
    rating: activity.rating,
    provider: activity.provider,
    providerPlaceId: activity.providerPlaceId,
    mapsUrl: activity.mapsUrl,
    photoUrl: activity.photoUrl,
    source: activity.source === "verified" ? "verified" : "curated",
  };
}

export function restaurantToStop(restaurant: RestaurantRecommendation): ItineraryActivity {
  return {
    name: restaurant.name,
    description: restaurant.address || restaurant.location,
    whyRecommended: restaurant.whyRecommended,
    type: "restaurant",
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
    address: restaurant.address,
    rating: restaurant.rating,
    provider: restaurant.provider,
    providerPlaceId: restaurant.providerPlaceId,
    mapsUrl: restaurant.mapsUrl,
    photoUrl: restaurant.photoUrl,
    source: restaurant.source === "verified" ? "verified" : "curated",
  };
}

export function addStopToTrip(
  trip: TripPlan,
  stop: ItineraryActivity,
  dayNumber: number,
  slot: DaySlot
): TripPlan {
  return {
    ...trip,
    dailyItinerary: trip.dailyItinerary.map((day) =>
      day.day === dayNumber ? { ...day, [slot]: [...day[slot], stop] } : day
    ),
  };
}

export function removeStopFromTrip(
  trip: TripPlan,
  dayNumber: number,
  slot: DaySlot,
  index: number
): TripPlan {
  return {
    ...trip,
    dailyItinerary: trip.dailyItinerary.map((day) =>
      day.day === dayNumber
        ? { ...day, [slot]: day[slot].filter((_, stopIndex) => stopIndex !== index) }
        : day
    ),
  };
}

export function AddToItineraryButton({ trip, alreadyAdded, onAdd }: AddToItineraryProps) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(trip.dailyItinerary[0]?.day ?? 1);
  const [slot, setSlot] = useState<DaySlot>("morning");

  if (alreadyAdded) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-foreground-secondary">
        <Check className="h-3.5 w-3.5" />
        On itinerary
      </span>
    );
  }

  if (!trip.dailyItinerary.length) return null;

  return (
    <div className="relative">
      {!open ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3 w-3" />
          Add
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={day}
            onChange={(event) => setDay(Number(event.target.value))}
            className="h-9 rounded-[var(--radius-button)] border border-border bg-surface-elevated px-2 text-sm text-foreground"
          >
            {trip.dailyItinerary.map((item) => (
              <option key={item.day} value={item.day}>
                Day {item.day}
              </option>
            ))}
          </select>
          <select
            value={slot}
            onChange={(event) => setSlot(event.target.value as DaySlot)}
            className="h-9 rounded-[var(--radius-button)] border border-border bg-surface-elevated px-2 text-sm text-foreground"
          >
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onAdd(day, slot);
              setOpen(false);
            }}
          >
            Add
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
