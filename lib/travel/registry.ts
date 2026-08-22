import type { TravelDataProvider } from "./types";

const providers = new Map<string, TravelDataProvider>();

export function registerTravelProvider(provider: TravelDataProvider): void {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): TravelDataProvider | undefined {
  return providers.get(name);
}

export function getConfiguredProviders(): TravelDataProvider[] {
  return Array.from(providers.values()).filter((p) => p.isConfigured());
}

export function hasPlaceSearch(): boolean {
  return getConfiguredProviders().some((p) => p.searchPlaces !== undefined);
}

export function hasHotelSearch(): boolean {
  return getConfiguredProviders().some((p) => p.searchHotels !== undefined);
}

export function hasFlightSearch(): boolean {
  return getConfiguredProviders().some((p) => p.searchFlights !== undefined);
}

export function hasActivitySearch(): boolean {
  return getConfiguredProviders().some((p) => p.searchActivities !== undefined);
}

export function hasRouting(): boolean {
  return getConfiguredProviders().some((p) => p.calculateRoute !== undefined);
}
