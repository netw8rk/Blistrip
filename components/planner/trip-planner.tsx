"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Compass,
  Gauge,
  Loader2,
  MapPin,
  NotebookPen,
  Shuffle,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OptionCard } from "@/components/ui/option-card";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { getUserPreferences, setActiveTrip } from "@/lib/storage";
import { getawayToPlannerInput, getPreplannedGetaway, type PreplannedGetaway } from "@/lib/preplanned-getaways";
import { INTEREST_META, PACE_META, STYLE_META, TRAVELER_META } from "@/lib/preference-meta";
import type { TripPlannerInput } from "@/types/trip";
import {
  BUDGET_OPTIONS,
  INTEREST_OPTIONS,
  PACE_OPTIONS,
  TRAVELER_OPTIONS,
  TRAVEL_STYLE_OPTIONS,
} from "@/types/trip";
import { pickRandomPlannerDestination } from "@/lib/planner/random-destination";
import { DestinationPicker } from "@/components/planner/destination-picker";
import type { DestinationSuggestion } from "@/lib/travel/suggest-places";

const TOTAL_STEPS = 8;

const STEP_META = [
  { label: "Dates", title: "When are you going?", subtitle: "Set your dates, or keep them open.", icon: CalendarDays },
  { label: "Place", title: "Where are you going?", subtitle: "Pick a city from the list — or let us surprise you.", icon: MapPin },
  { label: "Budget", title: "What's your nightly stay budget?", subtitle: "How much do you want to spend on a room each night.", icon: Wallet },
  { label: "Who", title: "Who's coming with you?", subtitle: "We'll shape the plan around the group.", icon: Users },
  { label: "Vibe", title: "What kind of trip?", subtitle: "Select everything you want in the days.", icon: Sparkles },
  { label: "Style", title: "How do you like to travel?", subtitle: "This sets the tone for stays and spend.", icon: Compass },
  { label: "Pace", title: "How full should each day feel?", subtitle: "We'll keep the itinerary in that range.", icon: Gauge },
  { label: "Notes", title: "Anything else we should know?", subtitle: "Diet, accessibility, must-sees — optional.", icon: NotebookPen },
] as const;

const LOADING_MESSAGES = [
  "Understanding your travel style...",
  "Finding the right neighborhoods...",
  "Building your itinerary...",
  "Balancing your budget...",
  "Putting your trip together...",
];

const initialInput: TripPlannerInput = {
  destination: "",
  destinationUnknown: false,
  destinationDescription: "",
  startDate: "",
  endDate: "",
  flexibleDates: false,
  budget: "$150–$250/night",
  travelers: "Couple",
  interests: [],
  travelStyle: "Comfortable",
  pace: "Balanced",
  additionalNotes: "",
};

export function TripPlanner() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [input, setInput] = useState<TripPlannerInput>(initialInput);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState("");
  const [customBudgetMode, setCustomBudgetMode] = useState(false);
  const [getawayTemplate, setGetawayTemplate] = useState<PreplannedGetaway | null>(null);
  const [surprisePickLabel, setSurprisePickLabel] = useState<string | null>(null);

  const clearSurprisePick = useCallback(() => {
    setSurprisePickLabel(null);
  }, []);

  const destinationSelected =
    !input.destinationUnknown &&
    input.destinationLatitude != null &&
    input.destinationLongitude != null;

  useEffect(() => {
    const getawayId = searchParams.get("getaway");
    if (getawayId) {
      const template = getPreplannedGetaway(getawayId);
      if (template) {
        setGetawayTemplate(template);
        setInput(getawayToPlannerInput(template));
        setCustomBudgetMode(false);
        setStep(1);
        track("planner_started", { source: "getaway", getaway: getawayId });
        return;
      }
    }

    setGetawayTemplate(null);
    const prefs = getUserPreferences();
    setInput((prev) => ({
      ...prev,
      budget: prefs.budgetPreference,
      travelStyle: prefs.travelStyle,
      pace: prefs.preferredPace,
      interests: prefs.favoriteActivities.length ? [...prefs.favoriteActivities] : prev.interests,
    }));

    const dest = searchParams.get("destination");
    if (dest) {
      setInput((prev) => ({ ...prev, destination: dest, destinationUnknown: false }));
      void resolvePrefillDestination(dest);
    }
    track("planner_started");
  }, [searchParams]);

  async function resolvePrefillDestination(dest: string) {
    try {
      const res = await fetch(`/api/places/suggest?q=${encodeURIComponent(dest)}`);
      const data = (await res.json()) as { suggestions?: DestinationSuggestion[] };
      const match =
        data.suggestions?.find((item) => item.city.toLowerCase() === dest.toLowerCase()) ??
        data.suggestions?.[0];
      if (!match) return;
      setInput((prev) => ({
        ...prev,
        destination: match.city,
        destinationCountry: match.country,
        destinationState: match.state,
        destinationLabel: match.label,
        destinationLatitude: match.latitude,
        destinationLongitude: match.longitude,
        destinationUnknown: false,
      }));
    } catch {
      // User can still pick from the dropdown.
    }
  }

  const update = useCallback(<K extends keyof TripPlannerInput>(key: K, value: TripPlannerInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
    setError("");
  }, []);

  const toggleInterest = (interest: string) => {
    setInput((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
    setError("");
  };

  const datesComplete = input.flexibleDates || (!!input.startDate && !!input.endDate);

  const handleRandomizeDestination = () => {
    const random = pickRandomPlannerDestination(input.destination);
    const label = random.destinationLabel ?? random.destination;
    setInput((prev) => ({
      ...prev,
      ...random,
      destinationState: undefined,
    }));
    setSurprisePickLabel(label);
    setError("");
    track("destination_randomized", { destination: random.destination });
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return datesComplete;
      case 2:
        return input.destinationUnknown
          ? !!input.destinationDescription?.trim()
          : destinationSelected;
      case 3:
        return customBudgetMode ? !!input.customBudget && input.customBudget > 0 : !!input.budget;
      case 4:
        return !!input.travelers;
      case 5:
        return input.interests.length > 0;
      case 6:
        return !!input.travelStyle;
      case 7:
        return !!input.pace;
      case 8:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceed()) {
      setError(getStepError(step));
      return;
    }
    track("planner_step_completed", { step });
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const getStepError = (s: number): string => {
    switch (s) {
      case 1: return "Select dates or choose flexible dates";
      case 2: return input.destinationUnknown ? "Describe the kind of trip you want" : "Pick a destination from the list so we search the right place";
      case 3: return "Select or enter your budget";
      case 5: return "Select at least one interest";
      default: return "Please complete this step";
    }
  };

  const handleSubmit = async () => {
    if (!canProceed()) {
      setError(getStepError(step));
      return;
    }

    setLoading(true);
    setError("");
    track("planner_completed");

    let msgIndex = 0;
    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[msgIndex]);
    }, 800);

    try {
      const payload = {
        ...input,
        budget: customBudgetMode ? "custom" : input.budget,
      };

      const res = await fetch("/api/plan-trip", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to generate trip");
      }

      const trip = await res.json();
      setActiveTrip(trip);
      track("trip_generated", { destination: trip.destination, duration: trip.duration });
      window.location.assign(`/trip/${encodeURIComponent(trip.id)}?fresh=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    } finally {
      clearInterval(msgInterval);
    }
  };

  const current = STEP_META[step - 1];
  const summaryChips = buildSummaryChips(input, {
    destinationSelected,
    customBudgetMode,
    upToStep: step,
  });

  const showRandomizer = step <= 2;
  const showSurprisePickLabel = showRandomizer && surprisePickLabel != null;

  if (loading) {
    return (
      <PlannerShell>
        <div className="flex min-h-[32rem] flex-col items-center justify-center px-6 py-20 text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 rounded-full bg-primary-glow blur-2xl opacity-60" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-border/80 bg-surface/90 shadow-sm">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          </div>
          <p className="eyebrow mb-3">Building your trip</p>
          <p className="text-xl font-semibold tracking-tight animate-pulse-soft sm:text-2xl">{loadingMessage}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            This usually takes a few seconds — we&apos;re matching places to your dates and vibe.
          </p>
          <div className="mt-8 flex gap-2">
            {LOADING_MESSAGES.map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors duration-300",
                  loadingMessage === LOADING_MESSAGES[index] ? "bg-primary" : "bg-surface-hover"
                )}
              />
            ))}
          </div>
        </div>
      </PlannerShell>
    );
  }

  const StepIcon = current.icon;
  const tripDurationDays =
    input.startDate && input.endDate ? countTripDays(input.startDate, input.endDate) : null;

  return (
    <PlannerShell>
      <div className="border-b border-border/60 bg-surface/30 px-5 py-5 sm:px-8 sm:py-6 lg:px-10">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Plan a trip</p>
            <p className="mt-1 text-sm text-foreground-secondary">
              Step {step} of {TOTAL_STEPS} · {current.label}
            </p>
          </div>
          <div className="flex h-11 min-w-11 items-center justify-center rounded-full border border-border/70 bg-background/70 px-3 text-sm font-semibold tabular-nums text-primary shadow-sm">
            {Math.round((step / TOTAL_STEPS) * 100)}%
          </div>
        </div>

        <ol className="flex items-center gap-1 sm:gap-1.5" aria-label="Planner progress">
          {STEP_META.map((item, index) => {
            const stepNumber = index + 1;
            const complete = stepNumber < step;
            const active = stepNumber === step;
            const prefilledAhead = getawayTemplate != null && stepNumber >= 3 && !complete && !active;
            return (
              <li key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <span
                  className={cn(
                    "h-1.5 w-full rounded-full transition-all duration-500",
                    complete || active
                      ? "bg-primary shadow-[0_0_12px_-2px_rgba(169,149,214,0.55)]"
                      : prefilledAhead
                        ? "bg-accent/70"
                        : "bg-surface-hover"
                  )}
                />
                <span
                  className={cn(
                    "hidden text-[10px] font-medium tracking-[0.08em] uppercase lg:block",
                    active
                      ? "text-primary"
                      : complete
                        ? "text-foreground-secondary"
                        : prefilledAhead
                          ? "text-accent-text"
                          : "text-muted"
                  )}
                >
                  {item.label}
                </span>
              </li>
            );
          })}
        </ol>

        {getawayTemplate ? (
          <div className="mt-5 overflow-hidden rounded-xl border border-accent/35 bg-gradient-to-r from-accent-subtle/40 to-background/40">
            <div className="flex gap-3 px-4 py-3.5 sm:px-5">
              <span className="mt-0.5 h-full w-1 shrink-0 rounded-full bg-accent/80" aria-hidden />
              <p className="text-sm leading-relaxed text-foreground-secondary">
                Starting from <span className="font-semibold text-foreground">{getawayTemplate.title}</span> in{" "}
                {getawayTemplate.destination}. Pick your dates below — budget, vibe, and pace are prefilled but you can
                change anything as you go.
              </p>
            </div>
          </div>
        ) : null}

        {summaryChips.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {summaryChips.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[11px] font-medium text-foreground-secondary shadow-sm backdrop-blur-sm"
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div key={step} className="animate-slide-up px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-primary shadow-sm">
            <StepIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary font-sub">
              {current.label}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight leading-[1.12] sm:text-[1.85rem]">
              {current.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-secondary sm:text-[15px]">
              {current.subtitle}
            </p>
          </div>
        </div>

        {getawayTemplate && step >= 3 ? (
          <p className="-mt-4 mb-6 inline-flex rounded-full border border-accent/30 bg-accent-subtle/25 px-3 py-1 text-xs font-medium text-accent-text">
            Prefilled from {getawayTemplate.title} — tap another option anytime to change it.
          </p>
        ) : null}

        <div className="rounded-2xl border border-border/60 bg-background/35 p-4 shadow-sm sm:p-5 lg:p-6">
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DateField
                label="Start"
                value={input.startDate}
                onChange={(value) => update("startDate", value)}
                disabled={input.flexibleDates}
              />
              <DateField
                label="End"
                value={input.endDate}
                min={input.startDate}
                onChange={(value) => update("endDate", value)}
                disabled={input.flexibleDates}
              />
            </div>
            {tripDurationDays != null && !input.flexibleDates ? (
              <p className="inline-flex items-center rounded-full border border-border/60 bg-surface/50 px-3 py-1 text-xs font-medium text-foreground-secondary">
                {tripDurationDays} day{tripDurationDays === 1 ? "" : "s"} selected
              </p>
            ) : null}
            <OptionCard
              selected={input.flexibleDates}
              onClick={() => update("flexibleDates", !input.flexibleDates)}
              icon={CalendarDays}
              label="I'm flexible on dates"
              hint="We'll plan around a typical trip length"
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {!input.destinationUnknown ? (
              <>
                <DestinationPicker
                  value={input.destination}
                  selected={destinationSelected}
                  selectedLabel={input.destinationLabel}
                  autoFocus
                  onQueryChange={(value) => {
                    clearSurprisePick();
                    setInput((prev) => ({
                      ...prev,
                      destination: value,
                      destinationCountry: undefined,
                      destinationState: undefined,
                      destinationLabel: undefined,
                      destinationLatitude: undefined,
                      destinationLongitude: undefined,
                    }));
                    setError("");
                  }}
                  onSelect={(suggestion) => {
                    clearSurprisePick();
                    setInput((prev) => ({
                      ...prev,
                      destination: suggestion.city,
                      destinationCountry: suggestion.country,
                      destinationState: suggestion.state,
                      destinationLabel: suggestion.label,
                      destinationLatitude: suggestion.latitude,
                      destinationLongitude: suggestion.longitude,
                      destinationUnknown: false,
                    }));
                    setError("");
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    clearSurprisePick();
                    setInput((prev) => ({
                        ...prev,
                        destinationUnknown: true,
                        destinationCountry: undefined,
                        destinationState: undefined,
                        destinationLabel: undefined,
                        destinationLatitude: undefined,
                        destinationLongitude: undefined,
                      }));
                      setError("");
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-3.5 py-2 text-sm font-medium text-primary transition-colors hover:border-border-accent hover:bg-primary-muted/40 hover:text-primary-hover"
                  >
                    <Compass className="h-3.5 w-3.5" />
                    I don&apos;t know yet — help me decide
                  </button>
              </>
            ) : (
              <>
                <Textarea
                  placeholder="Somewhere affordable in Europe with nightlife and good food..."
                  value={input.destinationDescription}
                  onChange={(e) => update("destinationDescription", e.target.value)}
                  className="min-h-[132px] rounded-xl border-border/70 bg-background/70"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => update("destinationUnknown", false)}
                  className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-3.5 py-2 text-sm font-medium text-primary transition-colors hover:border-border-accent hover:bg-primary-muted/40 hover:text-primary-hover"
                >
                  I know where I want to go
                </button>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {BUDGET_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt}
                  selected={!customBudgetMode && input.budget === opt}
                  onClick={() => {
                    setCustomBudgetMode(false);
                    update("budget", opt);
                  }}
                  label={opt}
                  compact
                  className="justify-center py-3.5 [&>span]:flex-none"
                />
              ))}
            </div>
            <OptionCard
              selected={customBudgetMode}
              onClick={() => setCustomBudgetMode(true)}
              icon={Wallet}
              label="Custom nightly rate"
              hint="Enter a price per night in USD"
            />
            {customBudgetMode && (
              <div className="rounded-xl border border-border/60 bg-surface/40 px-4 py-3.5">
                <label className="mb-1.5 block text-xs font-medium text-muted">Price per night (USD)</label>
                <Input
                  type="number"
                  placeholder="e.g. 1500"
                  value={input.customBudget ?? ""}
                  onChange={(e) => update("customBudget", parseInt(e.target.value) || undefined)}
                  autoFocus
                />
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {TRAVELER_OPTIONS.map((opt) => (
              <OptionCard
                key={opt}
                selected={input.travelers === opt}
                onClick={() => update("travelers", opt)}
                icon={TRAVELER_META[opt].icon}
                label={opt}
                hint={TRAVELER_META[opt].hint}
              />
            ))}
          </div>
        )}

        {step === 5 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {INTEREST_OPTIONS.map((opt) => (
              <OptionCard
                key={opt}
                selected={input.interests.includes(opt)}
                onClick={() => toggleInterest(opt)}
                icon={INTEREST_META[opt]}
                label={opt}
                compact
              />
            ))}
          </div>
        )}

        {step === 6 && (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {TRAVEL_STYLE_OPTIONS.map((opt) => (
              <OptionCard
                key={opt}
                selected={input.travelStyle === opt}
                onClick={() => update("travelStyle", opt)}
                icon={STYLE_META[opt].icon}
                label={opt}
                hint={STYLE_META[opt].hint}
              />
            ))}
          </div>
        )}

        {step === 7 && (
          <div className="grid grid-cols-1 gap-2.5">
            {PACE_OPTIONS.map((opt) => (
              <OptionCard
                key={opt}
                selected={input.pace === opt}
                onClick={() => update("pace", opt)}
                icon={PACE_META[opt].icon}
                label={opt}
                hint={PACE_META[opt].hint}
              />
            ))}
          </div>
        )}

        {step === 8 && (
          <Textarea
            placeholder="Traveling with two friends. We want nightlife and the historic parts of the city, and we'd rather not spend more than $120 a night."
            value={input.additionalNotes}
            onChange={(e) => update("additionalNotes", e.target.value)}
            className="min-h-[160px] rounded-xl border-border/70 bg-background/70"
          />
        )}
        </div>
      </div>

      {error && (
        <div className="mx-5 sm:mx-8 lg:mx-10">
          <p className="rounded-xl border border-red-900/35 bg-red-950/10 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </p>
        </div>
      )}

      <div className="border-t border-border/60 bg-surface/25 px-5 py-5 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 1}
              className={cn("self-start px-3 sm:self-auto", step === 1 && "hidden")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {showRandomizer ? (
              <div className="min-w-0 max-w-md">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!datesComplete}
                  onClick={handleRandomizeDestination}
                  className={cn(
                    "h-10 min-w-[8.5rem] shrink-0 justify-center px-5 text-left sm:text-center",
                    showSurprisePickLabel && "max-w-full whitespace-normal leading-snug"
                  )}
                >
                  {showSurprisePickLabel ? (
                    <>Surprise Pick: {surprisePickLabel}</>
                  ) : (
                    <>
                      <Shuffle className="h-4 w-4 shrink-0" />
                      Pick a Random Destination
                    </>
                  )}
                </Button>
                <p className="mt-2 max-w-sm text-[11px] leading-snug text-muted">
                  {!datesComplete
                    ? "Set your dates first, then we'll pick a destination for you."
                    : "Not sure where to go? We'll pick a destination for you."}
                </p>
              </div>
            ) : null}
          </div>

          {step < TOTAL_STEPS ? (
            <Button onClick={handleNext} className="min-w-[8.5rem] shrink-0 self-end shadow-[0_0_24px_-6px_rgba(169,149,214,0.45)]">
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} className="min-w-[8.5rem] shrink-0 self-end shadow-[0_0_24px_-6px_rgba(169,149,214,0.45)]">
              Build my trip
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </PlannerShell>
  );
}

function PlannerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:max-w-4xl">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-6 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-primary-glow/90 blur-3xl"
      />
      <div className="hero-glass relative overflow-hidden rounded-2xl border-border/70 shadow-[0_24px_80px_-40px_rgba(42,36,28,0.35)]">
        {children}
      </div>
    </div>
  );
}

function DateField({
  label,
  value,
  min,
  disabled,
  onChange,
}: {
  label: string;
  value?: string;
  min?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className={cn(
        "group block rounded-xl border px-4 py-3.5 transition-all duration-200",
        disabled
          ? "border-border/40 bg-surface/30 opacity-60"
          : value
            ? "border-border-accent bg-primary-muted/20 shadow-[0_0_0_1px_rgba(169,149,214,0.12)]"
            : "border-border/60 bg-background/60 hover:border-border hover:bg-background/80"
      )}
    >
      <span className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
        <CalendarDays className="h-3.5 w-3.5" />
        {label}
      </span>
      <Input
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-10 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
      />
    </label>
  );
}

function buildSummaryChips(
  input: TripPlannerInput,
  options: { destinationSelected: boolean; customBudgetMode: boolean; upToStep: number }
): string[] {
  const chips: string[] = [];
  if (options.upToStep > 1) {
    chips.push(
      input.flexibleDates
        ? "Flexible dates"
        : input.startDate && input.endDate
          ? `${formatChipDate(input.startDate)} – ${formatChipDate(input.endDate)}`
          : ""
    );
  }
  if (options.upToStep > 2) {
    if (input.destinationUnknown && input.destinationDescription?.trim()) chips.push("Help me decide");
    else if (options.destinationSelected) chips.push(input.destination);
  }
  if (options.upToStep > 3) {
    chips.push(
      options.customBudgetMode && input.customBudget
        ? `$${input.customBudget.toLocaleString()}/night`
        : input.budget
    );
  }
  if (options.upToStep > 4 && input.travelers) chips.push(input.travelers);
  if (options.upToStep > 5 && input.interests.length) {
    chips.push(input.interests.length === 1 ? input.interests[0] : `${input.interests.length} interests`);
  }
  if (options.upToStep > 6 && input.travelStyle) chips.push(input.travelStyle);
  if (options.upToStep > 7 && input.pace) chips.push(input.pace);
  return chips.filter(Boolean);
}

function formatChipDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function countTripDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}
