"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  MapPin,
  Calendar,
  DollarSign,
  Bookmark,
  BookmarkCheck,
  ArrowLeft,
  ExternalLink,
  Star,
  Clock,
  Info,
  Lightbulb,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BudgetBar } from "@/components/ui/progress";
import { SimpleDialog } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { track } from "@/lib/analytics";
import {
  loadTripForResultsPage,
  saveTripToSaved,
  isTripSaved,
  deleteSavedTrip,
  setActiveTrip,
} from "@/lib/storage";
import type { TripPlan, ItineraryActivity } from "@/types/trip";
import { getDestinationImage } from "@/lib/images";
import { TripRefinePanel } from "@/components/trip/trip-refine-panel";

interface TripResultsProps {
  tripId: string;
}

export function TripResults({ tripId }: TripResultsProps) {
  const searchParams = useSearchParams();
  const [trip, setTrip] = useState<TripPlan | null>(null);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [whyDialog, setWhyDialog] = useState<{ title: string; reason: string } | null>(null);

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

  const handleAffiliateClick = (type: "hotel" | "activity" | "restaurant" | "product", name: string) => {
    track(`${type === "hotel" ? "hotel" : "activity"}_clicked`, { name, destination: trip?.destination });
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

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <section className="relative border-b border-border">
        <div className="absolute inset-0 h-56 overflow-hidden">
          <Image
            src={getDestinationImage(trip.destination, 1400)}
            alt={trip.destination}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/70 to-background" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-14 pb-8 sm:pt-20 sm:pb-12">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <Link href="/planner" className="inline-flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Plan another trip
            </Link>
            <Button variant={saved ? "secondary" : "outline"} size="sm" onClick={handleSave}>
              {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              {saved ? "Saved" : "Save Trip"}
            </Button>
          </div>

          <p className="eyebrow mb-2">Your Trip</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 text-foreground">
            Your <span className="text-destination">{trip.destination}</span> Trip
          </h1>
          {(trip.destinationLabel || trip.country) && (
            <p className="mb-3">
              {trip.destinationLatitude != null && trip.destinationLongitude != null ? (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${trip.destinationLatitude}&mlon=${trip.destinationLongitude}#map=12/${trip.destinationLatitude}/${trip.destinationLongitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-primary transition-colors"
                >
                  <MapPin className="h-4 w-4" />
                  {trip.destinationLabel || [trip.destination, trip.country].filter(Boolean).join(", ")}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm text-foreground-secondary">
                  <MapPin className="h-4 w-4" />
                  {trip.destinationLabel || [trip.destination, trip.country].filter(Boolean).join(", ")}
                </span>
              )}
            </p>
          )}
          <p className="text-muted text-sm sm:text-base tracking-wide uppercase">
            <span className="text-stat">{trip.duration} Days</span> &bull; <span className="text-stat">{formatCurrency(trip.estimatedBudget)}</span> Budget &bull; {trip.interests.join(" + ")}
          </p>
          <p className="mt-3 text-foreground-secondary max-w-2xl leading-relaxed">{trip.tripSummary}</p>
        </div>
      </section>

      {/* Overview Cards */}
      <section className="section-base mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Estimated Trip Cost", value: formatCurrency(totalBudget), icon: DollarSign },
            { label: "Daily Average", value: formatCurrency(dailyAvg), icon: Calendar },
            { label: "Best Area to Stay", value: trip.recommendedNeighborhood, icon: MapPin },
            { label: "Travel Style", value: trip.travelStyle, icon: Star },
          ].map((item) => (
            <Card key={item.label} className="p-5 hover:border-border-accent transition-colors">
              <item.icon className="h-4 w-4 text-foreground-secondary mb-3" />
              <p className="text-xs text-muted mb-1">{item.label}</p>
              <p className="font-semibold text-sm sm:text-base text-stat">{item.value}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Where to Stay */}
      <section className="section-raised mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 border-t border-border">
        <p className="eyebrow mb-2">Accommodation</p>
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">Where I&apos;d Stay</h2>
        <p className="text-foreground-secondary mb-8 max-w-2xl">{trip.neighborhoodReason}</p>

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          {trip.neighborhoods.map((n, i) => (
            <Card
              key={n.name}
              className={`p-5 transition-colors ${i === 0 ? "border-border-accent bg-primary-muted" : "hover:border-border-accent"}`}
            >
              {i === 0 && <Badge className="mb-3">Recommended</Badge>}
              <h3 className="font-semibold mb-1">{n.name}</h3>
              <p className="text-xs text-accent-text mb-2">Best for: {n.bestFor}</p>
              <p className="text-sm text-foreground-secondary">{n.why}</p>
            </Card>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {trip.hotelRecommendations.map((hotel) => (
            <Card key={hotel.name} className="overflow-hidden hover:border-border-accent transition-all hover:-translate-y-0.5">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold">{hotel.name}</h3>
                  {hotel.rating > 0 && (
                    <div className="flex items-center gap-1 text-xs text-accent-text shrink-0 ml-2">
                      <Star className="h-3 w-3 fill-foreground-secondary text-foreground-secondary" />
                      {hotel.rating}
                    </div>
                  )}
                </div>
                <p className="text-sm text-accent-text mb-2">{hotel.priceRange}</p>
                <p className="text-sm text-foreground-secondary mb-3">{hotel.description}</p>
                <p className="text-xs text-muted mb-3 italic">&ldquo;{hotel.whyRecommended}&rdquo;</p>
                {hotel.address && (
                  <p className="text-xs text-muted mb-2 flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {hotel.address}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  {hotel.source === "verified" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">Verified</Badge>
                  )}
                  <a
                    href={hotel.mapsUrl || hotel.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleAffiliateClick("hotel", hotel.name)}
                    className="flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      {hotel.mapsUrl ? "View on Map" : "View Hotel"}
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Itinerary */}
      <section className="section-alt mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 border-t border-border">
        <p className="eyebrow mb-2">Itinerary</p>
        <h2 className="text-2xl sm:text-3xl font-bold mb-8">Day by Day</h2>
        <div className="space-y-6">
          {trip.dailyItinerary.map((day) => (
            <Card key={day.day} className="overflow-hidden">
              <div className="flex items-center gap-4 p-5 border-b border-border bg-surface">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent border border-accent/40 text-accent-text font-medium">
                  {day.day}
                </div>
                <h3 className="font-semibold text-lg">{day.title}</h3>
              </div>
              <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
                {(["morning", "afternoon", "evening"] as const).map((period) => (
                  <div key={period} className="p-5">
                    <p className="text-xs font-medium uppercase tracking-wider text-primary/80 mb-3">
                      {period}
                    </p>
                    <div className="space-y-3">
                      {day[period].map((activity: ItineraryActivity, i: number) => (
                        <div key={i} className="rounded-xl bg-background/50 p-3 border border-border">
                          <p className="text-sm font-medium mb-1 text-highlight">{activity.name}</p>
                          <p className="text-xs text-muted mb-2">{activity.description}</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setWhyDialog({ title: activity.name, reason: activity.whyRecommended })}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors"
                            >
                              <Info className="h-3 w-3" />
                              Why this?
                            </button>
                            {activity.source === "verified" && activity.mapsUrl && (
                              <a
                                href={activity.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-foreground-secondary hover:text-foreground transition-colors"
                              >
                                <MapPin className="h-3 w-3" />
                                Map
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Budget */}
      <section className="section-base mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 border-t border-border">
        <p className="eyebrow mb-2">Budget</p>
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">Estimated Breakdown</h2>
        <p className="text-sm text-muted mb-8">All amounts are estimates, not live prices.</p>
        <Card className="p-6 max-w-xl">
          <div className="space-y-5">
            <BudgetBar label="Accommodation" amount={trip.budgetBreakdown.accommodation} total={totalBudget} color="bg-accent" />
            <BudgetBar label="Food" amount={trip.budgetBreakdown.food} total={totalBudget} color="bg-accent/70" />
            <BudgetBar label="Activities" amount={trip.budgetBreakdown.activities} total={totalBudget} color="bg-accent/50" />
            <BudgetBar label="Transportation" amount={trip.budgetBreakdown.transportation} total={totalBudget} color="bg-accent/35" />
            <BudgetBar label="Other" amount={trip.budgetBreakdown.other} total={totalBudget} color="bg-muted" />
          </div>
          <div className="mt-6 pt-4 border-t border-border flex justify-between">
            <span className="font-semibold">Total Estimate</span>
            <span className="font-bold text-stat">{formatCurrency(totalBudget)}</span>
          </div>
        </Card>
      </section>

      {/* Things to Do */}
      <section className="section-raised mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 border-t border-border">
        <p className="eyebrow mb-2">Activities</p>
        <h2 className="text-2xl sm:text-3xl font-bold mb-8">Things to Do</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {trip.activities.map((activity) => (
            <Card key={activity.name} className="overflow-hidden hover:border-border-accent transition-all">
              <div className="relative h-32 overflow-hidden">
                <Image
                  src={getDestinationImage(trip.destination, 400)}
                  alt={activity.name}
                  fill
                  className="object-cover opacity-80"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-elevated via-transparent to-transparent" />
              </div>
              <CardContent className="p-5">
                {activity.category && <Badge variant="secondary" className="mb-2">{activity.category}</Badge>}
                <h3 className="font-semibold mb-1">{activity.name}</h3>
                <p className="text-sm text-foreground-secondary mb-3">{activity.description}</p>
                <div className="flex items-center gap-3 text-xs text-muted mb-3">
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{activity.price}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{activity.duration}</span>
                </div>
                <p className="text-xs text-muted italic mb-3">&ldquo;{activity.whyRecommended}&rdquo;</p>
                {activity.address && (
                  <p className="text-xs text-muted mb-2 flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {activity.address}
                  </p>
                )}
                {activity.rating && (
                  <p className="text-xs text-muted mb-2 flex items-center gap-1">
                    <Star className="h-3 w-3 fill-foreground-secondary text-foreground-secondary" />
                    {activity.rating}{activity.reviewCount ? ` (${activity.reviewCount} reviews)` : ""}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  {activity.source === "verified" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">Verified</Badge>
                  )}
                  <a
                    href={activity.mapsUrl || activity.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleAffiliateClick("activity", activity.name)}
                    className="flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      {activity.mapsUrl ? "View on Map" : "View Activity"}
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Food */}
      <section className="section-alt mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 border-t border-border">
        <p className="eyebrow mb-2">Dining</p>
        <h2 className="text-2xl sm:text-3xl font-bold mb-8">Where to Eat</h2>
        {(["cheap", "mid-range", "special-occasion"] as const).map((category) => {
          const items = trip.restaurants.filter((r) => r.category === category);
          const labels = { cheap: "Budget Eats", "mid-range": "Mid-Range", "special-occasion": "Special Occasion" };
          return (
            <div key={category} className="mb-8">
              <h3 className="font-semibold mb-4 text-foreground-secondary">{labels[category]}</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {items.map((r) => (
                  <Card key={r.name} className="p-5 hover:border-border-accent transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold">{r.name}</h4>
                      <Badge variant="outline">{r.priceRange}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted mb-2">
                      <span>{r.cuisine} · {r.location}</span>
                      {r.rating && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-foreground-secondary text-foreground-secondary" />
                          {r.rating}
                          {r.reviewCount ? ` (${r.reviewCount})` : ""}
                        </span>
                      )}
                    </div>
                    {r.address && (
                      <p className="text-xs text-muted mb-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {r.address}
                      </p>
                    )}
                    <p className="text-sm text-foreground-secondary mb-3">{r.whyRecommended}</p>
                    <div className="flex items-center gap-2">
                      {r.source === "verified" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Verified</Badge>
                      )}
                      <a
                        href={r.mapsUrl || r.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleAffiliateClick("restaurant", r.name)}
                      >
                        <Button variant="ghost" size="sm" className="px-0">
                          {r.mapsUrl ? "View on Map" : "View Restaurant"}
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Travel Tips & Packing */}
      <section className="section-base mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 border-t border-border">
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Travel Tips</h2>
            </div>
            <ul className="space-y-3">
              {trip.travelTips.map((tip, i) => (
                <li key={i} className="flex gap-3 text-sm text-foreground-secondary">
                  <span className="text-muted font-medium shrink-0">{i + 1}.</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">What to Pack</h2>
            </div>
            <ul className="space-y-2">
              {trip.packingRecommendations.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-foreground-secondary">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Travel Essentials */}
      <section className="section-raised mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 border-t border-border">
        <p className="eyebrow mb-2">Travel Essentials</p>
        <h2 className="text-2xl font-bold mb-2">Things That Will Make This Trip Easier</h2>
        <p className="text-sm text-muted mb-8">Hand-picked gear recommendations for your trip.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trip.travelEssentials.map((product) => (
            <Card key={product.name} className="p-4 hover:border-border-accent transition-colors">
              <h4 className="font-medium text-sm mb-1">{product.name}</h4>
              <p className="text-xs text-foreground-secondary mb-2">{product.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">{product.price}</span>
                <a
                  href={product.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleAffiliateClick("product", product.name)}
                >
                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                    View
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </a>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Transportation */}
      <section className="section-alt mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 border-t border-border pb-16">
        <p className="eyebrow mb-2">Getting Around</p>
        <h2 className="text-2xl font-bold mb-6">Transportation</h2>
        <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
          {trip.transportation.map((tip, i) => (
            <Card key={i} className="p-4">
              <p className="text-sm text-foreground-secondary">{tip}</p>
            </Card>
          ))}
        </div>
      </section>

      <TripRefinePanel trip={trip} onUpdate={setTrip} />

      <SimpleDialog
        open={!!whyDialog}
        onOpenChange={() => setWhyDialog(null)}
        title={whyDialog?.title ?? ""}
      >
        {whyDialog?.reason}
      </SimpleDialog>
    </div>
  );
}
