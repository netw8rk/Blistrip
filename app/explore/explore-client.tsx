"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { destinations } from "@/lib/destinations";
import { track } from "@/lib/analytics";

export default function ExplorePage() {
  const handleDestinationClick = (name: string) => {
    track("destination_clicked", { destination: name });
  };

  return (
    <div className="mx-auto max-w-[84rem] px-4 py-10 sm:py-16 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-foreground font-sub sm:text-[13px]">
            Explore
          </p>
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

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {destinations.map((dest) => (
          <article
            key={dest.id}
            className="group relative overflow-hidden rounded-[var(--radius-card)] min-h-[26rem] isolate"
          >
            <Image
              src={dest.imageUrl}
              alt={`${dest.name}, ${dest.country}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, #ffffff 0%, #ffffff 22%, rgba(255,255,255,0.92) 38%, rgba(255,255,255,0.55) 55%, rgba(255,255,255,0) 78%)",
              }}
            />
            <Badge variant="secondary" className="absolute top-3 left-3 z-10 bg-white/90 text-sm">
              {dest.country}
            </Badge>
            <div className="absolute inset-x-0 bottom-0 z-10 p-4">
              <h3 className="text-lg font-semibold leading-6 text-[#252329]">{dest.name}</h3>
              <p className="mt-1 text-sm leading-5 text-[#4a4750] line-clamp-2">{dest.description}</p>
              <p className="mt-1.5 text-sm font-medium text-[#252329]">{dest.typicalBudget}</p>
              <div className="mt-3">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="bg-transparent tracking-[0.06em] shadow-none hover:bg-transparent"
                >
                  <Link
                    href={`/planner?destination=${encodeURIComponent(dest.name)}`}
                    onClick={() => handleDestinationClick(dest.name)}
                  >
                    Plan this trip
                  </Link>
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
