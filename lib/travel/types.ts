export interface DestinationSuggestion {
  id: string;
  label: string;
  city: string;
  country: string;
  state?: string;
  latitude: number;
  longitude: number;
}

export type PlaceType =
  | "restaurant" | "bar" | "cafe" | "nightclub"
  | "hotel" | "hostel" | "apartment"
  | "attraction" | "museum" | "landmark" | "park" | "church"
  | "activity" | "tour" | "experience"
  | "shop" | "market"
  | "transport"
  | "other";

export interface NormalizedPlace {
  id: string;
  provider: string;
  providerPlaceId?: string;
  name: string;
  type: PlaceType;
  category?: string;
  subcategories?: string[];
  address?: string;
  city: string;
  country: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  openingHours?: string[];
  website?: string;
  phone?: string;
  mapsUrl?: string;
  photoUrls?: string[];
  description?: string;
  businessStatus?: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";
  googleTypes?: string[];
  tags?: string[];
  attributes?: string[];
  osmTags?: Record<string, string>;
  source: "verified" | "curated" | "ai_suggested";
  fetchedAt: string;
}

export interface PlaceSearchParams {
  query?: string;
  type?: PlaceType | PlaceType[];
  city: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  minRating?: number;
  maxPriceLevel?: number;
  limit?: number;
  pageToken?: string;
}

export interface PlaceSearchResult {
  places: NormalizedPlace[];
  totalFound: number;
  provider: string;
  cached: boolean;
  nextPageToken?: string;
}

export interface HotelSearchParams {
  city: string;
  country?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms?: number;
  maxPricePerNight?: number;
  neighborhood?: string;
  minRating?: number;
}

export interface NormalizedHotel extends NormalizedPlace {
  type: "hotel" | "hostel" | "apartment";
  pricePerNight?: number;
  currency?: string;
  amenities?: string[];
  bookingUrl?: string;
  neighborhood?: string;
}

export interface HotelSearchResult {
  hotels: NormalizedHotel[];
  totalFound: number;
  provider: string;
  cached: boolean;
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
}

export interface NormalizedFlight {
  id: string;
  provider: string;
  airline: string;
  flightNumber?: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  price?: number;
  currency?: string;
  bookingUrl?: string;
  source: "verified" | "estimated";
  fetchedAt: string;
}

export interface FlightSearchResult {
  flights: NormalizedFlight[];
  totalFound: number;
  provider: string;
  cached: boolean;
}

export interface ActivitySearchParams {
  city: string;
  country?: string;
  category?: string;
  date?: string;
  maxPrice?: number;
  limit?: number;
}

export interface NormalizedActivity extends NormalizedPlace {
  duration?: string;
  price?: string;
  bookingUrl?: string;
  bookingRequired?: boolean;
  bestTimeToVisit?: string;
}

export interface ActivitySearchResult {
  activities: NormalizedActivity[];
  totalFound: number;
  provider: string;
  cached: boolean;
}

export interface RouteParams {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  mode?: "walking" | "transit" | "driving";
}

export interface RouteResult {
  distanceMeters: number;
  distanceText: string;
  durationMinutes: number;
  durationText: string;
  provider: string;
}

export interface TravelDataProvider {
  name: string;
  searchPlaces?(params: PlaceSearchParams): Promise<PlaceSearchResult>;
  getPlaceDetails?(placeId: string): Promise<NormalizedPlace | null>;
  searchHotels?(params: HotelSearchParams): Promise<HotelSearchResult>;
  searchFlights?(params: FlightSearchParams): Promise<FlightSearchResult>;
  searchActivities?(params: ActivitySearchParams): Promise<ActivitySearchResult>;
  calculateRoute?(params: RouteParams): Promise<RouteResult>;
  isConfigured(): boolean;
}
