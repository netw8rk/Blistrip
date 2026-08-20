export type AffiliateCategory =
  | "hotel"
  | "activity"
  | "flight"
  | "insurance"
  | "esim"
  | "transport"
  | "product";

interface AffiliateConfig {
  baseUrl: string;
  partnerId?: string;
}

const affiliateConfigs: Record<AffiliateCategory, AffiliateConfig> = {
  hotel: { baseUrl: "https://placeholder.hotels.example.com", partnerId: "blistrip-hotels" },
  activity: { baseUrl: "https://placeholder.activities.example.com", partnerId: "blistrip-activities" },
  flight: { baseUrl: "https://placeholder.flights.example.com", partnerId: "blistrip-flights" },
  insurance: { baseUrl: "https://placeholder.insurance.example.com", partnerId: "blistrip-insurance" },
  esim: { baseUrl: "https://placeholder.esim.example.com", partnerId: "blistrip-esim" },
  transport: { baseUrl: "https://placeholder.transport.example.com", partnerId: "blistrip-transport" },
  product: { baseUrl: "https://placeholder.products.example.com", partnerId: "blistrip-products" },
};

export function getAffiliateUrl(
  category: AffiliateCategory,
  itemName: string,
  destination?: string
): string {
  const config = affiliateConfigs[category];
  const params = new URLSearchParams({
    ref: config.partnerId ?? "blistrip",
    item: itemName.toLowerCase().replace(/\s+/g, "-"),
    ...(destination && { destination: destination.toLowerCase().replace(/\s+/g, "-") }),
  });
  return `${config.baseUrl}?${params.toString()}`;
}

export function trackAffiliateClick(
  category: AffiliateCategory,
  itemName: string,
  destination?: string
): string {
  const url = getAffiliateUrl(category, itemName, destination);
  return url;
}
