"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PopularDestinationsGrid } from "@/components/explore/popular-destinations-grid";
import { PreplannedGetawaysSection } from "@/components/explore/preplanned-getaways-section";

export default function ExplorePage() {
  return (
    <div>
      <div className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow mb-3">Explore</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl leading-[1.15]">
              Find your next trip
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-foreground-secondary sm:text-[16px]">
              Browse destinations or start from a pre-planned getaway.
            </p>
          </div>
          <Link href="/planner" className="subcontainer-link flex shrink-0 items-center gap-1">
            Plan a trip <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mb-4">
          <h2 className="section-title">Popular destinations</h2>
          <p className="mt-2 max-w-xl text-sm text-foreground-secondary">
            Pick a city and jump straight into the planner.
          </p>
        </div>
        <PopularDestinationsGrid />
      </div>

      <section className="section-raised border-t border-border py-14 sm:py-16">
        <PreplannedGetawaysSection />
      </section>
    </div>
  );
}
