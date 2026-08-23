"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getHeroDestinationImage, shouldServePhotoDirectly } from "@/lib/images";
import { getCuratedDestinationHeroPhoto } from "@/lib/travel/curated-destination-photos";
import { googleHeroPhotoSrc, isGooglePhotoSrc } from "@/lib/travel/google-links";
import { cn } from "@/lib/utils";

type PhotoPhase = "loading" | "google" | "fallback";

export function useDestinationPhoto(options: {
  city: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  storedPhotoUrl?: string | null;
  width?: number;
}) {
  const width = options.width ?? 2400;
  const curated = useMemo(
    () => getCuratedDestinationHeroPhoto(options.city, width),
    [options.city, width]
  );
  const fallback = useMemo(
    () => curated ?? getHeroDestinationImage(options.city),
    [curated, options.city]
  );

  const [src, setSrc] = useState<string | null>(() => {
    if (curated) return curated;
    if (!options.storedPhotoUrl) return null;
    return googleHeroPhotoSrc(options.storedPhotoUrl, width) ?? null;
  });
  const [phase, setPhase] = useState<PhotoPhase>(() => {
    if (curated) return "fallback";
    return options.storedPhotoUrl ? "google" : "loading";
  });

  useEffect(() => {
    if (curated) {
      setSrc(curated);
      setPhase("fallback");
      return;
    }

    if (options.storedPhotoUrl) {
      const stored = googleHeroPhotoSrc(options.storedPhotoUrl, width);
      if (stored) {
        setSrc(stored);
        setPhase("google");
      }
      return;
    }

    if (options.latitude == null || options.longitude == null) {
      setSrc(fallback);
      setPhase("fallback");
      return;
    }

    let cancelled = false;
    setPhase("loading");
    setSrc(null);

    const params = new URLSearchParams({
      city: options.city,
      country: options.country ?? "",
      lat: String(options.latitude),
      lng: String(options.longitude),
    });

    fetch(`/api/places/destination-photo?${params}`)
      .then((res) => res.json() as Promise<{ photoUrl?: string | null }>)
      .then((data) => {
        if (cancelled) return;
        if (data.photoUrl) {
          setSrc(googleHeroPhotoSrc(data.photoUrl, width) ?? fallback);
          setPhase("google");
          return;
        }
        setSrc(fallback);
        setPhase("fallback");
      })
      .catch(() => {
        if (cancelled) return;
        setSrc(fallback);
        setPhase("fallback");
      });

    return () => {
      cancelled = true;
    };
  }, [
    options.city,
    options.country,
    options.latitude,
    options.longitude,
    options.storedPhotoUrl,
    width,
    fallback,
    curated,
  ]);

  return {
    src,
    phase,
    isGoogle: isGooglePhotoSrc(src ?? undefined),
    serveDirectly: shouldServePhotoDirectly(src ?? undefined),
  };
}

export function DestinationPhotoImage({
  city,
  country,
  latitude,
  longitude,
  storedPhotoUrl,
  width = 1600,
  alt,
  className,
  imageClassName,
  sizes,
  priority,
}: {
  city: string;
  country?: string;
  latitude: number;
  longitude: number;
  storedPhotoUrl?: string | null;
  width?: number;
  alt: string;
  className?: string;
  imageClassName?: string;
  sizes: string;
  priority?: boolean;
}) {
  const { src, phase, serveDirectly } = useDestinationPhoto({
    city,
    country,
    latitude,
    longitude,
    storedPhotoUrl,
    width,
  });

  return (
    <div className={cn("relative overflow-hidden bg-surface", className)}>
      {phase === "loading" ? (
        <div aria-hidden className="absolute inset-0 animate-pulse-soft bg-surface-hover" />
      ) : null}
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          quality={95}
          className={cn(
            "object-cover transition-opacity duration-700 ease-out",
            phase === "loading" ? "opacity-0" : "opacity-100",
            imageClassName
          )}
          sizes={sizes}
          unoptimized={serveDirectly}
        />
      ) : null}
    </div>
  );
}

export function TripHeroPhoto({
  city,
  country,
  latitude,
  longitude,
  storedPhotoUrl,
}: {
  city: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  storedPhotoUrl?: string | null;
}) {
  const { src, phase, serveDirectly } = useDestinationPhoto({
    city,
    country,
    latitude,
    longitude,
    storedPhotoUrl,
    width: 4800,
  });

  return (
    <div className="relative h-52 overflow-hidden bg-surface sm:h-80">
      {phase === "loading" ? (
        <div aria-hidden className="absolute inset-0 animate-pulse-soft bg-surface-hover" />
      ) : null}
      {src ? (
        <Image
          src={src}
          alt={city}
          fill
          priority
          quality={95}
          className={cn(
            "object-cover object-center transition-opacity duration-700 ease-out",
            phase === "loading" ? "opacity-0" : "opacity-100"
          )}
          sizes="100vw"
          unoptimized={serveDirectly}
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
        style={{
          background:
            "linear-gradient(to top, var(--color-background) 0%, rgba(245,241,232,0.82) 42%, rgba(245,241,232,0) 100%)",
        }}
      />
    </div>
  );
}
