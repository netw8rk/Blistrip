import Link from "next/link";
import { ArrowRight, Map, Sparkles, Compass, DollarSign, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = {
  title: "How It Works",
  description: "Learn how Blistrip creates personalized travel plans based on your preferences.",
};

export default function AboutPage() {
  const steps = [
    {
      icon: Map,
      step: "01",
      title: "Tell us about your trip",
      description:
        "Share your destination (or describe what you're looking for), travel dates, budget, who you're traveling with, and what kind of experiences you want.",
      details: ["Destination or trip description", "Dates or flexible travel", "Budget range", "Travel companions", "Interests and travel style"],
    },
    {
      icon: Sparkles,
      step: "02",
      title: "Get your personalized plan",
      description:
        "Blistrip analyzes your preferences and builds a complete trip plan — neighborhoods, hotels, daily itinerary, restaurants, budget breakdown, and travel tips.",
      details: ["Neighborhood recommendations", "Hotel picks with reasoning", "Day-by-day itinerary", "Restaurant suggestions", "Budget estimates"],
    },
    {
      icon: Compass,
      step: "03",
      title: "Book what you need",
      description:
        "Use your plan as a guide to book hotels, activities, and travel essentials. Every recommendation includes reasoning so you know why it fits your trip.",
      details: ["Hotel booking links", "Activity reservations", "Travel essentials", "Transportation tips", "Save trips for later"],
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16 sm:px-6">
      <div className="text-center mb-14">
        <p className="eyebrow mb-3">About Blistrip</p>
        <h1 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h1>
        <p className="text-foreground-secondary max-w-xl mx-auto leading-relaxed">
          Blistrip is a travel planning tool — not a chatbot. We use AI to build structured,
          personalized trip plans based on what actually matters to you.
        </p>
      </div>

      <div className="space-y-8 mb-14">
        {steps.map((step) => (
          <Card key={step.step} className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-muted border border-border-accent">
                <step.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-primary mb-1">{step.step}</p>
                <h2 className="text-xl font-bold mb-2">{step.title}</h2>
                <p className="text-foreground-secondary mb-4 leading-relaxed">{step.description}</p>
                <ul className="grid sm:grid-cols-2 gap-2">
                  {step.details.map((d) => (
                    <li key={d} className="flex items-center gap-2 text-sm text-muted">
                      <div className="h-1 w-1 rounded-full bg-primary/60" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-14">
        {[
          { icon: DollarSign, label: "Budget-aware planning" },
          { icon: Users, label: "Tailored to your group" },
          { icon: Calendar, label: "Flexible date support" },
        ].map((item) => (
          <Card key={item.label} className="p-5 text-center">
            <item.icon className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium">{item.label}</p>
          </Card>
        ))}
      </div>

      <div className="text-center card-surface p-10 border-border-accent">
        <h2 className="text-2xl font-bold mb-4">Ready to plan your trip?</h2>
        <Link href="/planner">
          <Button size="lg">
            Start Planning
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
