"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  Heart,
  Plane,
  Settings,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import { PreferencesDialog } from "@/components/profile/preferences-dialog";
import {
  countryFlag,
  filterSavedPlaces,
  formatTripBudget,
  getPreferenceBars,
  getProfileStats,
  getProfileTrips,
  PLACE_FILTERS,
  profileInitials,
  extractSavedPlaces,
  type SavedPlaceFilter,
} from "@/lib/profile-data";
import {
  getSavedTrips,
  getUserPreferences,
  getUserProfile,
  saveUserPreferences,
  saveUserProfile,
} from "@/lib/storage";
import { cn } from "@/lib/utils";
import { DEFAULT_USER_PREFERENCES, DEFAULT_USER_PROFILE, type UserPreferences, type UserProfile } from "@/types/trip";

const PLACE_PREVIEW_LIMIT = 6;

function ProfileSection({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-border px-1 py-6 sm:px-2", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <span aria-hidden className="text-lg leading-none">
            {icon}
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCell({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 px-2 text-center">
      <p className="text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs font-medium text-muted sm:text-sm">{label}</p>
    </div>
  );
}

function PreferenceBar({ label, score }: { label: string; score: number }) {
  const width = Math.max(8, Math.round((score / 9) * 100));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs tabular-nums text-muted">{width}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-hover">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary-hover transition-all duration-500"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function SettingsRow({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between py-3.5 text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
    >
      <span>{label}</span>
      <ChevronRight className="h-4 w-4 text-muted" />
    </button>
  );
}

function PlaceCard({ name, destination, photoUrl }: { name: string; destination: string; photoUrl?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background/50 transition-colors hover:border-border-accent">
      <div className="relative aspect-[4/3] bg-surface">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 180px"
            unoptimized={photoUrl.startsWith("/api/")}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl">📍</div>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="line-clamp-2 text-sm font-medium leading-5 text-foreground">{name}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{destination}</p>
      </div>
    </div>
  );
}

function TripHighlightCard({
  trip,
  label,
}: {
  trip: NonNullable<ReturnType<typeof getProfileTrips>["upcoming"]>;
  label: string;
}) {
  return (
    <>
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted">{label}</p>
      <div className="rounded-xl border border-border/80 bg-background/55 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-lg font-semibold text-destination sm:text-xl">
              <span aria-hidden>{countryFlag(trip.country)}</span>
              {trip.destination}
            </p>
            <p className="mt-1 text-sm text-foreground-secondary sm:text-[15px]">
              {trip.datesLabel} · {trip.duration} days
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{formatTripBudget(trip.budget)}</p>
          </div>
          <Link href={`/trip/${trip.id}`}>
            <Button size="sm" className="w-full sm:w-auto">
              View Trip
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}

export default function ProfileClient() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [stats, setStats] = useState({ tripCount: 0, countryCount: 0, savedPlaceCount: 0 });
  const [upcomingTrip, setUpcomingTrip] = useState<ReturnType<typeof getProfileTrips>["upcoming"]>(null);
  const [recentTrip, setRecentTrip] = useState<ReturnType<typeof getProfileTrips>["recent"]>(null);
  const [savedPlaces, setSavedPlaces] = useState<ReturnType<typeof extractSavedPlaces>>([]);
  const [placeFilter, setPlaceFilter] = useState<SavedPlaceFilter>("All");
  const [showAllPlaces, setShowAllPlaces] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    setProfile(getUserProfile());
    setPrefs(getUserPreferences());
    setStats(getProfileStats());
    const trips = getProfileTrips();
    setUpcomingTrip(trips.upcoming);
    setRecentTrip(trips.recent);
    setSavedPlaces(extractSavedPlaces(getSavedTrips()));
  }, []);

  const preferenceBars = useMemo(() => getPreferenceBars(prefs), [prefs]);
  const filteredPlaces = useMemo(
    () => filterSavedPlaces(savedPlaces, placeFilter),
    [savedPlaces, placeFilter]
  );
  const visiblePlaces = showAllPlaces ? filteredPlaces : filteredPlaces.slice(0, PLACE_PREVIEW_LIMIT);

  const refreshProfileData = () => {
    setStats(getProfileStats());
    const trips = getProfileTrips();
    setUpcomingTrip(trips.upcoming);
    setRecentTrip(trips.recent);
    setSavedPlaces(extractSavedPlaces(getSavedTrips()));
  };

  const handleSaveProfile = () => {
    saveUserProfile(profile);
  };

  const handleSavePreferences = () => {
    saveUserPreferences(prefs);
    refreshProfileData();
  };

  const featuredTrip = upcomingTrip ?? recentTrip;
  const featuredTripLabel = upcomingTrip ? "Upcoming" : recentTrip ? "Recent" : null;

  return (
    <>
      <div className="section-raised min-h-[calc(100vh-4rem)] border-t border-border">
        <div className="mx-auto max-w-[84rem] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mb-8 sm:mb-10">
            <p className="eyebrow mb-3">Your account</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl leading-[1.15]">
              Profile
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground-secondary sm:text-[16px]">
              Trips, saved places, preferences, and settings — all in one place.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)] xl:gap-8">
            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="hero-glass overflow-hidden px-5 py-6 text-center shadow-sm sm:px-6">
                <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border border-primary/30 bg-primary-muted/70 text-3xl font-semibold text-primary shadow-[0_0_24px_-6px_rgba(169,149,214,0.45)]">
                  {profileInitials(profile.displayName)}
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  {profile.displayName || "Traveler"}
                </h2>
                <p className="mt-1 text-sm text-foreground-secondary">
                  {profile.email || "Add your email"}
                </p>
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => setEditProfileOpen(true)}>
                  Edit Profile
                </Button>

                <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border/70 pt-5">
                  <StatCell value={stats.tripCount} label="Trips" />
                  <StatCell value={stats.countryCount} label="Countries" />
                  <StatCell value={stats.savedPlaceCount} label="Saved" />
                </div>
              </div>

              <div className="card-surface p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Bliss+</h3>
                </div>
                <p className="text-sm font-medium text-foreground">Unlock unlimited trip planning</p>
                <p className="mt-1 text-sm leading-relaxed text-foreground-secondary">
                  Premium itineraries, offline access, and priority place picks — coming soon.
                </p>
                <Button size="sm" className="mt-4 w-full sm:w-auto" disabled>
                  Upgrade
                </Button>
              </div>

              <div className="card-surface p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted" />
                  <h3 className="text-sm font-semibold text-foreground">Settings</h3>
                </div>
                <div className="divide-y divide-border/70">
                  <SettingsRow label="Notifications" onClick={() => {}} />
                  <SettingsRow label="Currency" onClick={() => {}} />
                  <SettingsRow label="Privacy" onClick={() => {}} />
                  <SettingsRow label="Log out" onClick={() => {}} />
                </div>
                <p className="mt-4 flex items-center gap-2 text-xs text-muted">
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  Account sign-in and cloud sync are on the way.
                </p>
              </div>
            </aside>

            <div className="space-y-6">
              <div className="hero-glass overflow-hidden px-5 py-6 shadow-sm sm:px-7 sm:py-7">
                <ProfileSection
                  title="My Trips"
                  icon={<Plane className="h-4 w-4 text-primary" />}
                  className="border-t-0 px-0 py-0"
                  action={
                    stats.tripCount > 0 ? (
                      <Link href="/saved" className="subcontainer-link inline-flex items-center gap-1 text-sm">
                        Past Trips
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : null
                  }
                >
                  {featuredTrip && featuredTripLabel ? (
                    <TripHighlightCard trip={featuredTrip} label={featuredTripLabel} />
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/80 bg-background/40 px-4 py-10 text-center">
                      <p className="text-sm text-foreground-secondary">No trips yet.</p>
                      <Link href="/planner" className="mt-4 inline-flex">
                        <Button size="sm">Plan your first trip</Button>
                      </Link>
                    </div>
                  )}
                </ProfileSection>
              </div>

              <div className="hero-glass overflow-hidden px-5 py-6 shadow-sm sm:px-7 sm:py-7">
                <ProfileSection
                  title="Saved Places"
                  icon={<Heart className="h-4 w-4 text-accent-text" />}
                  className="border-t-0 px-0 py-0"
                  action={
                    filteredPlaces.length > PLACE_PREVIEW_LIMIT ? (
                      <button
                        type="button"
                        onClick={() => setShowAllPlaces((value) => !value)}
                        className="subcontainer-link inline-flex items-center gap-1 text-sm"
                      >
                        {showAllPlaces ? "Show less" : "View All"}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    ) : null
                  }
                >
                  <div className="mb-5 flex flex-wrap gap-2">
                    {PLACE_FILTERS.map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => {
                          setPlaceFilter(filter);
                          setShowAllPlaces(false);
                        }}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                          placeFilter === filter
                            ? "border-primary/40 bg-primary-muted text-primary"
                            : "border-border/70 bg-background/50 text-foreground-secondary hover:border-border"
                        )}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>

                  {visiblePlaces.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                      {visiblePlaces.map((place) => (
                        <Link key={place.id} href={`/trip/${place.tripId}`}>
                          <PlaceCard name={place.name} destination={place.destination} photoUrl={place.photoUrl} />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-border/80 bg-background/40 px-4 py-10 text-center text-sm text-foreground-secondary">
                      Save a trip to collect restaurants, hotels, and activities here.
                    </p>
                  )}
                </ProfileSection>
              </div>

              <div className="hero-glass overflow-hidden px-5 py-6 shadow-sm sm:px-7 sm:py-7">
                <ProfileSection
                  title="Travel Preferences"
                  icon={<Sparkles className="h-4 w-4 text-accent-text" />}
                  className="border-t-0 px-0 py-0"
                  action={
                    <button
                      type="button"
                      onClick={() => setPreferencesOpen(true)}
                      className="subcontainer-link inline-flex items-center gap-1 text-sm"
                    >
                      Edit Preferences
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    {preferenceBars.map((bar) => (
                      <PreferenceBar key={bar.label} label={bar.label} score={bar.score} />
                    ))}
                  </div>
                </ProfileSection>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EditProfileDialog
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
        profile={profile}
        onChange={setProfile}
        onSave={handleSaveProfile}
      />

      <PreferencesDialog
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
        prefs={prefs}
        onChange={setPrefs}
        onSave={handleSavePreferences}
      />
    </>
  );
}
