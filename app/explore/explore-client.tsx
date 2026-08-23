"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { destinations } from "@/lib/destinations";
import { track } from "@/lib/analytics";

export default function ExplorePage() {
  const handleDestinationClick = (name: string) => {
    track("destination_clicked", { destination: name });
  };

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-10 sm:py-16 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-3">Explore</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl leading-[1.15]">
            Popular destinations
          </h1>
          <p className="mt-3 max-w-xl text-sm text-foreground-secondary leading-relaxed sm:text-[16px]">
            Pick a place to start — or tell us the trip you have in mind.
          </p>
        </div>
        <Link href="/planner" className="subcontainer-link flex items-center gap-1 shrink-0">
          Plan a trip <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {destinations.map((dest) => (
          <article
            key={dest.id}
            className="group relative overflow-hidden rounded-[var(--radius-card)] border border-border/70 isolate"
          >
            <Link
              href={`/planner?destination=${encodeURIComponent(dest.name)}`}
              onClick={() => handleDestinationClick(dest.name)}
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
                <Badge variant="secondary" className="absolute top-2 left-2 z-10 bg-background/90 text-xs">
                  {dest.country}
                </Badge>
                <div
                  className="absolute inset-x-0 bottom-0 z-10 px-3 pb-3 pt-10"
                  style={{
                    background:
                      "linear-gradient(to top, #f4f0e7 0%, #f4f0e7 42%, rgba(244,240,231,0.92) 62%, rgba(244,240,231,0.4) 82%, transparent 100%)",
                  }}
                >
                  <h3 className="text-[15px] font-semibold leading-5 text-foreground line-clamp-1">{dest.name}</h3>
                  <p className="mt-0.5 text-xs leading-4 text-foreground-secondary line-clamp-1">{dest.description}</p>
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
    </div>
  );
}
