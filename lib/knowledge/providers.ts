export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
}

export interface FlightResult {
  airline: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  price: number;
  currency: string;
  bookingUrl: string;
}

export interface FlightProvider {
  searchFlights(params: FlightSearchParams): Promise<FlightResult[]>;
  isAvailable(): Promise<boolean>;
}

export interface HotelSearchParams {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms?: number;
  priceMax?: number;
  neighborhood?: string;
}

export interface HotelResult {
  name: string;
  rating: number;
  pricePerNight: number;
  currency: string;
  neighborhood: string;
  amenities: string[];
  bookingUrl: string;
}

export interface HotelProvider {
  searchHotels(params: HotelSearchParams): Promise<HotelResult[]>;
  isAvailable(): Promise<boolean>;
}

export interface RestaurantSearchParams {
  destination: string;
  cuisine?: string;
  priceLevel?: number;
  neighborhood?: string;
  limit?: number;
}

export interface RestaurantResult {
  name: string;
  cuisine: string;
  priceLevel: number;
  rating: number;
  address: string;
  bookingUrl?: string;
}

export interface RestaurantProvider {
  searchRestaurants(params: RestaurantSearchParams): Promise<RestaurantResult[]>;
  isAvailable(): Promise<boolean>;
}

export interface MapsRouteParams {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  mode?: "walking" | "transit" | "driving";
}

export interface MapsRouteResult {
  distance: string;
  duration: string;
  steps?: string[];
}

export interface MapsProvider {
  getRoute(params: MapsRouteParams): Promise<MapsRouteResult>;
  isAvailable(): Promise<boolean>;
}

export interface LiveDataProviders {
  flights?: FlightProvider;
  hotels?: HotelProvider;
  restaurants?: RestaurantProvider;
  maps?: MapsProvider;
}

const providers: LiveDataProviders = {};

export function registerProvider<K extends keyof LiveDataProviders>(
  type: K,
  provider: LiveDataProviders[K]
): void {
  providers[type] = provider;
}

export function getProvider<K extends keyof LiveDataProviders>(
  type: K
): LiveDataProviders[K] | undefined {
  return providers[type];
}

export function hasProvider(type: keyof LiveDataProviders): boolean {
  return providers[type] !== undefined;
}
