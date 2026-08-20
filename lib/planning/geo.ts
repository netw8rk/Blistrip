/** Haversine distance in kilometers between two coordinates. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Parse approximate duration strings like "2-3 hours" into minutes. */
export function parseDurationMinutes(duration: string): number {
  const lower = duration.toLowerCase();
  if (lower.includes("half day") || lower.includes("half-day")) return 240;
  if (lower.includes("full day")) return 480;

  const rangeMatch = lower.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(hour|hr|minute|min)/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    const avg = (low + high) / 2;
    return rangeMatch[3].startsWith("hour") || rangeMatch[3].startsWith("hr")
      ? Math.round(avg * 60)
      : Math.round(avg);
  }

  const singleMatch = lower.match(/(\d+(?:\.\d+)?)\s*(hour|hr|minute|min)/);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1]);
    return singleMatch[2].startsWith("hour") || singleMatch[2].startsWith("hr")
      ? Math.round(val * 60)
      : Math.round(val);
  }

  return 90;
}

/** Estimate walking time in minutes at ~4.5 km/h. */
export function estimateWalkMinutes(distanceKm: number): number {
  if (distanceKm <= 0.05) return 0;
  return Math.max(5, Math.ceil((distanceKm / 4.5) * 60));
}

export interface GeoPoint {
  id: string;
  latitude: number;
  longitude: number;
}

/** Greedy nearest-neighbor ordering to minimize backtracking. */
export function orderByProximity<T extends GeoPoint>(points: T[]): T[] {
  if (points.length <= 1) return [...points];

  const remaining = [...points];
  const ordered: T[] = [];
  let current = remaining.shift()!;
  ordered.push(current);

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(
        current.latitude,
        current.longitude,
        remaining[i].latitude,
        remaining[i].longitude
      );
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    current = remaining.splice(nearestIdx, 1)[0];
    ordered.push(current);
  }

  return ordered;
}
