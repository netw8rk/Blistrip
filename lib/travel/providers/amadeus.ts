/**
 * Amadeus Provider Stub
 *
 * Required env vars:
 *   - AMADEUS_API_KEY
 *   - AMADEUS_API_SECRET
 *
 * API docs: https://developers.amadeus.com/
 * Capabilities: flight search, hotel search
 * When implementing: use amadeus-node SDK or REST API
 */

import type {
  TravelDataProvider,
  FlightSearchParams,
  FlightSearchResult,
  HotelSearchParams,
  HotelSearchResult,
} from "../types";

export class AmadeusProvider implements TravelDataProvider {
  name = "amadeus";

  isConfigured(): boolean {
    return !!(process.env.AMADEUS_API_KEY && process.env.AMADEUS_API_SECRET);
  }

  async searchFlights(params: FlightSearchParams): Promise<FlightSearchResult> {
    if (!this.isConfigured()) {
      console.warn("[amadeus] Provider not configured — missing AMADEUS_API_KEY or AMADEUS_API_SECRET");
    }
    return { flights: [], totalFound: 0, provider: this.name, cached: false };
  }

  async searchHotels(params: HotelSearchParams): Promise<HotelSearchResult> {
    if (!this.isConfigured()) {
      console.warn("[amadeus] Provider not configured — missing AMADEUS_API_KEY or AMADEUS_API_SECRET");
    }
    return { hotels: [], totalFound: 0, provider: this.name, cached: false };
  }
}
