"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  MapPin,
  Bookmark,
  BookmarkCheck,
  ArrowLeft,
  ExternalLink,
  Star,
  ChevronDown,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BudgetBar } from "@/components/ui/progress";
import { SimpleDialog } from "@/components/ui/dialog";
import { cn, formatCurrency } from "@/lib/utils";
import { track } from "@/lib/analytics";
import {
  loadTripForResultsPage,
  saveTripToSaved,
  isTripSaved,
  deleteSavedTrip,
  setActiveTrip,
} from "@/lib/storage";
import type { ActivityRecommendation, ItineraryActivity, TripPlan } from "@/types/trip";
import { getHeroDestinationImage, getPlaceFallbackImage } from "@/lib/images";
import { googlePlacePageUrl, isGooglePhotoSrc } from "@/lib/travel/google-links";
import { TripRefinePanel } from "@/components/trip/trip-refine-panel";
import {
  AddToItineraryButton,
  activityToStop,
  addStopToTrip,
  placeAlreadyOnTrip,
  removeStopFromTrip,
  restaurantToStop,
  type DaySlot,
} from "@/components/trip/add-to-itinerary";

interface TripResultsProps {
  tripId: string;
}

export function TripResults({ tripId }: TripResultsProps) {
  const searchParams = useSearchParams();
  const [trip, setTrip] = useState<TripPlan | null>(null);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [activityTypeFilter, setActivityTypeFilter] = useState("all");
  const [whyDialog, setWhyDialog] = useState<{ title: string; reason: string } | null>(null);
  const [heroPhotoUrl, setHeroPhotoUrl] = useState<string | undefined>();

  useEffect(() => {
    const preferActive = searchParams.get("fresh") === "1";
    const plan = loadTripForResultsPage(tripId, preferActive);
    setTrip(plan);
    setSaved(plan ? isTripSaved(plan.id) : isTripSaved(tripId));
    setReady(true);

    if (preferActive && plan && typeof window !== "undefined") {
      window.history.replaceState(null, "", `/trip/${plan.id}`);
    }
  }, [tripId, searchParams]);

  useEffect(() => {
    if (!trip) return;
    if (trip.destinationPhotoUrl) {
      setHeroPhotoUrl(trip.destinationPhotoUrl);
      return;
    }
    if (trip.destinationLatitude == null || trip.destinationLongitude == null) return;
    const params = new URLSearchParams({
      city: trip.destination,
      country: trip.country ?? "",
      lat: String(trip.destinationLatitude),
      lng: String(trip.destinationLongitude),
    });
    fetch(`/api/places/destination-photo?${params}`)
      .then((res) => res.json() as Promise<{ photoUrl?: string | null }>)
      .then((data) => {
        if (data.photoUrl) setHeroPhotoUrl(data.photoUrl);
      })
      .catch(() => undefined);
  }, [trip]);

  const persist = (next: TripPlan) => {
    setTrip(next);
    setActiveTrip(next);
    if (isTripSaved(next.id)) {
      saveTripToSaved(next);
    }
  };

  const handleSave = () => {
    if (!trip) return;
    if (saved) {
      deleteSavedTrip(trip.id);
      setSaved(false);
    } else {
      saveTripToSaved(trip);
      track("save_trip", { destination: trip.destination });
      setSaved(true);
    }
  };

  const activityTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const activity of trip?.activities ?? []) {
      const type = activityTypeLabel(activity);
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [trip?.activities]);

  const visibleActivities = useMemo(() => {
    const activities = trip?.activities ?? [];
    const list =
      activityTypeFilter === "all"
        ? [...activities]
        : activities.filter((activity) => activityTypeLabel(activity) === activityTypeFilter);

    list.sort((a, b) => {
      if (activityTypeFilter === "all") {
        const typeCmp = activityTypeLabel(a).localeCompare(activityTypeLabel(b));
        if (typeCmp !== 0) return typeCmp;
      }
      return (b.rating ?? 0) - (a.rating ?? 0);
    });
    return list;
  }, [trip?.activities, activityTypeFilter]);

  useEffect(() => {
    if (activityTypeFilter === "all") return;
    if (!activityTypes.some(([type]) => type === activityTypeFilter)) {
      setActivityTypeFilter("all");
    }
  }, [activityTypeFilter, activityTypes]);

  const addRecommendation = (stop: ItineraryActivity, day: number, slot: DaySlot) => {
    if (!trip) return;
    persist(addStopToTrip(trip, stop, day, slot));
  };

  const removeStop = (day: number, slot: DaySlot, index: number) => {
    if (!trip) return;
    persist(removeStopFromTrip(trip, day, slot, index));
  };

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-sm text-muted">Loading your trip…</p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <MapPin className="h-12 w-12 text-muted mb-4" />
        <h2 className="text-xl font-semibold mb-2">Trip not found</h2>
        <p className="text-foreground-secondary mb-6">This trip may have expired or been removed.</p>
        <Link href="/planner">
          <Button>Plan a New Trip</Button>
        </Link>
      </div>
    );
  }

  const totalBudget = Object.values(trip.budgetBreakdown).reduce((a, b) => a + b, 0);
  const dailyAvg = Math.round(totalBudget / trip.duration);
  const placeLabel = trip.destinationLabel || [trip.destination, trip.country].filter(Boolean).join(", ");

  return (
    <div className="animate-fade-in">
      <section>
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 pt-6 pb-4">
          <Link
            href="/planner"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Plan another trip
          </Link>
          <Button variant={saved ? "secondary" : "outline"} size="sm" onClick={handleSave}>
            {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            {saved ? "Saved" : "Save"}
          </Button>
        </div>

        <div className="relative h-52 sm:h-72 overflow-hidden">
          <Image
            src={heroPhotoUrl || getHeroDestinationImage(trip.destination)}
            alt={trip.destination}
            fill
            unoptimized={isGooglePhotoSrc(heroPhotoUrl)}
            className="object-cover object-center"
            sizes="100vw"
            quality={90}
            priority
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
            style={{
              background:
                "linear-gradient(to top, var(--color-background) 0%, rgba(245,241,232,0.82) 42%, rgba(245,241,232,0) 100%)",
            }}
          />
        </div>

        <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8 pt-5 pb-2">
          {placeLabel && (
            trip.destinationLatitude != null && trip.destinationLongitude != null ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${trip.destinationLatitude},${trip.destinationLongitude}`}
                target="_blank"
                rel="noreferrer"
                className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium uppercase tracking-[0.16em] text-foreground-secondary hover:text-primary transition-colors"
              >
                <MapPin className="h-3.5 w-3.5" />
                {locationSubtitle(trip.destination, placeLabel)}
              </a>
            ) : (
              <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium uppercase tracking-[0.16em] text-foreground-secondary">
                <MapPin className="h-3.5 w-3.5" />
                {locationSubtitle(trip.destination, placeLabel)}
              </p>
            )
          )}
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-destination leading-[1.1] mb-3">
            {trip.destination}
          </h1>
          <p className="text-lg text-foreground">
            {[
              `${trip.duration} days`,
              trip.dates && trip.dates !== "Flexible dates" ? trip.dates : null,
              formatCurrency(trip.estimatedBudget),
              trip.travelStyle,
              trip.interests.slice(0, 2).join(" & "),
            ]
              .filter(Boolean)
              .join("  ·  ")}
          </p>
          {trip.tripSummary && (
            <p className="mt-4 max-w-2xl text-base leading-7 text-foreground-secondary">
              {trip.tripSummary}
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Trip estimate", value: formatCurrency(totalBudget) },
            { label: "Daily average", value: formatCurrency(dailyAvg) },
            { label: "Stay near", value: trip.recommendedNeighborhood },
            { label: "Style", value: trip.travelStyle },
          ].map((item) => (
            <Card key={item.label} className="px-4 py-4">
              <p className="text-sm text-muted mb-1">{item.label}</p>
              <p className="font-medium text-stat truncate">{item.value}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8 py-12 border-t border-border">
        <p className="eyebrow mb-2">Stay</p>
        <h2 className="text-2xl sm:text-3xl font-bold mb-8">Where to stay</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {trip.hotelRecommendations.map((hotel) => (
            <PhotoPlaceCard
              key={hotel.name}
              title={hotel.name}
              photoSrc={hotel.photoUrl || getPlaceFallbackImage(hotel.name, trip.destination, 800)}
              line={[hotel.address || hotel.neighborhood, hotel.priceRange !== "Check current rates" ? hotel.priceRange : ""]
                .filter(Boolean)
                .join(" · ")}
              rating={hotel.rating}
              reviewCount={hotel.reviewCount}
              mapsUrl={googlePlacePageUrl(hotel)}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8 py-10 border-t border-border">
        <p className="eyebrow mb-2">Itinerary</p>
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">Day by day</h2>
        <p className="text-base text-muted mb-8">Add or remove stops anytime from the lists below.</p>
        <div className="space-y-8">
          {trip.dailyItinerary.map((day) => (
            <Card key={day.day} className="overflow-hidden">
              <div className="flex items-center gap-4 px-6 py-5 border-b border-border">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-muted text-base font-semibold text-primary">
                  {day.day}
                </span>
                <h3 className="text-xl font-semibold">{day.title}</h3>
              </div>
              <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
                {(["morning", "afternoon", "evening"] as const).map((period) => (
                  <div key={period} className="p-4 min-h-[16rem]">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted mb-3 px-1">
                      {period}
                    </p>
                    <div className="space-y-4">
                      {day[period].length === 0 && (
                        <p className="px-1 text-base text-muted leading-7">
                          Empty — add something from Recommended Activities.
                        </p>
                      )}
                      {day[period].map((activity: ItineraryActivity, index: number) => (
                        <ItineraryStopCard
                          key={`${activity.name}-${index}`}
                          activity={activity}
                          photoSrc={
                            activity.photoUrl ||
                            resolveStopPhoto(trip, activity) ||
                            getPlaceFallbackImage(activity.name, trip.destination, 800)
                          }
                          onRemove={() => removeStop(day.day, period, index)}
                          onWhy={() => setWhyDialog({ title: activity.name, reason: activity.whyRecommended })}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8 py-12 border-t border-border">
        <p className="eyebrow mb-2">More options</p>
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">Recommended Activities</h2>
        <p className="text-base text-muted mb-6">Places you can add to any day.</p>
        {activityTypes.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-8" role="tablist" aria-label="Filter activities by type">
            <TypeFilterChip
              label="All"
              count={trip.activities.length}
              selected={activityTypeFilter === "all"}
              onClick={() => setActivityTypeFilter("all")}
            />
            {activityTypes.map(([type, count]) => (
              <TypeFilterChip
                key={type}
                label={type}
                count={count}
                selected={activityTypeFilter === type}
                onClick={() => setActivityTypeFilter(type)}
              />
            ))}
          </div>
        )}
        {visibleActivities.length === 0 ? (
          <p className="text-base text-muted">No {activityTypeFilter === "all" ? "" : `${activityTypeFilter.toLowerCase()} `}activities on this trip.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleActivities.map((activity) => (
              <RecommendationCard
                key={`${activity.providerPlaceId ?? activity.name}`}
                title={activity.name}
                category={activity.category}
                line={[activity.address || activity.description, activity.price !== "Check locally" ? activity.price : ""]
                  .filter(Boolean)
                  .join(" · ")}
                rating={activity.rating}
                reviewCount={activity.reviewCount}
                photoUrl={activity.photoUrl}
                fallbackImage={getPlaceFallbackImage(activity.name, trip.destination, 400)}
                mapsUrl={googlePlacePageUrl(activity)}
                alreadyAdded={placeAlreadyOnTrip(trip, activity.name, activity.providerPlaceId)}
                onAdd={(day, slot) => addRecommendation(activityToStop(activity), day, slot)}
                trip={trip}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8 py-12 border-t border-border">
        <p className="eyebrow mb-2">Dining</p>
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">Where to eat</h2>
        <p className="text-base text-muted mb-8">Add a restaurant to dinner or any other slot.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {trip.restaurants.map((restaurant) => (
            <RecommendationCard
              key={`${restaurant.providerPlaceId ?? restaurant.name}`}
              title={restaurant.name}
              line={[restaurant.cuisine, restaurant.priceRange !== "–" ? restaurant.priceRange : "", restaurant.address || restaurant.location]
                .filter(Boolean)
                .join(" · ")}
              rating={restaurant.rating}
              reviewCount={restaurant.reviewCount}
              photoUrl={restaurant.photoUrl}
              fallbackImage={getPlaceFallbackImage(restaurant.name, trip.destination, 400)}
              mapsUrl={googlePlacePageUrl(restaurant)}
              alreadyAdded={placeAlreadyOnTrip(trip, restaurant.name, restaurant.providerPlaceId)}
              onAdd={(day, slot) => addRecommendation(restaurantToStop(restaurant), day, slot)}
              trip={trip}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8 py-12 border-t border-border">
        <p className="eyebrow mb-2">Budget</p>
        <h2 className="text-2xl font-bold mb-2">Estimate</h2>
        <p className="text-base text-muted mb-6">Planning figures only — not live prices.</p>
        <Card className="p-6 max-w-lg">
          <div className="space-y-4">
            <BudgetBar label="Accommodation" amount={trip.budgetBreakdown.accommodation} total={totalBudget} color="bg-accent" />
            <BudgetBar label="Food" amount={trip.budgetBreakdown.food} total={totalBudget} color="bg-accent/70" />
            <BudgetBar label="Activities" amount={trip.budgetBreakdown.activities} total={totalBudget} color="bg-accent/50" />
            <BudgetBar label="Transportation" amount={trip.budgetBreakdown.transportation} total={totalBudget} color="bg-accent/35" />
            <BudgetBar label="Other" amount={trip.budgetBreakdown.other} total={totalBudget} color="bg-muted" />
          </div>
          <div className="mt-5 pt-4 border-t border-border flex justify-between text-base">
            <span>Total</span>
            <span className="font-semibold text-stat">{formatCurrency(totalBudget)}</span>
          </div>
        </Card>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8 py-10 border-t border-border pb-16">
        <button
          type="button"
          onClick={() => setShowExtras((value) => !value)}
          className="inline-flex items-center gap-2 text-base text-foreground-secondary hover:text-foreground"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${showExtras ? "rotate-180" : ""}`} />
          Tips, packing, and extras
        </button>
        {showExtras && (
          <div className="mt-8 space-y-10">
            <div className="grid md:grid-cols-2 gap-10">
              <div>
                <h3 className="text-lg font-semibold mb-4">Travel tips</h3>
                <ul className="space-y-3">
                  {trip.travelTips.map((tip) => (
                    <li key={tip} className="text-base leading-7 text-foreground-secondary">
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-4">What to pack</h3>
                <ul className="space-y-2">
                  {trip.packingRecommendations.map((item) => (
                    <li key={item} className="text-base leading-7 text-foreground-secondary">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {trip.transportation.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Getting around</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {trip.transportation.map((tip) => (
                    <p key={tip} className="text-base leading-7 text-foreground-secondary">
                      {tip}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {trip.travelEssentials.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Travel essentials</h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  {trip.travelEssentials.map((product) => (
                    <Card key={product.name} className="p-4">
                      <p className="text-base font-medium mb-1">{product.name}</p>
                      <p className="text-sm text-muted mb-3">{product.price}</p>
                      <a href={product.bookingUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="px-0 h-7">
                          View
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <TripRefinePanel trip={trip} onUpdate={(next) => persist(next)} />

      <SimpleDialog open={!!whyDialog} onOpenChange={() => setWhyDialog(null)} title={whyDialog?.title ?? ""}>
        {whyDialog?.reason}
      </SimpleDialog>
    </div>
  );
}

function locationSubtitle(destination: string, label: string): string {
  const dest = destination.trim();
  if (label.toLowerCase().startsWith(dest.toLowerCase())) {
    return label.slice(dest.length).replace(/^,\s*/, "") || label;
  }
  return label;
}

function resolveStopPhoto(trip: TripPlan, stop: ItineraryActivity): string | undefined {
  const needle = stop.name.toLowerCase().trim();
  const matchId = stop.providerPlaceId;
  const lists = [...trip.activities, ...trip.restaurants, ...trip.hotelRecommendations];
  const match = lists.find((place) => {
    if (matchId && place.providerPlaceId && place.providerPlaceId === matchId) return true;
    return place.name.toLowerCase().trim() === needle;
  });
  return match?.photoUrl;
}

function PhotoPlaceCard({
  title,
  photoSrc,
  category,
  line,
  rating,
  reviewCount,
  mapsUrl,
  onRemove,
  onWhy,
  actions,
}: {
  title: string;
  photoSrc: string;
  category?: string;
  line?: string;
  rating?: number;
  reviewCount?: number;
  mapsUrl?: string;
  onRemove?: () => void;
  onWhy?: () => void;
  actions?: ReactNode;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[var(--radius-card)] min-h-[20rem] isolate">
      <Image
        src={photoSrc}
        alt={title}
        fill
        unoptimized={isGooglePhotoSrc(photoSrc)}
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 33vw"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, #ffffff 0%, #ffffff 22%, rgba(255,255,255,0.92) 38%, rgba(255,255,255,0.55) 55%, rgba(255,255,255,0) 78%)",
        }}
      />
      {category && (
        <Badge variant="secondary" className="absolute top-3 left-3 z-10 bg-white/90 text-sm">
          {category}
        </Badge>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2.5 right-2.5 z-10 rounded-md bg-white/90 p-1.5 text-foreground shadow-sm opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
          aria-label={`Remove ${title}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="absolute inset-x-0 bottom-0 z-10 p-4">
        <h3 className="text-lg font-semibold leading-6 text-[#252329]">{title}</h3>
        {line && <p className="mt-1 text-sm leading-5 text-[#4a4750] line-clamp-2">{line}</p>}
        {rating != null && rating > 0 && (
          <p className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-[#252329]">
            <Star className="h-3.5 w-3.5" />
            {rating}
            {reviewCount ? ` · ${reviewCount} reviews` : ""}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {actions}
          {onWhy && (
            <button
              type="button"
              onClick={onWhy}
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              Why this?
            </button>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[#252329] hover:text-primary"
            >
              Open in Google
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function ItineraryStopCard({
  activity,
  photoSrc,
  onRemove,
  onWhy,
}: {
  activity: ItineraryActivity;
  photoSrc: string;
  onRemove: () => void;
  onWhy: () => void;
}) {
  return (
    <PhotoPlaceCard
      title={activity.name}
      photoSrc={photoSrc}
      line={activity.address}
      rating={activity.rating}
      mapsUrl={googlePlacePageUrl(activity)}
      onRemove={onRemove}
      onWhy={activity.whyRecommended ? onWhy : undefined}
    />
  );
}

function activityTypeLabel(activity: ActivityRecommendation): string {
  return activity.category?.trim() || "Other";
}

function TypeFilterChip({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
        selected
          ? "border-primary bg-primary-muted text-primary"
          : "border-border text-foreground-secondary hover:border-border-accent hover:text-foreground"
      )}
    >
      {label}
      <span className={selected ? "text-primary/70" : "text-muted"}>{count}</span>
    </button>
  );
}

function RecommendationCard({
  title,
  category,
  line,
  rating,
  reviewCount,
  photoUrl,
  fallbackImage,
  mapsUrl,
  alreadyAdded,
  onAdd,
  trip,
}: {
  title: string;
  category?: string;
  line: string;
  rating?: number;
  reviewCount?: number;
  photoUrl?: string;
  fallbackImage: string;
  mapsUrl?: string;
  alreadyAdded: boolean;
  onAdd: (day: number, slot: DaySlot) => void;
  trip: TripPlan;
}) {
  return (
    <PhotoPlaceCard
      title={title}
      photoSrc={photoUrl || fallbackImage}
      category={category}
      line={line}
      rating={rating}
      reviewCount={reviewCount}
      mapsUrl={mapsUrl}
      actions={<AddToItineraryButton trip={trip} alreadyAdded={alreadyAdded} onAdd={onAdd} />}
    />
  );
}
