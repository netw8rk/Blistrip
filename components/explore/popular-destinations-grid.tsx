"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { destinations } from "@/lib/destinations";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const GRID_FADE =
  "linear-gradient(to top, var(--color-background) 0%, rgba(244,240,231,0.96) 40%, transparent 100%)";

const INITIAL_VISIBLE = 8;

export function PopularDestinationsGrid() {
  const [showAll, setShowAll] = useState(false);
  const hasMore = destinations.length > INITIAL_VISIBLE;

  return (
    <>
      <div className="relative">
        <div
          className={cn(
            "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4",
            !showAll &&
              hasMore &&
              "max-h-[26rem] overflow-hidden sm:max-h-[28rem] lg:max-h-[24rem] xl:max-h-[22rem]"
          )}
        >
          {destinations.map((dest) => (
            <article
              key={dest.id}
              className="group relative isolate overflow-hidden rounded-[var(--radius-card)] border border-border/70"
            >
              <Link
                href={`/planner?destination=${encodeURIComponent(dest.name)}`}
                onClick={() => track("destination_clicked", { destination: dest.name })}
                className="block"
              >
                <div className="relative aspect-[11/10]">
                  <Image
                    src={dest.imageUrl}
                    alt={`${dest.name}, ${dest.country}`}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    quality={85}
                  />
                  <Badge variant="secondary" className="absolute left-2 top-2 z-10 bg-background/90 text-xs">
                    {dest.country}
                  </Badge>
                  <div
                    className="absolute inset-x-0 bottom-0 z-10 px-3 pb-3 pt-10"
                    style={{
                      background:
                        "linear-gradient(to top, #f4f0e7 0%, #f4f0e7 42%, rgba(244,240,231,0.92) 62%, rgba(244,240,231,0.4) 82%, transparent 100%)",
                    }}
                  >
                    <h3 className="line-clamp-1 text-[15px] font-semibold leading-5 text-foreground">{dest.name}</h3>
                    <p className="mt-0.5 line-clamp-1 text-xs leading-4 text-foreground-secondary">
                      {dest.description}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{dest.typicalBudget}</p>
                      <span className="text-xs font-medium text-primary group-hover:text-primary-hover">
                        Plan this trip
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>

        {!showAll && hasMore && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24" style={{ background: GRID_FADE }} />
        )}
      </div>

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => setShowAll((value) => !value)}>
            {showAll ? "Show less" : "See more"}
          </Button>
        </div>
      )}
    </>
  );
}
