"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/stays-flights", label: "Stays/Flights" },
  { href: "/explore", label: "Explore" },
  { href: "/deals", label: "Deals" },
  { href: "/saved", label: "Saved Trips" },
];

function linkActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavActions({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-[var(--radius-button)] border border-primary/40",
        "shadow-[0_0_20px_-4px_rgba(169,149,214,0.35)]"
      )}
    >
      <Link href="/planner" onClick={onNavigate}>
        <Button
          size="sm"
          className="h-8 rounded-none border-r border-primary/30 shadow-none font-bold"
        >
          Plan My Trip
        </Button>
      </Link>
      <Link
        href="/profile"
        onClick={onNavigate}
        className={cn(
          "inline-flex h-8 items-center bg-primary-muted/75 px-3.5 text-xs font-bold text-foreground backdrop-blur-sm transition-colors hover:bg-primary-muted",
          linkActive(pathname, "/profile") && "bg-primary-muted"
        )}
      >
        Profile
      </Link>
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-[84rem] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        <div className="hidden lg:flex items-center gap-1.5">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3.5 py-2.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap",
                linkActive(pathname, link.href)
                  ? "text-primary bg-primary-muted"
                  : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden lg:flex items-center">
          <NavActions pathname={pathname} />
        </div>

        <button
          className="lg:hidden rounded-lg p-2 text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="lg:hidden border-t border-border bg-surface animate-slide-up">
          <div className="flex flex-col gap-1.5 p-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "px-4 py-3.5 text-sm font-bold rounded-lg transition-colors",
                  linkActive(pathname, link.href)
                    ? "text-primary bg-primary-muted"
                    : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 px-4">
              <NavActions pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
