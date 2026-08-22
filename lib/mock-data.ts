import type { TripPlannerInput, TripPlan } from "@/types/trip";
import { getAffiliateUrl } from "@/lib/affiliate";
import { calculateDuration, generateId, parseBudgetRange } from "@/lib/utils";
import { getDestinationByName } from "@/lib/destinations";

const destinationData: Record<string, Partial<TripPlan>> = {
  Prague: {
    country: "Czech Republic",
    recommendedNeighborhood: "New Town",
    neighborhoodReason:
      "You're close to Old Town while having better nightlife and more local restaurants. Perfect balance for your interests.",
    neighborhoods: [
      {
        name: "New Town",
        bestFor: "Nightlife + Convenience",
        why: "Close to Old Town with better nightlife, local restaurants, and slightly lower hotel prices.",
      },
      {
        name: "Old Town",
        bestFor: "First-time visitors + History",
        why: "Walk to everything historic, but expect higher prices and more tourists.",
      },
      {
        name: "Žižkov",
        bestFor: "Local vibe + Nightlife",
        why: "Edgy neighborhood with the best beer halls and a younger crowd. Great value stays.",
      },
    ],
    hotelRecommendations: [
      {
        name: "Hotel Josef",
        description: "Design-forward boutique hotel in New Town with minimalist Czech charm.",
        priceRange: "$90–$130/night",
        whyRecommended: "Stylish without the Old Town premium. Walking distance to Wenceslas Square nightlife.",
        rating: 4.6,
        neighborhood: "New Town",
        bookingUrl: "",
      },
      {
        name: "MOOD Hotel",
        description: "Modern 4-star with rooftop views and excellent breakfast.",
        priceRange: "$110–$160/night",
        whyRecommended: "Great for couples wanting comfort without luxury prices. Near tram lines everywhere.",
        rating: 4.5,
        neighborhood: "New Town",
        bookingUrl: "",
      },
      {
        name: "Three Golden Crowns",
        description: "Historic building in Malá Strana with castle views.",
        priceRange: "$70–$100/night",
        whyRecommended: "Best value near the castle district. Quiet evenings, easy access to Old Town.",
        rating: 4.3,
        neighborhood: "Malá Strana",
        bookingUrl: "",
      },
    ],
    activities: [
      {
        name: "Prague Castle & St. Vitus Cathedral",
        description: "Explore the largest ancient castle complex in the world.",
        price: "Free–$15",
        duration: "3–4 hours",
        whyRecommended: "Essential Prague experience that matches your history interest without feeling touristy if you go early.",
        bookingUrl: "",
        category: "History",
      },
      {
        name: "Old Town Walking Tour",
        description: "Self-guided walk through Astronomical Clock, Old Town Square, and hidden courtyards.",
        price: "Free",
        duration: "2 hours",
        whyRecommended: "See the highlights at your own pace — perfect for a balanced travel style.",
        bookingUrl: "",
        category: "History",
      },
      {
        name: "Beer Hall Experience at U Fleků",
        description: "Historic brewery serving dark lager since 1499.",
        price: "$15–$25",
        duration: "2 hours",
        whyRecommended: "Authentic Czech beer culture — not a tourist trap, actual local institution.",
        bookingUrl: "",
        category: "Food",
      },
      {
        name: "Letná Park Sunset",
        description: "Hilltop park with the best panoramic views of Prague.",
        price: "Free",
        duration: "1–2 hours",
        whyRecommended: "Relaxed evening activity with incredible views — great pre-nightlife spot.",
        bookingUrl: "",
        category: "Nature",
      },
      {
        name: "Jazz Dock",
        description: "Floating jazz club on the Vltava river.",
        price: "$20–$40",
        duration: "3 hours",
        whyRecommended: "Unique nightlife that's more sophisticated than club-hopping.",
        bookingUrl: "",
        category: "Nightlife",
      },
      {
        name: "Food Tour — Vinohrady",
        description: "Explore Prague's best food neighborhood with local specialties.",
        price: "$45–$65",
        duration: "3 hours",
        whyRecommended: "Gets you off the tourist trail into where locals actually eat.",
        bookingUrl: "",
        category: "Food",
      },
    ],
    restaurants: [
      {
        name: "Kantýna",
        cuisine: "Czech comfort food",
        priceRange: "$",
        whyRecommended: "Standing-room-only spot locals love. Try the beef tartare and daily specials.",
        location: "New Town",
        category: "cheap",
        bookingUrl: "",
      },
      {
        name: "Lokál Dlouhááá",
        cuisine: "Traditional Czech",
        priceRange: "$",
        whyRecommended: "Best goulash and svíčková in the city at honest prices.",
        location: "Old Town",
        category: "cheap",
        bookingUrl: "",
      },
      {
        name: "Field",
        cuisine: "Modern European",
        priceRange: "$$",
        whyRecommended: "Michelin-starred but approachable. Perfect mid-range splurge for food lovers.",
        location: "New Town",
        category: "mid-range",
        bookingUrl: "",
      },
      {
        name: "Mlejnice",
        cuisine: "Bohemian",
        priceRange: "$$",
        whyRecommended: "Cozy cellar restaurant with excellent duck and beer pairings.",
        location: "Old Town",
        category: "mid-range",
        bookingUrl: "",
      },
      {
        name: "La Degustation",
        cuisine: "Fine dining Czech",
        priceRange: "$$$",
        whyRecommended: "One Michelin star. Modern Czech tasting menu — book ahead.",
        location: "Old Town",
        category: "special-occasion",
        bookingUrl: "",
      },
      {
        name: "Bellevue",
        cuisine: "French-Czech fusion",
        priceRange: "$$$",
        whyRecommended: "Elegant riverside dining with castle views. Special occasion worthy.",
        location: "Malá Strana",
        category: "special-occasion",
        bookingUrl: "",
      },
    ],
    transportation: [
      "Prague has excellent public transit — get a 72-hour pass ($12) for unlimited metro, tram, and bus.",
      "The airport is 30 min from center via AE bus ($3) or Uber ($25–$35).",
      "Old Town is walkable; use trams for Malá Strana and Žižkov.",
      "Avoid taxis from the airport — use Uber or Bolt instead.",
    ],
    travelTips: [
      "Exchange money only at banks, never at street kiosks — rates are terrible.",
      "Tap water is safe to drink throughout Prague.",
      "Most restaurants don't expect tips, but 10% is appreciated for good service.",
      "Book restaurants for weekend dinners — popular spots fill up fast.",
      "Visit the castle early (before 9am) to avoid tour groups.",
    ],
    packingRecommendations: [
      "Comfortable walking shoes — Prague's cobblestones are unforgiving",
      "Light layers — evenings can be cool even in summer",
      "Universal power adapter (Type C/E)",
      "Small daypack for castle and walking days",
      "Reusable water bottle",
    ],
  },
  Budapest: {
    country: "Hungary",
    recommendedNeighborhood: "District VII (Jewish Quarter)",
    neighborhoodReason: "Heart of ruin bar culture, great restaurants, and walking distance to major sights.",
    neighborhoods: [
      { name: "District VII", bestFor: "Nightlife + Food", why: "Ruin bars, street food, and the city's creative energy." },
      { name: "District V", bestFor: "First visit + Landmarks", why: "Parliament, Chain Bridge, and Danube views." },
      { name: "Buda Castle District", bestFor: "History + Views", why: "Quieter, scenic, and rich in history." },
    ],
    hotelRecommendations: [
      {
        name: "Brody House",
        description: "Art-filled boutique in the Jewish Quarter.",
        priceRange: "$80–$120/night",
        whyRecommended: "Creative vibe matches Budapest's energy. Steps from ruin bars.",
        rating: 4.5,
        neighborhood: "District VII",
        bookingUrl: "",
      },
      {
        name: "Hotel Palazzo Zichy",
        description: "Elegant converted palace near the river.",
        priceRange: "$100–$150/night",
        whyRecommended: "Historic charm with modern comfort. Great for couples.",
        rating: 4.6,
        neighborhood: "District VIII",
        bookingUrl: "",
      },
      {
        name: "Maverick City Lodge",
        description: "Stylish hostel-hotel hybrid with private rooms.",
        priceRange: "$50–$80/night",
        whyRecommended: "Social atmosphere without sacrificing privacy. Budget-friendly.",
        rating: 4.4,
        neighborhood: "District VII",
        bookingUrl: "",
      },
    ],
    activities: [
      {
        name: "Széchenyi Thermal Bath",
        description: "Grand outdoor thermal baths in City Park.",
        price: "$20–$30",
        duration: "3–4 hours",
        whyRecommended: "Iconic Budapest experience — relaxing and uniquely Hungarian.",
        bookingUrl: "",
        category: "Relaxation",
      },
      {
        name: "Ruin Bar Crawl",
        description: "Explore Szimpla Kert, Instant, and other converted courtyard bars.",
        price: "$20–$40",
        duration: "4 hours",
        whyRecommended: "The nightlife experience you came for — each bar is different.",
        bookingUrl: "",
        category: "Nightlife",
      },
      {
        name: "Buda Castle & Fisherman's Bastion",
        description: "Castle district with panoramic Danube views.",
        price: "Free–$10",
        duration: "3 hours",
        whyRecommended: "Best views in the city with manageable crowds if you go early.",
        bookingUrl: "",
        category: "History",
      },
      {
        name: "Central Market Hall",
        description: "Grand 19th-century market with local food and crafts.",
        price: "Free entry",
        duration: "1–2 hours",
        whyRecommended: "Authentic local food scene — try lángos and paprika.",
        bookingUrl: "",
        category: "Food",
      },
    ],
    restaurants: [
      {
        name: "Bors GasztroBár",
        cuisine: "Street food",
        priceRange: "$",
        whyRecommended: "Best soup in Budapest for under $5.",
        location: "District VII",
        category: "cheap",
        bookingUrl: "",
      },
      {
        name: "Mazel Tov",
        cuisine: "Middle Eastern",
        priceRange: "$$",
        whyRecommended: "Beautiful courtyard setting, great for groups.",
        location: "District VII",
        category: "mid-range",
        bookingUrl: "",
      },
      {
        name: "Costes",
        cuisine: "Fine dining",
        priceRange: "$$$",
        whyRecommended: "Hungary's first Michelin star. Special occasion splurge.",
        location: "District IX",
        category: "special-occasion",
        bookingUrl: "",
      },
    ],
    transportation: [
      "Budapest Metro is efficient — get a 72-hour travel card ($15).",
      "Tram 2 along the Danube is scenic and included in transit passes.",
      "Use Bolt or Főtaxi — avoid unmarked cabs.",
    ],
    travelTips: [
      "The currency is Hungarian Forint — cards widely accepted.",
      "Thermal baths are busiest weekends — go weekday mornings.",
      "Tipping 10% at restaurants is standard.",
    ],
    packingRecommendations: [
      "Swimsuit for thermal baths",
      "Comfortable shoes for cobblestones",
      "Universal power adapter",
    ],
  },
};

function buildDailyItinerary(destination: string, duration: number, interests: string[]): TripPlan["dailyItinerary"] {
  const itineraries: Record<string, { title: string; morning: string; afternoon: string; evening: string }[]> = {
    Prague: [
      { title: "Arrival + Old Town", morning: "Check in & explore Wenceslas Square", afternoon: "Old Town Square & Astronomical Clock", evening: "Dinner at Lokál + evening stroll along the river" },
      { title: "Prague Castle + Malá Strana", morning: "Prague Castle & St. Vitus Cathedral", afternoon: "Walk down through Malá Strana gardens", evening: "Beer at U Fleků + Jazz Dock if energy allows" },
      { title: "Food + Local Life", morning: "Vinohrady food exploration", afternoon: "Letná Park & beer garden views", evening: "Žižkov pub crawl — start at U Sadu" },
      { title: "Hidden Prague", morning: "Jewish Quarter & synagogues", afternoon: "Kampa Island & Lennon Wall", evening: "Rooftop drinks in New Town" },
      { title: "Departure Day", morning: "Final coffee at a local café", afternoon: "Last-minute shopping on Na Příkopě", evening: "Head to airport — allow 3 hours" },
    ],
    Budapest: [
      { title: "Arrival + Danube", morning: "Check in & explore District VII", afternoon: "Parliament building exterior & Chain Bridge", evening: "Ruin bar evening starting at Szimpla Kert" },
      { title: "Baths + Buda", morning: "Széchenyi Thermal Bath", afternoon: "Buda Castle & Fisherman's Bastion", evening: "Dinner in District V" },
      { title: "Markets + Culture", morning: "Central Market Hall", afternoon: "Dohány Street Synagogue area", evening: "Night cruise on the Danube" },
      { title: "Local Budapest", morning: "Memento Park or Hospital in the Rock", afternoon: "Gellért Hill sunset walk", evening: "Final ruin bar crawl" },
      { title: "Departure", morning: "Coffee & pastries", afternoon: "Last shopping on Váci Street", evening: "Airport transfer" },
    ],
  };

  const defaultDays = [
    { title: "Arrival + Explore", morning: "Check in and get oriented", afternoon: "Walk the historic center", evening: "Local dinner and early night" },
    { title: "Culture & Sights", morning: "Main landmark visit", afternoon: "Museum or neighborhood walk", evening: "Local cuisine experience" },
    { title: "Local Experiences", morning: "Off-the-beaten-path neighborhood", afternoon: "Market or park visit", evening: "Nightlife or relaxed evening" },
    { title: "Adventure Day", morning: "Day trip or deeper exploration", afternoon: "Continue exploring", evening: "Special dinner" },
    { title: "Departure", morning: "Final café visit", afternoon: "Last-minute shopping", evening: "Head to airport" },
  ];

  const days = itineraries[destination] ?? defaultDays;
  return Array.from({ length: duration }, (_, i) => {
    const day = days[i] ?? defaultDays[Math.min(i, defaultDays.length - 1)];
    return {
      day: i + 1,
      title: day.title,
      morning: [{ name: day.morning, description: day.morning, whyRecommended: `Fits your ${interests.slice(0, 2).join(" + ").toLowerCase()} interests.` }],
      afternoon: [{ name: day.afternoon, description: day.afternoon, whyRecommended: "Balanced pacing — no rushing between sights." }],
      evening: [{ name: day.evening, description: day.evening, whyRecommended: "Evening plans matched to your travel style." }],
    };
  });
}

function buildBudgetBreakdown(totalBudget: number): TripPlan["budgetBreakdown"] {
  const accommodation = Math.round(totalBudget * 0.35);
  const food = Math.round(totalBudget * 0.25);
  const activities = Math.round(totalBudget * 0.2);
  const transportation = Math.round(totalBudget * 0.12);
  const other = totalBudget - accommodation - food - activities - transportation;
  return { accommodation, food, activities, transportation, other: Math.max(0, other) };
}

function inferDestination(input: TripPlannerInput): string {
  if (!input.destinationUnknown && input.destination) {
    return input.destination;
  }
  const desc = (input.destinationDescription ?? "").toLowerCase();
  if (desc.includes("prague") || desc.includes("czech")) return "Prague";
  if (desc.includes("budapest") || desc.includes("hungary")) return "Budapest";
  if (desc.includes("krakow") || desc.includes("poland")) return "Kraków";
  if (desc.includes("vienna") || desc.includes("austria")) return "Vienna";
  if (desc.includes("paris") || desc.includes("france")) return "Paris";
  if (desc.includes("barcelona") || desc.includes("spain")) return "Barcelona";
  if (desc.includes("lisbon") || desc.includes("portugal")) return "Lisbon";
  if (desc.includes("rome") || desc.includes("italy")) return "Rome";
  if (desc.includes("nightlife") && desc.includes("affordable") && desc.includes("europe")) return "Budapest";
  if (desc.includes("beach")) return "Barcelona";
  if (desc.includes("history") && desc.includes("food")) return "Prague";
  return "Prague";
}

export function generateMockTrip(input: TripPlannerInput): TripPlan {
  const destination = !input.destinationUnknown && input.destination
    ? input.destination
    : inferDestination(input);
  const destInfo = getDestinationByName(destination);
  const duration = calculateDuration(input.startDate, input.endDate, input.flexibleDates);
  const budget = parseBudgetRange(input.budget, input.customBudget);
  const interests = input.interests.length > 0 ? input.interests : ["History", "Food", "Culture"];
  const countryMatches =
    !input.destinationCountry ||
    !destInfo?.country ||
    destInfo.country.toLowerCase() === input.destinationCountry.toLowerCase();

  const hasCurated = Boolean(destinationData[destination]) && countryMatches;
  const baseData: Partial<TripPlan> = hasCurated ? destinationData[destination] : {};
  const dates = input.flexibleDates
    ? "Flexible dates"
    : input.startDate && input.endDate
      ? `${input.startDate} – ${input.endDate}`
      : "Flexible dates";

  const travelEssentials = [
    { name: "Universal Travel Adapter", description: "Essential for keeping devices charged abroad.", price: "$15–$25", category: "accessories", bookingUrl: "" },
    { name: "Packing Cubes Set", description: "Keep your bag organized across multiple hotel stays.", price: "$20–$35", category: "accessories", bookingUrl: "" },
    { name: "Portable Power Bank", description: "Long days of navigation and photos drain your phone fast.", price: "$25–$45", category: "electronics", bookingUrl: "" },
    { name: "Compression Bags", description: "Maximize luggage space for souvenirs and layers.", price: "$12–$20", category: "accessories", bookingUrl: "" },
    { name: "Travel Organizer Pouch", description: "Keep passport, cards, and boarding passes in one place.", price: "$10–$18", category: "accessories", bookingUrl: "" },
    { name: "eSIM Data Plan", description: "Stay connected without expensive roaming charges.", price: "$15–$30", category: "connectivity", bookingUrl: "" },
  ];

  const trip: TripPlan = {
    id: generateId(),
    tripSummary: `A ${duration}-day ${input.travelStyle.toLowerCase()} trip to ${destination} built around ${interests.slice(0, 3).join(", ").toLowerCase()}. We've balanced must-see sights with local experiences that match your ${input.pace.toLowerCase()} pace and ${input.travelers.toLowerCase()} travel style.`,
    destination,
    country: input.destinationCountry || baseData.country || destInfo?.country || "",
    destinationLabel: input.destinationLabel,
    destinationLatitude: input.destinationLatitude,
    destinationLongitude: input.destinationLongitude,
    dates,
    duration,
    estimatedBudget: budget,
    travelStyle: input.travelStyle,
    interests,
    recommendedNeighborhood: baseData.recommendedNeighborhood ?? "City Center",
    neighborhoodReason: baseData.neighborhoodReason ?? "Central location with easy access to main attractions.",
    neighborhoods: baseData.neighborhoods ?? [],
    hotelRecommendations: (baseData.hotelRecommendations ?? []).map((h) => ({
      ...h,
      bookingUrl: getAffiliateUrl("hotel", h.name, destination),
    })),
    activities: (baseData.activities ?? []).map((a) => ({
      ...a,
      bookingUrl: getAffiliateUrl("activity", a.name, destination),
    })),
    restaurants: (baseData.restaurants ?? []).map((r) => ({
      ...r,
      bookingUrl: getAffiliateUrl("activity", r.name, destination),
    })),
    transportation: baseData.transportation ?? ["Use public transit where available.", "Book airport transfers in advance."],
    dailyItinerary: buildDailyItinerary(destination, duration, interests),
    budgetBreakdown: buildBudgetBreakdown(budget),
    travelTips: baseData.travelTips ?? ["Book popular restaurants ahead.", "Carry a reusable water bottle."],
    packingRecommendations: baseData.packingRecommendations ?? ["Comfortable walking shoes", "Universal adapter"],
    travelEssentials: travelEssentials.map((p) => ({
      ...p,
      bookingUrl: getAffiliateUrl("product", p.name),
    })),
    createdAt: new Date().toISOString(),
    plannerInput: input,
  };

  return trip;
}

export function enrichTripPlan(raw: Omit<TripPlan, "id" | "createdAt">, input?: TripPlannerInput): TripPlan {
  const destination = raw.destination;
  return {
    ...raw,
    id: generateId(),
    createdAt: new Date().toISOString(),
    plannerInput: input,
    hotelRecommendations: raw.hotelRecommendations.map((h) => ({
      ...h,
      bookingUrl: h.bookingUrl || getAffiliateUrl("hotel", h.name, destination),
    })),
    activities: raw.activities.map((a) => ({
      ...a,
      bookingUrl: a.bookingUrl || getAffiliateUrl("activity", a.name, destination),
    })),
    restaurants: raw.restaurants.map((r) => ({
      ...r,
      bookingUrl: r.bookingUrl || getAffiliateUrl("activity", r.name, destination),
    })),
    travelEssentials: (raw.travelEssentials ?? []).map((p) => ({
      ...p,
      bookingUrl: p.bookingUrl || getAffiliateUrl("product", p.name),
    })),
  };
}

export const examplePragueTrip = generateMockTrip({
  destination: "Prague",
  destinationUnknown: false,
  startDate: "2026-06-01",
  endDate: "2026-06-05",
  flexibleDates: false,
  budget: "$1,000–$2,000",
  travelers: "Friends",
  interests: ["Nightlife", "History", "Food"],
  travelStyle: "Comfortable",
  pace: "Balanced",
});
