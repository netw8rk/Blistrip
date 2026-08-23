import { getDestinationImage } from "@/lib/images";
import type { TripPlannerInput } from "@/types/trip";

export interface PreplannedDayHighlight {
  day: number;
  title: string;
  note: string;
}

export interface PreplannedGetaway {
  id: string;
  title: string;
  category: string;
  destination: string;
  country: string;
  latitude: number;
  longitude: number;
  durationDays: number;
  tagline: string;
  imageUrl: string;
  dayHighlights: PreplannedDayHighlight[];
  budget: TripPlannerInput["budget"];
  travelers: TripPlannerInput["travelers"];
  interests: TripPlannerInput["interests"];
  travelStyle: TripPlannerInput["travelStyle"];
  pace: TripPlannerInput["pace"];
  additionalNotes?: string;
}

export const preplannedGetaways: PreplannedGetaway[] = [
  {
    id: "prague-old-town",
    title: "Old Town Explorer",
    category: "History & culture",
    destination: "Prague",
    country: "Czech Republic",
    latitude: 50.0755,
    longitude: 14.4378,
    durationDays: 4,
    tagline: "Gothic squares, castle views, and beer halls at easy-going prices.",
    imageUrl: getDestinationImage("Prague", 1200),
    dayHighlights: [
      { day: 1, title: "Old Town & Astronomical Clock", note: "Morning walk through Staroměstské náměstí, evening riverside." },
      { day: 2, title: "Prague Castle & Malá Strana", note: "Cathedral views, then café time in the Lesser Quarter." },
      { day: 3, title: "Jewish Quarter & museums", note: "History-heavy day with flexible evening." },
    ],
    budget: "Under $80/night",
    travelers: "Solo",
    interests: ["History", "Architecture", "Food"],
    travelStyle: "Budget",
    pace: "Balanced",
    additionalNotes: "Prefer walkable neighborhoods and classic viewpoints over nightlife.",
  },
  {
    id: "budapest-ruin-weekend",
    title: "Ruin Bar Weekender",
    category: "Nightlife",
    destination: "Budapest",
    country: "Hungary",
    latitude: 47.4979,
    longitude: 19.0402,
    durationDays: 3,
    tagline: "Thermal baths by day, Szimpla-style bars and Danube nights.",
    imageUrl: getDestinationImage("Budapest", 1200),
    dayHighlights: [
      { day: 1, title: "Baths & District VII", note: "Széchenyi or Gellért, then easy dinner near ruin bars." },
      { day: 2, title: "Pest nightlife loop", note: "Late start, bar-hopping, keep mornings open." },
      { day: 3, title: "Buda views & markets", note: "Fisherman's Bastion morning before heading home." },
    ],
    budget: "$80–$150/night",
    travelers: "Friends",
    interests: ["Nightlife", "Food", "Relaxation"],
    travelStyle: "Backpacker",
    pace: "Pack everything in",
    additionalNotes: "Group-friendly spots with strong nightlife and good-value food.",
  },
  {
    id: "rome-classics",
    title: "Classic Rome",
    category: "Food & heritage",
    destination: "Rome",
    country: "Italy",
    latitude: 41.9028,
    longitude: 12.4964,
    durationDays: 5,
    tagline: "Ancient icons, trattoria lunches, and unhurried piazza evenings.",
    imageUrl: getDestinationImage("Rome", 1200),
    dayHighlights: [
      { day: 1, title: "Colosseum & Forum", note: "Core ancient Rome with a long lunch break." },
      { day: 2, title: "Vatican & Trastevere", note: "Museums morning, neighborhood dinner." },
      { day: 3, title: "Centro Storico stroll", note: "Trevi, Pantheon, gelato pacing." },
    ],
    budget: "$250–$400/night",
    travelers: "Couple",
    interests: ["History", "Food", "Culture"],
    travelStyle: "Luxury",
    pace: "Slow and relaxed",
  },
  {
    id: "barcelona-coast",
    title: "Coastal Barcelona",
    category: "Beach & architecture",
    destination: "Barcelona",
    country: "Spain",
    latitude: 41.3874,
    longitude: 2.1686,
    durationDays: 4,
    tagline: "Gaudí mornings, Barceloneta afternoons, tapas until late.",
    imageUrl: getDestinationImage("Barcelona", 1200),
    dayHighlights: [
      { day: 1, title: "Sagrada Família & Eixample", note: "Book-ahead landmark, modernist streets." },
      { day: 2, title: "Gothic Quarter & beach", note: "Old city loop, sunset by the water." },
      { day: 3, title: "Park Güell & Gràcia", note: "Views and neighborhood tapas." },
    ],
    budget: "$150–$250/night",
    travelers: "Friends",
    interests: ["Beaches", "Architecture", "Nightlife"],
    travelStyle: "Comfortable",
    pace: "Balanced",
  },
  {
    id: "lisbon-food-walks",
    title: "Lisbon Food Walks",
    category: "Food & neighborhoods",
    destination: "Lisbon",
    country: "Portugal",
    latitude: 38.7223,
    longitude: -9.1393,
    durationDays: 4,
    tagline: "Miradouro views, pastel de nata stops, and tram-hop exploring.",
    imageUrl: getDestinationImage("Lisbon", 1200),
    dayHighlights: [
      { day: 1, title: "Alfama & viewpoints", note: "Hilly streets, fado-friendly evening." },
      { day: 2, title: "Belém & riverfront", note: "Pastry break, relaxed waterfront time." },
      { day: 3, title: "LX Factory & Time Out", note: "Creative district and market lunch." },
    ],
    budget: "$80–$150/night",
    travelers: "Solo",
    interests: ["Food", "Local experiences", "Culture"],
    travelStyle: "Comfortable",
    pace: "Slow and relaxed",
    additionalNotes: "Focus on local restaurants and walkable districts.",
  },
  {
    id: "paris-art-cafes",
    title: "Paris Art & Cafés",
    category: "Art & romance",
    destination: "Paris",
    country: "France",
    latitude: 48.8566,
    longitude: 2.3522,
    durationDays: 4,
    tagline: "Museum mornings, Left Bank strolls, and candlelit dinners.",
    imageUrl: getDestinationImage("Paris", 1200),
    dayHighlights: [
      { day: 1, title: "Louvre & Tuileries", note: "One major museum, plenty of café time." },
      { day: 2, title: "Montmartre & Marais", note: "Village views and boutique browsing." },
      { day: 3, title: "Seine & Saint-Germain", note: "Classic Paris walk with flexible evening." },
    ],
    budget: "$250–$400/night",
    travelers: "Couple",
    interests: ["Culture", "Food", "Architecture"],
    travelStyle: "Luxury",
    pace: "Balanced",
  },
  {
    id: "amsterdam-canals",
    title: "Canals & Culture",
    category: "Local experiences",
    destination: "Amsterdam",
    country: "Netherlands",
    latitude: 52.3676,
    longitude: 4.9041,
    durationDays: 3,
    tagline: "Museum district, canal walks, and easy cycling days.",
    imageUrl: getDestinationImage("Amsterdam", 1200),
    dayHighlights: [
      { day: 1, title: "Canal belt & Jordaan", note: "Waterfront loops and brown-café stops." },
      { day: 2, title: "Museumplein", note: "Rijksmuseum or Van Gogh, park break." },
      { day: 3, title: "De Pijp & markets", note: "Local market morning, relaxed checkout." },
    ],
    budget: "$150–$250/night",
    travelers: "Couple",
    interests: ["Culture", "Architecture", "Local experiences"],
    travelStyle: "Comfortable",
    pace: "Balanced",
    additionalNotes: "Prefer museums and neighborhood wandering over party scenes.",
  },
];

export function getPreplannedGetaway(id: string): PreplannedGetaway | undefined {
  return preplannedGetaways.find((getaway) => getaway.id === id);
}

export function getawayToPlannerInput(getaway: PreplannedGetaway): TripPlannerInput {
  return {
    destination: getaway.destination,
    destinationUnknown: false,
    destinationCountry: getaway.country,
    destinationLabel: `${getaway.destination}, ${getaway.country}`,
    destinationLatitude: getaway.latitude,
    destinationLongitude: getaway.longitude,
    startDate: "",
    endDate: "",
    flexibleDates: false,
    budget: getaway.budget,
    travelers: getaway.travelers,
    interests: [...getaway.interests],
    travelStyle: getaway.travelStyle,
    pace: getaway.pace,
    additionalNotes: getaway.additionalNotes ?? "",
  };
}
