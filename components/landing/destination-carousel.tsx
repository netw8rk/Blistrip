"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { popularDestinations, getPopularDestinationImage, type PopularDestination } from "@/lib/images";
import { googleHeroPhotoSrc, isGooglePhotoSrc } from "@/lib/travel/google-links";
import { cn } from "@/lib/utils";

function DestinationCarouselCard({ dest }: { dest: PopularDestination }) {
  const fallback = getPopularDestinationImage(dest.photoId);
  const [photoSrc, setPhotoSrc] = useState(fallback);

  useEffect(() => {
    setPhotoSrc(fallback);

    const params = new URLSearchParams({
      city: dest.name,
      country: dest.country,
      lat: String(dest.latitude),
      lng: String(dest.longitude),
    });

    fetch(`/api/places/destination-photo?${params}`)
      .then((res) => res.json() as Promise<{ photoUrl?: string | null }>)
      .then((data) => {
        if (data.photoUrl) {
          setPhotoSrc(googleHeroPhotoSrc(data.photoUrl, 560) ?? fallback);
        }
      })
      .catch(() => {});
  }, [dest.country, dest.latitude, dest.longitude, dest.name, dest.photoId]);

  return (
    <Link
      href={`/planner?destination=${encodeURIComponent(dest.name)}`}
      data-carousel-item
      className="snap-start shrink-0 w-[72vw] sm:w-[44vw] md:w-[32vw] lg:w-[calc(20%-13px)] max-w-[280px]"
    >
      <div className="relative h-52 rounded-xl overflow-hidden group cursor-pointer border border-border hover:border-border/80 transition-colors">
        <Image
          src={photoSrc}
          alt={dest.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 72vw, (max-width: 1024px) 44vw, 280px"
          unoptimized={isGooglePhotoSrc(photoSrc)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-[16px] font-semibold text-white leading-snug drop-shadow-sm">{dest.name}</p>
          <p className="text-[12px] text-white/75 mt-0.5">{dest.country}</p>
        </div>
      </div>
    </Link>
  );
}

export function DestinationCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateScrollState = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft((prev) => (scrollLeft > 12 ? true : scrollLeft < 2 ? false : prev));
      setCanScrollRight((prev) =>
        scrollLeft < scrollWidth - clientWidth - 12
          ? true
          : scrollLeft > scrollWidth - clientWidth - 2
            ? false
            : prev
      );

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
    };

    const onScroll = () => {
      if (scrollFrameRef.current != null) return;
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        updateScrollState();
      });
    };

    updateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateScrollState);
      if (scrollFrameRef.current != null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

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
      <div
        ref={scrollRef}
        className={cn(
          "flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 -mx-1 px-1",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "[mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)]",
          "[-webkit-mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)]"
        )}
      >
        {popularDestinations.map((dest) => (
          <DestinationCarouselCard key={dest.name} dest={dest} />
        ))}
      </div>

      <div className="mt-5 flex items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {popularDestinations.map((dest, i) => (
            <button
              key={dest.name}
              type="button"
              aria-label={`Go to ${dest.name}`}
              onClick={() => scrollToIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === activeIndex ? "w-6 bg-accent-text/70" : "w-1.5 bg-border hover:bg-muted"
              )}
            />
          ))}
        </div>

        <div
          className={cn(
            "inline-flex shrink-0 overflow-hidden rounded-full border border-primary/35",
            "bg-surface/85 shadow-[0_0_16px_-6px_rgba(169,149,214,0.4)] backdrop-blur-sm",
            "mr-6 sm:mr-10 lg:mr-14"
          )}
        >
          <button
            type="button"
            aria-label="Previous destinations"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className={cn(
              "flex h-9 w-11 items-center justify-center border-r border-primary/25 transition-colors",
              canScrollLeft
                ? "text-foreground hover:bg-primary-muted/60"
                : "cursor-not-allowed text-muted/50"
            )}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            aria-label="Next destinations"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className={cn(
              "flex h-9 w-11 items-center justify-center transition-colors",
              canScrollRight
                ? "bg-accent-subtle/50 text-accent-text hover:bg-accent-muted/70"
                : "cursor-not-allowed text-muted/50"
            )}
          >
            <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </div>
  );
}
