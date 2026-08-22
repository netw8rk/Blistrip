"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { setActiveTrip } from "@/lib/storage";
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
  budget: "$1,000–$2,000",
  travelers: "Couple",
  interests: [],
  travelStyle: "Comfortable",
  pace: "Balanced",
  additionalNotes: "",
};

interface OptionButtonProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

function OptionButton({ selected, onClick, children, className }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-4 py-3 text-sm font-medium text-left transition-all duration-200",
        selected
          ? "border-border-accent bg-primary-muted text-primary"
          : "border-border bg-surface-elevated hover:border-border-accent hover:bg-surface-hover text-foreground-secondary",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TripPlanner() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [input, setInput] = useState<TripPlannerInput>(initialInput);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState("");
  const [customBudgetMode, setCustomBudgetMode] = useState(false);

  const destinationSelected =
    !input.destinationUnknown &&
    input.destinationLatitude != null &&
    input.destinationLongitude != null;

  useEffect(() => {
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

  const progress = (step / TOTAL_STEPS) * 100;

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center animate-fade-in">
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-2 border-border" />
              <Loader2 className="absolute inset-0 m-auto h-8 w-8 text-primary animate-spin" />
            </div>
          </div>
          <p className="eyebrow mb-3">Building Your Trip</p>
          <p className="text-xl font-semibold mb-2 animate-pulse-soft">{loadingMessage}</p>
          <p className="text-sm text-muted">This usually takes a few seconds</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="eyebrow">Trip Planner</p>
          <p className="text-sm text-muted font-medium">{step}/{TOTAL_STEPS}</p>
        </div>
        <Progress value={progress} />
      </div>

      <div key={step} className="animate-slide-up">
        {step === 1 && (
          <StepWrapper
            title="Where are you going?"
            subtitle="Type a city, then pick the matching place from the list so we search the right location."
          >
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
                  className="text-sm text-primary hover:text-primary-hover transition-colors mt-2"
                >
                  I don&apos;t know yet — help me decide
                </button>
              </>
            ) : (
              <>
                <Textarea
                  placeholder="I want somewhere affordable in Europe with nightlife and good food..."
                  value={input.destinationDescription}
                  onChange={(e) => update("destinationDescription", e.target.value)}
                  className="min-h-[100px]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => update("destinationUnknown", false)}
                  className="text-sm text-primary hover:text-primary-hover transition-colors mt-2"
                >
                  I know where I want to go
                </button>
              </>
            )}
          </StepWrapper>
        )}

        {step === 2 && (
          <StepWrapper title="When are you going?" subtitle="Select your travel dates or mark as flexible.">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted mb-1.5 block">Start date</label>
                <Input
                  type="date"
                  value={input.startDate}
                  onChange={(e) => update("startDate", e.target.value)}
                  disabled={input.flexibleDates}
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-1.5 block">End date</label>
                <Input
                  type="date"
                  value={input.endDate}
                  onChange={(e) => update("endDate", e.target.value)}
                  disabled={input.flexibleDates}
                />
              </div>
            </div>
            <OptionButton
              selected={input.flexibleDates}
              onClick={() => update("flexibleDates", !input.flexibleDates)}
              className="mt-2 w-full text-center"
            >
              I&apos;m flexible on dates
            </OptionButton>
          </StepWrapper>
        )}

        {step === 3 && (
          <StepWrapper title="What's your budget?" subtitle="Total trip budget including flights, accommodation, and activities.">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {BUDGET_OPTIONS.map((opt) => (
                <OptionButton
                  key={opt}
                  selected={!customBudgetMode && input.budget === opt}
                  onClick={() => { setCustomBudgetMode(false); update("budget", opt); }}
                >
                  {opt}
                </OptionButton>
              ))}
            </div>
            <OptionButton
              selected={customBudgetMode}
              onClick={() => setCustomBudgetMode(true)}
              className="w-full text-center"
            >
              Custom budget
            </OptionButton>
            {customBudgetMode && (
              <div className="mt-3">
                <label className="text-xs text-muted mb-1.5 block">Your budget (USD)</label>
                <Input
                  type="number"
                  placeholder="e.g. 1500"
                  value={input.customBudget ?? ""}
                  onChange={(e) => update("customBudget", parseInt(e.target.value) || undefined)}
                />
              </div>
            )}
          </StepWrapper>
        )}

        {step === 4 && (
          <StepWrapper title="Who are you traveling with?" subtitle="This helps us tailor recommendations.">
            <div className="grid grid-cols-2 gap-3">
              {TRAVELER_OPTIONS.map((opt) => (
                <OptionButton
                  key={opt}
                  selected={input.travelers === opt}
                  onClick={() => update("travelers", opt)}
                >
                  {opt}
                </OptionButton>
              ))}
            </div>
          </StepWrapper>
        )}

        {step === 5 && (
          <StepWrapper title="What kind of trip do you want?" subtitle="Select all that apply.">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {INTEREST_OPTIONS.map((opt) => (
                <OptionButton
                  key={opt}
                  selected={input.interests.includes(opt)}
                  onClick={() => toggleInterest(opt)}
                >
                  {opt}
                </OptionButton>
              ))}
            </div>
          </StepWrapper>
        )}

        {step === 6 && (
          <StepWrapper title="What's your travel style?" subtitle="How do you like to travel?">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TRAVEL_STYLE_OPTIONS.map((opt) => (
                <OptionButton
                  key={opt}
                  selected={input.travelStyle === opt}
                  onClick={() => update("travelStyle", opt)}
                >
                  {opt}
                </OptionButton>
              ))}
            </div>
          </StepWrapper>
        )}

        {step === 7 && (
          <StepWrapper title="How do you like to travel?" subtitle="Your preferred pace for each day.">
            <div className="grid grid-cols-1 gap-3">
              {PACE_OPTIONS.map((opt) => (
                <OptionButton
                  key={opt}
                  selected={input.pace === opt}
                  onClick={() => update("pace", opt)}
                >
                  {opt}
                </OptionButton>
              ))}
            </div>
          </StepWrapper>
        )}

        {step === 8 && (
          <StepWrapper
            title="Anything else we should know?"
            subtitle="Special requests, dietary needs, accessibility, or anything that helps us personalize your plan."
          >
            <Textarea
              placeholder="Traveling with two friends. We're 25 and want nightlife but also want to see the historical parts of the city. We don't want to spend more than $120/night."
              value={input.additionalNotes}
              onChange={(e) => update("additionalNotes", e.target.value)}
              className="min-h-[140px]"
            />
          </StepWrapper>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          onClick={handleBack}
          disabled={step === 1}
          className={step === 1 ? "invisible" : ""}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {step < TOTAL_STEPS ? (
          <Button onClick={handleNext}>
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit}>
            Build My Trip
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function StepWrapper({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-2xl sm:text-3xl font-bold mb-2">{title}</h2>
      <p className="text-foreground-secondary mb-8">{subtitle}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
