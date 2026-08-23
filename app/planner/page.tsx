import type { Metadata } from "next";
import { Suspense } from "react";
import { TripPlanner } from "@/components/planner/trip-planner";
import { PlannerFallback } from "@/components/planner/planner-fallback";

export const metadata: Metadata = {
  title: "Plan Your Trip",
  description: "Build a personalized travel plan based on your budget, interests, and travel style.",
};

export default function PlannerPage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary-glow/80 to-transparent"
      />
      <Suspense fallback={<PlannerFallback />}>
        <TripPlanner />
      </Suspense>
    </div>
  );
}
