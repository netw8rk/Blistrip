import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Sparkles,
  Map,
  DollarSign,
  Compass,
  Target,
  Layers,
  TrendingUp,
  Users,
  Mountain,
  UtensilsCrossed,
  Palmtree,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { examplePragueTrip } from "@/lib/mock-data";
import { images, getDestinationImage } from "@/lib/images";
import { DestinationCarousel } from "@/components/landing/destination-carousel";

export function HeroSection() {
  return (
    <section className="section-base">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="relative overflow-hidden rounded-2xl border border-border shadow-sm animate-slide-up min-h-[480px] sm:min-h-[500px] lg:min-h-[520px] max-h-[640px]">
          <Image
            src={images.hero}
            alt="Eiffel Tower and Paris skyline"
            fill
            className="object-cover object-[65%_center] sm:object-[70%_center]"
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
          />

          {/* Left scrim — localized fade, not a full-card wash */}
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-[62%] sm:w-[58%] lg:w-[48%] bg-gradient-to-r from-background/75 via-background/30 to-transparent"
          />
          {/* Right scrim — mirrors left for Quick Plan panel */}
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 hidden lg:block w-[48%] bg-gradient-to-l from-background/75 via-background/30 to-transparent"
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background/25 to-transparent sm:hidden"
          />

          <div className="relative z-10 flex h-full min-h-[480px] sm:min-h-[500px] lg:min-h-[520px] flex-col justify-end p-5 sm:p-6 lg:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
            <div className="max-w-md lg:max-w-lg shrink-0">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border-accent bg-primary-muted px-3 py-1 text-[11px] font-medium text-primary mb-3">
                <Sparkles className="h-3 w-3" />
                AI-powered travel planning
              </span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold leading-[1.1] tracking-tight text-foreground mb-2.5">
                Your trip,
                <br />
                <span className="text-gradient">planned in minutes.</span>
              </h1>
              <p className="text-sm sm:text-base text-foreground-secondary max-w-sm leading-relaxed">
                Budget, dates, vibe — tell Blistrip what matters and get a full itinerary built around you.
              </p>

              <div className="mt-4 flex max-w-sm items-center gap-4 sm:gap-6">
                {[
                  { value: "8", label: "Step planner" },
                  { value: "10+", label: "Destinations" },
                  { value: "60s", label: "To your plan" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-base sm:text-lg font-semibold text-foreground tabular-nums">{stat.value}</p>
                    <p className="text-[10px] sm:text-[11px] text-muted mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                <Link href="/planner">
                  <Button className="w-full sm:w-auto h-10 px-5">
                    Plan My Trip
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link href="/explore">
                  <Button variant="secondary" className="w-full sm:w-auto h-10 px-5">
                    Explore Destinations
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-5 w-full shrink-0 sm:max-w-md lg:mt-0 lg:max-w-none lg:w-[360px] xl:w-[400px]">
              <div className="hero-glass p-5 sm:p-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted mb-1.5">Quick Plan</p>
                <h2 className="text-base font-semibold text-foreground mb-4">Pick a trip style</h2>
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  <QuickPlanChip icon={Mountain} label="City break" />
                  <QuickPlanChip icon={UtensilsCrossed} label="Food & culture" />
                  <QuickPlanChip icon={Palmtree} label="Beach escape" />
                  <QuickPlanChip icon={Users} label="Group trip" />
                </div>
                <Link href="/planner">
                  <Button className="w-full h-10 text-sm">
                    Start Planning
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickPlanChip({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <Link href="/planner" className="min-w-0">
      <div className="group flex h-full flex-col items-start gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 hover:border-border hover:bg-surface/80 transition-colors cursor-pointer">
        <Icon className="h-4 w-4 text-muted shrink-0 group-hover:text-foreground-secondary transition-colors" />
        <span className="text-xs font-medium text-foreground-secondary group-hover:text-foreground transition-colors leading-snug">
          {label}
        </span>
      </div>
    </Link>
  );
}

export function DestinationStripSection() {
  return (
    <section className="py-14 section-raised border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-title">Popular Destinations</h2>
          <Link href="/explore" className="subcontainer-link flex items-center gap-1">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <DestinationCarousel />
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  const steps = [
    {
      icon: Map,
      step: "01",
      title: "Tell us about your trip",
      description: "Destination, dates, budget, and how you like to travel.",
    },
    {
      icon: Sparkles,
      step: "02",
      title: "Get your personalized plan",
      description: "Neighborhoods, hotels, daily itinerary, and a budget breakdown.",
    },
    {
      icon: Compass,
      step: "03",
      title: "Book with confidence",
      description: "Use your plan to book stays, activities, and essentials.",
    },
  ];

  return (
    <section className="py-16 section-alt border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            How Blistrip Works
          </h2>
        </div>

        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="grid md:grid-cols-3 md:divide-x divide-border">
            {steps.map((step) => (
              <div
                key={step.title}
                className="flex gap-4 p-6 lg:p-8 transition-colors hover:bg-surface-hover/20 border-b border-border md:border-b-0 last:border-b-0"
              >
                <div className="flex flex-col items-center shrink-0">
                  <span className="subcontainer-meta mb-3">
                    {step.step}
                  </span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-muted border border-border-accent">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="min-w-0 pt-0.5">
                  <h3 className="subcontainer-title mb-1.5">{step.title}</h3>
                  <p className="subcontainer-body">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t border-border px-6 py-4 lg:px-8">
            <Link
              href="/about"
              className="subcontainer-link flex items-center gap-1"
            >
              Learn more <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function WhyBlistripSection() {
  const cards = [
    {
      icon: Target,
      title: "Built Around You",
      description: "Recommendations matched to your interests and pace — not generic lists.",
    },
    {
      icon: DollarSign,
      title: "Budget-Aware",
      description: "Realistic cost estimates that stay within what you want to spend.",
    },
    {
      icon: Layers,
      title: "More Than an Itinerary",
      description: "Neighborhoods, stays, food, transport, and tips in one plan.",
    },
    {
      icon: TrendingUp,
      title: "Travel Smarter",
      description: "Local favorites and neighborhoods that fit how you actually travel.",
    },
  ];

  return (
    <section className="py-16 section-base border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <p className="eyebrow mb-3">Why Blistrip</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Your budget. Your interests. Your pace.
          </h2>
          <p className="subcontainer-body max-w-xl mx-auto">
            One personalized trip plan built around what matters to you.
          </p>
        </div>

        <div className="rounded-2xl overflow-hidden border border-border">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
            {cards.map((card) => (
              <div key={card.title} className="bg-surface p-6 lg:p-7">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted border border-border mb-4">
                  <card.icon className="h-4 w-4 text-foreground-secondary" />
                </div>
                <h3 className="subcontainer-title mb-2">{card.title}</h3>
                <p className="subcontainer-body">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ExampleTripSection() {
  const trip = examplePragueTrip;

  return (
    <section className="py-20 section-alt border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <p className="eyebrow mb-3">Example Trip</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="text-destination">{trip.destination}</span>, {trip.country}
            </h2>
            <div className="flex flex-wrap gap-2 mb-6">
              <Badge variant="accent">{trip.duration} Days</Badge>
              <Badge variant="accent">${trip.estimatedBudget.toLocaleString()}</Badge>
              <Badge variant="secondary">{trip.interests.join(" + ")}</Badge>
            </div>
            <p className="subcontainer-body mb-6">{trip.tripSummary}</p>

            {/* Trip image */}
            <div className="relative h-48 rounded-xl overflow-hidden mb-6">
              <Image
                src={getDestinationImage("Prague", 800)}
                alt="Prague Old Town"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>

            <Link href="/planner?destination=Prague">
              <Button>
                Plan a Similar Trip
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {trip.dailyItinerary.map((day) => (
              <Card key={day.day} className="p-4 hover:border-border-accent transition-all">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent border border-accent/40 text-accent-text font-medium text-sm">
                    {day.day}
                  </div>
                  <div>
                    <h4 className="subcontainer-title mb-1">{day.title}</h4>
                    <div className="space-y-1 subcontainer-body text-muted">
                      <p><span className="text-primary/80 font-medium">AM</span> &middot; <span className="text-highlight">{day.morning[0]?.name}</span></p>
                      <p><span className="text-primary/80 font-medium">PM</span> &middot; <span className="text-highlight">{day.afternoon[0]?.name}</span></p>
                      <p><span className="text-primary/80 font-medium">EVE</span> &middot; <span className="text-highlight">{day.evening[0]?.name}</span></p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
export function CTASection() {
  return (
    <section className="py-10 section-raised border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-xl border border-border bg-surface flex flex-col sm:flex-row">
          <div className="relative h-32 sm:h-auto sm:w-44 md:w-52 shrink-0">
            <Image
              src={images.cta}
              alt="Scenic lake and mountains"
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 208px"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-transparent to-surface/20 sm:bg-gradient-to-r sm:from-transparent sm:to-surface/40"
            />
          </div>
          <div className="flex flex-1 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground">
                Ready to stop planning and start traveling?
              </h2>
              <p className="text-sm text-foreground-secondary mt-1">
                Tell us the trip you&apos;re dreaming about — we&apos;ll figure out the rest.
              </p>
            </div>
            <Link href="/planner" className="shrink-0">
              <Button className="w-full sm:w-auto">
                Build My Trip
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

