"use client";

import { useState } from "react";
import { Loader2, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { setActiveTrip } from "@/lib/storage";
import type { TripPlan } from "@/types/trip";

interface TripRefinePanelProps {
  trip: TripPlan;
  onUpdate: (trip: TripPlan) => void;
}

export function TripRefinePanel({ trip, onUpdate }: TripRefinePanelProps) {
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

  return (
    <section className="py-10 border-t border-border section-raised">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Refine your trip</h2>
          </div>
          <p className="text-sm text-foreground-secondary mb-4">
            Ask for changes — move activities, adjust budget, or update preferences. Your planner remembers the context.
          </p>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='e.g. "Move Prague Castle to day 3" or "I hate museums" or "Make this cheaper"'
            rows={2}
            className="mb-3 resize-none"
          />
          <div className="flex items-center justify-between gap-3">
            <Button onClick={handleRefine} disabled={loading || !message.trim()} size="sm">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? "Updating..." : "Update Trip"}
            </Button>
            {feedback && (
              <p className="text-xs text-foreground-secondary flex-1 text-right">{feedback}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
