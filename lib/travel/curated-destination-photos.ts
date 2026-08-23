import { getDestinationImage } from "@/lib/images";

const CURATED_HERO_KEYS = new Set(["prague", "praha"]);

export function normalizeDestinationKey(destination: string): string {
  return destination.toLowerCase().replace(/[^a-z]/g, "");
}

export function hasCuratedDestinationHeroPhoto(destination: string): boolean {
  return CURATED_HERO_KEYS.has(normalizeDestinationKey(destination));
}

/** Hand-picked hero image for destinations where Google search quality is inconsistent. */
export function getCuratedDestinationHeroPhoto(destination: string, width = 3840): string | undefined {
  if (!hasCuratedDestinationHeroPhoto(destination)) return undefined;
  return getDestinationImage("Prague", width);
}
