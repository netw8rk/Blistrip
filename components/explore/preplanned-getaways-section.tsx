"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { preplannedGetaways } from "@/lib/preplanned-getaways";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export function PreplannedGetawaysSection() {
  return (
    <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-2xl lg:mb-10">
        <p className="eyebrow mb-3">Ready-made routes</p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl leading-[1.15]">
          Pre-planned getaways
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground-secondary sm:text-[16px]">
          Start from a curated trip shape — destination, vibe, and pace are prefilled. You&apos;ll land on dates first,
          then can change anything.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {preplannedGetaways.map((getaway) => (
          <article
            key={getaway.id}
            className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-background/40"
          >
            <div className="grid md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
              <div className="relative min-h-[12rem] md:min-h-full">
                <Image
                  src={getaway.imageUrl}
                  alt={`${getaway.destination}, ${getaway.country}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 208px"
                />
                <Badge variant="accent" className="absolute left-3 top-3 z-10 bg-background/90 text-xs">
                  {getaway.category}
                </Badge>
              </div>

              <div className="flex min-w-0 flex-col px-5 py-5 sm:px-6 sm:py-6">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
                  {getaway.destination} · {getaway.durationDays} days
                </p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{getaway.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">{getaway.tagline}</p>

                <div className="mt-4 grid gap-2">
                  {getaway.dayHighlights.map((day) => (
                    <div
                      key={`${getaway.id}-${day.day}`}
                      className={cn(
                        "rounded-lg border border-border/70 bg-surface/50 px-3.5 py-3",
                        "sm:grid sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:items-start sm:gap-3"
                      )}
                    >
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-destination font-sub">
                        Day {day.day}
                      </p>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug text-foreground">{day.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-foreground-secondary">{day.note}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {getaway.interests.slice(0, 4).map((interest) => (
                    <span
                      key={interest}
                      className="inline-flex rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-foreground-secondary"
                    >
                      {interest}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border/70 pt-4">
                  <Link
                    href={`/planner?getaway=${encodeURIComponent(getaway.id)}`}
                    onClick={() => track("getaway_started", { id: getaway.id, destination: getaway.destination })}
                  >
                    <Button size="sm">
                      Start from here
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <p className="text-xs text-muted">
                    {getaway.travelStyle} · {getaway.travelers} · {getaway.pace}
                  </p>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
