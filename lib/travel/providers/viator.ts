/**
 * Viator Provider Stub
 *
 * Required env vars:
 *   - VIATOR_API_KEY
 *
 * API docs: https://docs.viator.com/
 * Capabilities: activity/tour search, booking URLs
 * Alternative: GetYourGuide Partner API
 */

import type {
  TravelDataProvider,
  ActivitySearchParams,
  ActivitySearchResult,
} from "../types";

export class ViatorProvider implements TravelDataProvider {
  name = "viator";

  isConfigured(): boolean {
    return !!process.env.VIATOR_API_KEY;
  }

  async searchActivities(params: ActivitySearchParams): Promise<ActivitySearchResult> {
    if (!this.isConfigured()) {
      console.warn("[viator] Provider not configured — missing VIATOR_API_KEY");
    }
    return { activities: [], totalFound: 0, provider: this.name, cached: false };
  }
}
