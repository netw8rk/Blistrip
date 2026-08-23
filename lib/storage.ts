"use client";

import type { TripPlan, SavedTrip, UserPreferences, UserProfile } from "@/types/trip";
import { DEFAULT_USER_PREFERENCES, DEFAULT_USER_PROFILE } from "@/types/trip";

const TRIPS_KEY = "blistrip_trips";
const SAVED_KEY = "blistrip_saved_trips";
const PREFS_KEY = "blistrip_user_preferences";
const PROFILE_KEY = "blistrip_user_profile";
const ACTIVE_KEY = "blistrip_active_trip";
const FRESH_KEY = "blistrip_fresh_trip_id";

export function saveTripPlan(trip: TripPlan): void {
  if (typeof window === "undefined") return;
  const trips = getAllTripPlans();
  trips[trip.id] = trip;
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
}

export function getTripPlan(id: string): TripPlan | null {
  if (typeof window === "undefined") return null;
  const trips = getAllTripPlans();
  return trips[id] ?? null;
}

export function getAllTripPlans(): Record<string, TripPlan> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TRIPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveTripToSaved(trip: TripPlan): SavedTrip {
  const saved: SavedTrip = {
    id: trip.id,
    destination: trip.destination,
    duration: trip.duration,
    estimatedBudget: trip.estimatedBudget,
    interests: trip.interests,
    savedAt: new Date().toISOString(),
    tripPlan: trip,
  };
  const all = getSavedTrips();
  const filtered = all.filter((t) => t.id !== saved.id);
  filtered.unshift(saved);
  localStorage.setItem(SAVED_KEY, JSON.stringify(filtered));
  return saved;
}

export function getSavedTrips(): SavedTrip[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function deleteSavedTrip(id: string): void {
  if (typeof window === "undefined") return;
  const filtered = getSavedTrips().filter((t) => t.id !== id);
  localStorage.setItem(SAVED_KEY, JSON.stringify(filtered));
}

export function isTripSaved(id: string): boolean {
  return getSavedTrips().some((t) => t.id === id);
}

export function getUserPreferences(): UserPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_USER_PREFERENCES;
  }
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_USER_PREFERENCES;
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

export function saveUserPreferences(prefs: UserPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function getUserProfile(): UserProfile {
  if (typeof window === "undefined") {
    return DEFAULT_USER_PROFILE;
  }
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? { ...DEFAULT_USER_PROFILE, ...JSON.parse(raw) } : DEFAULT_USER_PROFILE;
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

export function saveUserProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function setSessionTrip(trip: TripPlan): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`blistrip_trip_${trip.id}`, JSON.stringify(trip));
}

export function getSessionTrip(id: string): TripPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`blistrip_trip_${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActiveTrip(trip: TripPlan): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(trip);
  sessionStorage.setItem(ACTIVE_KEY, payload);
  sessionStorage.setItem(FRESH_KEY, trip.id);
  localStorage.setItem(ACTIVE_KEY, payload);
  setSessionTrip(trip);
  saveTripPlan(trip);
}

export function getActiveTrip(): TripPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ACTIVE_KEY) ?? localStorage.getItem(ACTIVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getFreshTripId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(FRESH_KEY);
}

function newestTrip(...plans: Array<TripPlan | null>): TripPlan | null {
  return (
    plans
      .filter((plan): plan is TripPlan => Boolean(plan?.id))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0] ?? null
  );
}

export function loadTripForResultsPage(urlId: string, preferActive: boolean): TripPlan | null {
  const active = getActiveTrip();

  if (preferActive && active) {
    return active;
  }

  if (active?.id === urlId) {
    return newestTrip(active, getSessionTrip(urlId), getTripPlan(urlId));
  }

  return newestTrip(getSessionTrip(urlId), getTripPlan(urlId));
}
