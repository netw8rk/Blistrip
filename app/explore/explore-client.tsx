"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { destinations } from "@/lib/destinations";
import { track } from "@/lib/analytics";

export default function ExplorePage() {
  const handleDestinationClick = (name: string) => {
    track("destination_clicked", { destination: name });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <p className="eyebrow mb-3">Destinations</p>
        <h1 className="text-3xl sm:text-4xl font-bold mb-4">Where should you go?</h1>
        <p className="text-foreground-secondary max-w-xl mx-auto">
          Browse popular destinations or let us help you decide based on your preferences.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {destinations.map((dest) => (
          <Card
            key={dest.id}
            className="overflow-hidden group hover:border-border-accent transition-all duration-300"
          >
            <div className="relative h-52 overflow-hidden">
              <Image
                src={dest.imageUrl}
                alt={`${dest.name}, ${dest.country}`}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4">
                <h3 className="text-xl font-bold text-accent">{dest.name}</h3>
                <p className="text-sm text-white/75">{dest.country}</p>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-foreground-secondary mb-4 leading-relaxed">{dest.description}</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {dest.bestFor.map((tag) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-stat">
                  <MapPin className="h-3 w-3" />
                  {dest.typicalBudget}
                </div>
                <Link
                  href={`/planner?destination=${encodeURIComponent(dest.name)}`}
                  onClick={() => handleDestinationClick(dest.name)}
                >
                  <Button size="sm">
                    Plan This Trip
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
