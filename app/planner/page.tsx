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
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <Suspense fallback={<PlannerFallback />}>
        <TripPlanner />
      </Suspense>
    </div>
  );
}
