import { GooglePlacesProvider } from "./google-places";
import { OpenStreetMapProvider } from "./openstreetmap";
import { AmadeusProvider } from "./amadeus";
import { ViatorProvider } from "./viator";
import { BookingProvider } from "./booking";
import { registerTravelProvider } from "../registry";

const providers = [
  new GooglePlacesProvider(),
  new OpenStreetMapProvider(),
  new AmadeusProvider(),
  new ViatorProvider(),
  new BookingProvider(),
];

for (const provider of providers) {
  if (provider.isConfigured()) {
    registerTravelProvider(provider);
  }
}

export { GooglePlacesProvider, OpenStreetMapProvider, AmadeusProvider, ViatorProvider, BookingProvider };
