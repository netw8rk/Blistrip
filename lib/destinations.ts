import type { Destination } from "@/types/trip";
import { getDestinationImage } from "@/lib/images";

export const destinations: Destination[] = [
  {
    id: "prague",
    name: "Prague",
    country: "Czech Republic",
    description: "Fairytale architecture, legendary beer halls, and a nightlife scene that punches above its weight.",
    bestFor: ["History", "Nightlife", "Food", "Architecture"],
    typicalBudget: "$800–$1,500",
    imageUrl: getDestinationImage("Prague"),
  },
  {
    id: "budapest",
    name: "Budapest",
    country: "Hungary",
    description: "Thermal baths by day, ruin bars by night. One of Europe's best value destinations.",
    bestFor: ["Nightlife", "Relaxation", "History", "Food"],
    typicalBudget: "$700–$1,300",
    imageUrl: getDestinationImage("Budapest"),
  },
  {
    id: "krakow",
    name: "Kraków",
    country: "Poland",
    description: "Medieval charm, incredible pierogi, and easy access to the Tatra Mountains.",
    bestFor: ["History", "Food", "Culture", "Budget"],
    typicalBudget: "$600–$1,100",
    imageUrl: getDestinationImage("Kraków"),
  },
  {
    id: "vienna",
    name: "Vienna",
    country: "Austria",
    description: "Imperial grandeur, world-class coffee culture, and classical music on every corner.",
    bestFor: ["Culture", "Architecture", "Food", "History"],
    typicalBudget: "$1,000–$2,000",
    imageUrl: getDestinationImage("Vienna"),
  },
  {
    id: "paris",
    name: "Paris",
    country: "France",
    description: "The city of light — art, cuisine, and romance in equal measure.",
    bestFor: ["Culture", "Food", "Shopping", "Architecture"],
    typicalBudget: "$1,500–$3,000",
    imageUrl: getDestinationImage("Paris"),
  },
  {
    id: "barcelona",
    name: "Barcelona",
    country: "Spain",
    description: "Gaudí's masterpieces, Mediterranean beaches, and tapas until midnight.",
    bestFor: ["Beaches", "Architecture", "Food", "Nightlife"],
    typicalBudget: "$1,000–$2,000",
    imageUrl: getDestinationImage("Barcelona"),
  },
  {
    id: "lisbon",
    name: "Lisbon",
    country: "Portugal",
    description: "Hilly streets, pastel de nata, fado music, and Atlantic sunsets.",
    bestFor: ["Food", "Culture", "Nightlife", "Local experiences"],
    typicalBudget: "$900–$1,600",
    imageUrl: getDestinationImage("Lisbon"),
  },
  {
    id: "rome",
    name: "Rome",
    country: "Italy",
    description: "Ancient ruins, incredible pasta, and la dolce vita around every corner.",
    bestFor: ["History", "Food", "Culture", "Architecture"],
    typicalBudget: "$1,200–$2,200",
    imageUrl: getDestinationImage("Rome"),
  },
  {
    id: "amsterdam",
    name: "Amsterdam",
    country: "Netherlands",
    description: "Canals, cycling culture, world-class museums, and a vibrant creative scene.",
    bestFor: ["Culture", "Nightlife", "Architecture", "Local experiences"],
    typicalBudget: "$1,200–$2,000",
    imageUrl: getDestinationImage("Amsterdam"),
  },
  {
    id: "porto",
    name: "Porto",
    country: "Portugal",
    description: "Port wine cellars, colorful riverside tiles, and some of Portugal's best food.",
    bestFor: ["Food", "Culture", "Relaxation", "Local experiences"],
    typicalBudget: "$800–$1,400",
    imageUrl: getDestinationImage("Porto"),
  },
];

export function getDestinationById(id: string): Destination | undefined {
  return destinations.find((d) => d.id === id || d.name.toLowerCase() === id.toLowerCase());
}

export function getDestinationByName(name: string): Destination | undefined {
  return destinations.find((d) => d.name.toLowerCase() === name.toLowerCase());
}
