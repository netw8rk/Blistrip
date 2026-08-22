"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { popularDestinations, getPopularDestinationImage } from "@/lib/images";
import { cn } from "@/lib/utils";

export function DestinationCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);

    const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-carousel-item]"));
    if (cards.length === 0) return;

    const center = scrollLeft + clientWidth / 2;
    let closest = 0;
    let minDist = Infinity;
    cards.forEach((card, i) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(center - cardCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    setActiveIndex(closest);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-carousel-item]");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: direction === "left" ? -step : step, behavior: "smooth" });
  };

  const scrollToIndex = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelectorAll<HTMLElement>("[data-carousel-item]")[index];
    if (!card) return;
    el.scrollTo({ left: card.offsetLeft - 16, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* Edge fades */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-surface to-transparent transition-opacity",
          !canScrollLeft && "opacity-0"
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-surface to-transparent transition-opacity",
          !canScrollRight && "opacity-0"
        )}
      />

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {popularDestinations.map((dest) => (
          <Link
            key={dest.name}
            href={`/planner?destination=${encodeURIComponent(dest.name)}`}
            data-carousel-item
            className="snap-start shrink-0 w-[72vw] sm:w-[44vw] md:w-[32vw] lg:w-[calc(20%-13px)] max-w-[280px]"
          >
            <div className="relative h-52 rounded-xl overflow-hidden group cursor-pointer border border-border hover:border-border/80 transition-colors">
              <Image
                src={getPopularDestinationImage(dest.photoId)}
                alt={dest.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 72vw, (max-width: 1024px) 44vw, 280px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <p className="text-[16px] font-semibold text-white leading-snug drop-shadow-sm">{dest.name}</p>
                <p className="text-[12px] text-white/75 mt-0.5">{dest.country}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          {popularDestinations.map((dest, i) => (
            <button
              key={dest.name}
              type="button"
              aria-label={`Go to ${dest.name}`}
              onClick={() => scrollToIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === activeIndex ? "w-6 bg-foreground/70" : "w-1.5 bg-border hover:bg-muted"
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous destinations"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background transition-colors",
              canScrollLeft
                ? "hover:bg-surface-hover text-foreground"
                : "opacity-40 cursor-not-allowed text-muted"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next destinations"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background transition-colors",
              canScrollRight
                ? "hover:bg-surface-hover text-foreground"
                : "opacity-40 cursor-not-allowed text-muted"
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
