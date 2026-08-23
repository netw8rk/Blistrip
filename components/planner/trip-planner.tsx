"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Compass,
  Loader2,
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
import { DestinationPicker } from "@/components/planner/destination-picker";
import type { DestinationSuggestion } from "@/lib/travel/suggest-places";

const TOTAL_STEPS = 8;

const STEP_META = [
  { label: "Place", title: "Where are you going?", subtitle: "Pick a city from the list so we search the right place." },
  { label: "Dates", title: "When are you going?", subtitle: "Set your dates, or keep them open." },
  { label: "Budget", title: "What's your nightly stay budget?", subtitle: "How much do you want to spend on a room each night." },
  { label: "Who", title: "Who's coming with you?", subtitle: "We'll shape the plan around the group." },
  { label: "Vibe", title: "What kind of trip?", subtitle: "Select everything you want in the days." },
  { label: "Style", title: "How do you like to travel?", subtitle: "This sets the tone for stays and spend." },
  { label: "Pace", title: "How full should each day feel?", subtitle: "We'll keep the itinerary in that range." },
  { label: "Notes", title: "Anything else we should know?", subtitle: "Diet, accessibility, must-sees — optional." },
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
        setStep(2);
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

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return input.destinationUnknown
          ? !!input.destinationDescription?.trim()
          : destinationSelected;
      case 2:
        return input.flexibleDates || (!!input.startDate && !!input.endDate);
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
      case 1: return input.destinationUnknown ? "Describe the kind of trip you want" : "Pick a destination from the list so we search the right place";
      case 2: return "Select dates or choose flexible dates";
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

  if (loading) {
    return (
      <PlannerShell>
        <div className="flex min-h-[28rem] flex-col items-center justify-center px-6 py-16 text-center">
          <div className="relative mb-8">
            <div className="h-16 w-16 rounded-full border border-border bg-background/70" />
            <Loader2 className="absolute inset-0 m-auto h-7 w-7 text-primary animate-spin" />
          </div>
          <p className="eyebrow mb-3">Building your trip</p>
          <p className="text-xl font-semibold tracking-tight animate-pulse-soft">{loadingMessage}</p>
          <p className="mt-2 text-sm text-muted">This usually takes a few seconds</p>
        </div>
      </PlannerShell>
    );
  }

  return (
    <PlannerShell>
      <div className="border-b border-border/70 px-5 py-5 sm:px-8 lg:px-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="eyebrow">Plan a trip</p>
          <p className="text-xs font-medium tabular-nums text-muted">
            {step} / {TOTAL_STEPS}
          </p>
        </div>
        <ol className="flex items-center gap-1.5" aria-label="Planner progress">
          {STEP_META.map((item, index) => {
            const stepNumber = index + 1;
            const complete = stepNumber < step;
            const active = stepNumber === step;
            const prefilledAhead = getawayTemplate != null && stepNumber >= 3 && !complete && !active;
            return (
              <li key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "h-1 w-full rounded-full transition-colors duration-300",
                    complete || active
                      ? "bg-primary"
                      : prefilledAhead
                        ? "bg-accent/75"
                        : "bg-surface-hover"
                  )}
                />
                <span
                  className={cn(
                    "hidden text-[10px] font-medium tracking-[0.06em] uppercase sm:block",
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
          <div className="mt-4 rounded-xl border border-accent/40 bg-accent-subtle/30 px-3.5 py-3 text-sm leading-relaxed text-foreground-secondary">
            Starting from <span className="font-semibold text-foreground">{getawayTemplate.title}</span> in{" "}
            {getawayTemplate.destination}. Pick your dates below — budget, vibe, and pace are prefilled but you can
            change anything as you go.
          </div>
        ) : null}
        {summaryChips.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {summaryChips.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-foreground-secondary"
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div key={step} className="animate-slide-up px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <h2 className="text-2xl font-semibold tracking-tight leading-[1.15] sm:text-[1.75rem]">{current.title}</h2>
        <p className="mt-2 mb-8 max-w-2xl text-sm leading-relaxed text-foreground-secondary sm:text-[15px]">
          {current.subtitle}
        </p>
        {getawayTemplate && step >= 3 ? (
          <p className="-mt-6 mb-8 text-xs font-medium text-accent-text">
            Prefilled from {getawayTemplate.title} — tap another option anytime to change it.
          </p>
        ) : null}

        {step === 1 && (
          <div className="space-y-4">
            {!input.destinationUnknown ? (
              <>
                <DestinationPicker
                  value={input.destination}
                  selected={destinationSelected}
                  selectedLabel={input.destinationLabel}
                  autoFocus
                  onQueryChange={(value) => {
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
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
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
                  className="min-h-[120px]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => update("destinationUnknown", false)}
                  className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
                >
                  I know where I want to go
                </button>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
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
            <OptionCard
              selected={input.flexibleDates}
              onClick={() => update("flexibleDates", !input.flexibleDates)}
              icon={CalendarDays}
              label="I'm flexible on dates"
              hint="We'll plan around a typical trip length"
            />
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
              <div className="rounded-xl border border-border/70 bg-background/50 px-3.5 py-3">
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
            className="min-h-[148px]"
          />
        )}
      </div>

      {error && (
        <p className="mx-5 mb-1 rounded-xl border border-red-900/40 bg-red-950/10 px-4 py-3 text-sm text-red-700 sm:mx-8 lg:mx-10">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border/70 px-5 py-4 sm:px-8 lg:px-10">
        <Button
          variant="ghost"
          onClick={handleBack}
          disabled={step === 1}
          className={cn("px-3", step === 1 && "invisible")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {step < TOTAL_STEPS ? (
          <Button onClick={handleNext} className="min-w-[8.5rem]">
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} className="min-w-[8.5rem]">
            Build my trip
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </PlannerShell>
  );
}

function PlannerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-4 h-56 w-[36rem] -translate-x-1/2 rounded-full bg-primary-glow blur-3xl"
      />
      <div className="hero-glass relative overflow-hidden shadow-sm">{children}</div>
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
        "block rounded-xl border px-3.5 py-3 transition-colors",
        disabled ? "border-border/50 bg-surface/40 opacity-60" : "border-border/70 bg-background/60"
      )}
    >
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <Input
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
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
    if (input.destinationUnknown && input.destinationDescription?.trim()) chips.push("Help me decide");
    else if (options.destinationSelected) chips.push(input.destination);
  }
  if (options.upToStep > 2) {
    chips.push(
      input.flexibleDates
        ? "Flexible dates"
        : input.startDate && input.endDate
          ? `${formatChipDate(input.startDate)} – ${formatChipDate(input.endDate)}`
          : ""
    );
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
