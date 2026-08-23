import {
  Backpack,
  Building2,
  CalendarDays,
  Gem,
  Heart,
  Landmark,
  Layers,
  MapPinned,
  Mountain,
  Palette,
  Palmtree,
  ShoppingBag,
  Sparkles,
  Trees,
  Trophy,
  User,
  Users,
  UsersRound,
  UtensilsCrossed,
  Wallet,
  Waves,
  Wine,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const TRAVELER_META: Record<string, { icon: LucideIcon; hint: string }> = {
  Solo: { icon: User, hint: "Just you" },
  Couple: { icon: Heart, hint: "Two of you" },
  Friends: { icon: Users, hint: "A group trip" },
  Family: { icon: UsersRound, hint: "Kids or relatives" },
};

export const INTEREST_META: Record<string, LucideIcon> = {
  Nightlife: Wine,
  History: Landmark,
  Food: UtensilsCrossed,
  Culture: Palette,
  Nature: Trees,
  Beaches: Palmtree,
  Adventure: Mountain,
  Relaxation: Waves,
  Shopping: ShoppingBag,
  Sports: Trophy,
  Architecture: Building2,
  "Local experiences": MapPinned,
};

export const STYLE_META: Record<string, { icon: LucideIcon; hint: string }> = {
  Budget: { icon: Wallet, hint: "Value stays and local eats" },
  Comfortable: { icon: Sparkles, hint: "Nice hotels, balanced spend" },
  Luxury: { icon: Gem, hint: "Top stays and experiences" },
  Backpacker: { icon: Backpack, hint: "Hostels and cheap eats" },
  "Mix of everything": { icon: Layers, hint: "A bit of each" },
};

export const PACE_META: Record<string, { icon: LucideIcon; hint: string }> = {
  "Slow and relaxed": { icon: Waves, hint: "Fewer stops, more time" },
  Balanced: { icon: CalendarDays, hint: "A full day without rushing" },
  "Pack everything in": { icon: Zap, hint: "See as much as you can" },
};
