/**
 * Lightweight in-memory record of recently selected places.
 * Prevents back-to-back identical itineraries without banning landmarks.
 * Resets when the server restarts. Ready to swap for persistent storage later.
 */
interface RecentEntry {
  count: number;
  lastUsed: number;
}

const store = new Map<string, RecentEntry>();
const TTL_MS = 24 * 60 * 60 * 1000;

function key(city: string, placeId: string): string {
  return `${city.trim().toLowerCase()}::${placeId}`;
}

function prune(now = Date.now()) {
  for (const [id, entry] of store) {
    if (now - entry.lastUsed > TTL_MS) store.delete(id);
  }
}

export function recordSelectedPlaces(city: string, placeIds: string[]) {
  const now = Date.now();
  prune(now);
  for (const placeId of placeIds) {
    if (!placeId) continue;
    const id = key(city, placeId);
    const current = store.get(id);
    store.set(id, { count: (current?.count ?? 0) + 1, lastUsed: now });
  }
}

export function recentUseCount(city: string, placeId: string): number {
  prune();
  return store.get(key(city, placeId))?.count ?? 0;
}

export function recentUsePenalty(city: string, placeId: string): number {
  const count = recentUseCount(city, placeId);
  if (count <= 0) return 0;
  return Math.min(14, count * 4);
}

export function clearRecentPlaces() {
  store.clear();
}
