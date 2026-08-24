"use client";

import { useCallback, useEffect, useState } from "react";
import Image, { type ImageProps } from "next/image";
import { shouldServePhotoDirectly } from "@/lib/images";
import { withGooglePhotoWidth } from "@/lib/travel/google-links";

type PlacePhotoImageProps = Omit<ImageProps, "src" | "onError" | "unoptimized"> & {
  primarySrc?: string | null;
  fallbackSrc: string;
  /** Request width for Google photo proxy URLs. */
  width?: number;
};

function resolvePhotoSrc(src: string | null | undefined, width: number): string | undefined {
  if (!src) return undefined;
  return withGooglePhotoWidth(src, width) || src;
}

export function PlacePhotoImage({
  primarySrc,
  fallbackSrc,
  width = 800,
  alt,
  ...props
}: PlacePhotoImageProps) {
  const primary = resolvePhotoSrc(primarySrc, width);
  const fallback = resolvePhotoSrc(fallbackSrc, width) ?? fallbackSrc;
  const initial = primary ?? fallback;

  const [currentSrc, setCurrentSrc] = useState(initial);
  const [usingFallback, setUsingFallback] = useState(!primary);

  useEffect(() => {
    setCurrentSrc(primary ?? fallback);
    setUsingFallback(!primary);
  }, [primary, fallback]);

  const handleError = useCallback(() => {
    if (!usingFallback) {
      setCurrentSrc(fallback);
      setUsingFallback(true);
    }
  }, [fallback, usingFallback]);

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      unoptimized={shouldServePhotoDirectly(currentSrc)}
      onError={handleError}
    />
  );
}
