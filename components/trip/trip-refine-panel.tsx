"use client";

import { useState } from "react";
import { Loader2, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { setActiveTrip } from "@/lib/storage";
import type { TripPlan } from "@/types/trip";

interface TripRefinePanelProps {
  trip: TripPlan;
  onUpdate: (trip: TripPlan) => void;
  embedded?: boolean;
}

export function TripRefinePanel({ trip, onUpdate, embedded = false }: TripRefinePanelProps) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleRefine = async () => {
    if (!message.trim() || loading) return;

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/plan-trip/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripPlan: trip, message: message.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      const updated = data.tripPlan as TripPlan;
      onUpdate(updated);
      setActiveTrip(updated);
      setFeedback(data.changesSummary ?? "Trip updated.");
      setMessage("");
    } catch {
      setFeedback("Couldn't reach the planner. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const panel = (
    <Card
      className={cn(
        "h-full border-accent/35 bg-accent-subtle/30 p-4 sm:p-5",
        embedded && "shadow-sm"
      )}
    >
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.1em] text-destination font-sub sm:text-[13px]">
        Refine
      </p>
      <div className="mb-3 flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/45 bg-accent-muted">
          <MessageSquare className="h-3.5 w-3.5 text-accent-text" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-destination leading-snug">
            Refine your trip
          </h2>
          <p className="mt-0.5 text-sm leading-relaxed text-foreground-secondary">
            Move activities, adjust budget, or update preferences.
          </p>
        </div>
      </div>
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder='e.g. "Move Prague Castle to day 3" or "Make this cheaper"'
        rows={embedded ? 2 : 2}
        className="mb-3 resize-none border-accent/25 bg-background focus-visible:ring-accent/30"
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          onClick={handleRefine}
          disabled={loading || !message.trim()}
          size="sm"
          className="shrink-0 border border-accent/50 bg-accent text-accent-text shadow-none hover:bg-accent-hover"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading ? "Updating..." : "Update Trip"}
        </Button>
        {feedback && (
          <p className="text-xs leading-relaxed text-foreground-secondary sm:text-right">{feedback}</p>
        )}
      </div>
    </Card>
  );

  if (embedded) return panel;

  return (
    <section className="py-10 border-t border-border section-raised">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">{panel}</div>
    </section>
  );
}
