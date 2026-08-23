import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Sparkles,
  UserRoundCheck,
  CircleDollarSign,
  Layers3,
  Binoculars,
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

function SectionHeader({
  title,
  subtitle,
}: {
  title: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto mb-6 max-w-2xl text-center lg:mb-8">
      <div className="mx-auto mb-3 flex items-center justify-center gap-3">
        <span aria-hidden className="h-px w-10 bg-gradient-to-r from-transparent to-primary/45" />
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary/60" />
        <span aria-hidden className="h-px w-10 bg-gradient-to-l from-transparent to-primary/45" />
      </div>
      <h2 className="text-2xl sm:text-3xl lg:text-[calc(2rem+1pt)] font-semibold tracking-tight text-foreground leading-[1.15]">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 text-sm sm:text-[16px] text-foreground-secondary leading-relaxed">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="section-base">
      <div className="mx-auto max-w-[86rem] px-4 sm:px-5 lg:px-6 py-6 lg:py-8">
        <div className="relative overflow-hidden rounded-2xl border border-border shadow-sm animate-slide-up min-h-[520px] sm:min-h-[540px] lg:min-h-[580px] max-h-[680px]">
          <Image
            src={images.hero}
            alt="Eiffel Tower and Paris skyline"
            fill
            className="object-cover object-[65%_center] sm:object-[70%_center]"
            priority
            sizes="(max-width: 1376px) 100vw, 1376px"
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

          <span className="absolute left-5 top-5 z-20 inline-flex w-fit items-center gap-1.5 rounded-full border border-border/80 bg-surface/75 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-md sm:left-6 sm:top-6 sm:text-[14px] lg:left-8 lg:top-8">
            <Sparkles className="h-3.5 w-3.5 text-foreground" />
            AI-powered travel planning
          </span>

          <div className="relative z-10 flex h-full min-h-[520px] sm:min-h-[540px] lg:min-h-[580px] flex-col justify-end p-5 sm:p-6 lg:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
            <div className="flex max-w-md shrink-0 flex-col gap-5 sm:gap-6 lg:max-w-lg">
              <div>
                <h1 className="mb-2 text-2xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                  Your trip,
                  <br />
                  <span className="text-gradient">planned in minutes.</span>
                </h1>
                <p className="max-w-sm text-base leading-snug text-foreground sm:text-lg">
                  Budget, dates, vibe — tell Blistrip what matters and get a full itinerary built around you.
                </p>
              </div>

              <div className="flex max-w-sm items-center gap-4 sm:gap-6">
                {[
                  { value: "8", label: "Step planner" },
                  { value: "10+", label: "Destinations" },
                  { value: "60s", label: "To your plan" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-base sm:text-lg font-semibold text-foreground tabular-nums">{stat.value}</p>
                    <p className="text-[11px] sm:text-[12px] text-muted mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row">
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

            <div className="mt-5 w-full shrink-0 sm:max-w-md lg:mt-0 lg:max-w-none lg:w-[400px] xl:w-[440px]">
              <div className="hero-glass p-6 sm:p-7">
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">Quick Plan</p>
                <h2 className="mb-5 text-lg font-semibold text-foreground">Pick a trip style</h2>
                <div className="mb-5 grid grid-cols-2 gap-3">
                  <QuickPlanChip icon={Mountain} label="City break" />
                  <QuickPlanChip icon={UtensilsCrossed} label="Food & culture" />
                  <QuickPlanChip icon={Palmtree} label="Beach escape" />
                  <QuickPlanChip icon={Users} label="Group trip" />
                </div>
                <Link href="/planner">
                  <Button className="h-11 w-full text-base">
                    Start Planning
                    <ArrowRight className="h-4 w-4" />
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
      <div className="group flex h-full cursor-pointer flex-col items-start gap-2 rounded-lg border border-border/60 bg-background/60 px-3.5 py-3 transition-colors hover:border-border hover:bg-surface/80">
        <Icon className="h-5 w-5 shrink-0 text-muted transition-colors group-hover:text-foreground-secondary" />
        <span className="text-sm font-medium leading-snug text-foreground-secondary transition-colors group-hover:text-foreground">
          {label}
        </span>
      </div>
    </Link>
  );
}

export function DestinationStripSection() {
  return (
    <section className="py-14 section-raised border-t border-border">
      <div className="mx-auto max-w-[84rem] px-4 sm:px-6 lg:px-8">
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
      step: "01",
      title: "Tell us about your trip",
      description: "Destination, dates, budget, and how you like to travel.",
      image: images.howItWorks.plan,
      alt: "Man with a backpack standing on a rock formation while traveling",
    },
    {
      step: "02",
      title: "Get your personalized plan",
      description: "Neighborhoods, hotels, daily itinerary, and a budget breakdown.",
      image: images.howItWorks.personalize,
      alt: "Wooden boats on a blue lake surrounded by mountains",
    },
    {
      step: "03",
      title: "Book with confidence",
      description: "Use your plan to book stays, activities, and essentials.",
      image: images.howItWorks.book,
      alt: "Airplane flying through a golden sunset sky",
    },
  ];

  return (
    <section className="py-10 lg:py-12 section-alt border-t border-border">
      <div className="mx-auto max-w-[84rem] px-4 sm:px-6 lg:px-8">
        <SectionHeader title="How Blistrip Works" />

        <div className="grid md:grid-cols-3 gap-4 lg:gap-5">
          {steps.map((step) => (
            <div key={step.title} className="group flex flex-col">
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border mb-3">
                <Image
                  src={step.image}
                  alt={step.alt}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-foreground/35 via-transparent to-transparent"
                />
                <span className="absolute top-3 left-3 inline-flex items-center rounded-full border border-white/30 bg-background/85 px-2.5 py-1 text-[12px] font-semibold tracking-[0.12em] text-foreground backdrop-blur-sm">
                  {step.step}
                </span>
              </div>
              <h3 className="subcontainer-title mb-1">{step.title}</h3>
              <p className="subcontainer-body text-[14px] leading-snug">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-center sm:justify-end">
          <Link href="/about" className="subcontainer-link flex items-center gap-1">
            Learn more <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function WhyBlistripSection() {
  const features = [
    {
      icon: UserRoundCheck,
      title: "Built Around You",
      description: "Recommendations matched to your interests and pace — not generic lists.",
    },
    {
      icon: CircleDollarSign,
      title: "Budget-Aware",
      description: "Realistic costs based on how you actually want to spend.",
    },
    {
      icon: Layers3,
      title: "More Than an Itinerary",
      description: "Stays, neighborhoods, food, and experiences in one plan.",
    },
    {
      icon: Binoculars,
      title: "Travel Smarter",
      description: "Local picks that fit the way you actually travel.",
    },
  ];

  return (
    <section className="border-t border-border section-raised py-10 lg:py-12">
      <div className="mx-auto max-w-[84rem] px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-xl lg:mb-9">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-foreground font-sub sm:text-[14px]">
            Why Blistrip
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl leading-[1.15]">
            Travel planning that actually feels like yours.
          </h2>
        </div>

        <div className="border-t border-border">
          <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="py-6 sm:px-6 sm:py-7 lg:px-7 lg:py-6 first:sm:pl-0 last:sm:pr-0 lg:first:pl-0 lg:last:pr-0"
              >
                <feature.icon
                  className="mb-3 h-4 w-4 text-muted"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <h3 className="subcontainer-title mb-1.5">{feature.title}</h3>
                <p className="subcontainer-body max-w-[16rem] text-[14px] leading-snug">
                  {feature.description}
                </p>
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
    <section className="py-20 section-base border-t border-border">
      <div className="mx-auto max-w-[84rem] px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-foreground font-sub sm:text-[14px]">
              Example Trip
            </p>
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
            <div className="relative mb-6 h-72 w-full overflow-hidden rounded-xl sm:h-80">
              <Image
                src={getDestinationImage("Prague", 800)}
                alt="Charles Bridge and Prague Castle at golden hour"
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
                      <p><span className="font-medium text-foreground-secondary">AM</span> &middot; <span className="text-highlight">{day.morning[0]?.name}</span></p>
                      <p><span className="font-medium text-foreground-secondary">PM</span> &middot; <span className="text-highlight">{day.afternoon[0]?.name}</span></p>
                      <p><span className="font-medium text-foreground-secondary">EVE</span> &middot; <span className="text-highlight">{day.evening[0]?.name}</span></p>
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
      <div className="mx-auto max-w-[84rem] px-4 sm:px-6 lg:px-8">
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

