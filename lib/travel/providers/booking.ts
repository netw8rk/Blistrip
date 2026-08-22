/**
 * Booking.com Provider Stub
 *
 * Required env vars:
 *   - BOOKING_API_KEY
 *   - BOOKING_AFFILIATE_ID
 *
 * API docs: https://developers.booking.com/
 * Capabilities: hotel search, pricing, availability, booking URLs
 * Note: Requires Booking.com affiliate partnership
 */

import type {
  TravelDataProvider,
  HotelSearchParams,
  HotelSearchResult,
} from "../types";

export class BookingProvider implements TravelDataProvider {
  name = "booking";

  isConfigured(): boolean {
    return !!(process.env.BOOKING_API_KEY && process.env.BOOKING_AFFILIATE_ID);
  }

  async searchHotels(params: HotelSearchParams): Promise<HotelSearchResult> {
    if (!this.isConfigured()) {
      console.warn("[booking] Provider not configured — missing BOOKING_API_KEY or BOOKING_AFFILIATE_ID");
    }
    return { hotels: [], totalFound: 0, provider: this.name, cached: false };
  }
}
