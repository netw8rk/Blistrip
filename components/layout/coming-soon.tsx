import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ComingSoon({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary-glow/80 to-transparent"
      />
      <div className="relative mx-auto flex max-w-2xl items-center px-4 py-16 sm:py-24">
        <div className="hero-glass w-full px-6 py-12 text-center sm:px-10 sm:py-16">
          <p className="eyebrow mb-4">{eyebrow}</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-foreground-secondary sm:text-[15px]">
            {description}
          </p>
          <Link href="/planner" className="mt-8 inline-flex">
            <Button>
              Plan a trip
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
