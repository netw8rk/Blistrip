import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { VercelAnalytics } from "@/components/analytics/vercel-analytics";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: {
    default: "Blistrip — AI Travel Planner",
    template: "%s | Blistrip",
  },
  description:
    "Plan smarter trips with an AI travel planner built around your budget, interests, and travel style.",
  keywords: ["travel planner", "AI travel", "trip planning", "budget travel"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable}`}>
      <body className="min-h-screen flex flex-col font-sans">
        <Navbar />
        <main className="flex-1 pt-16">{children}</main>
        <Footer />
        <VercelAnalytics />
      </body>
    </html>
  );
}
