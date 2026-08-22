"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/planner", label: "Plan a Trip" },
  { href: "/explore", label: "Explore" },
  { href: "/saved", label: "Saved Trips" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-[84rem] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                pathname === link.href || pathname.startsWith(link.href + "/")
                  ? "text-primary bg-primary-muted"
                  : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/profile">
            <Button variant="ghost" size="sm">
              Profile
            </Button>
          </Link>
          <Link href="/planner">
            <Button size="sm">Plan My Trip</Button>
          </Link>
        </div>

        <button
          className="md:hidden rounded-lg p-2 text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-surface animate-slide-up">
          <div className="flex flex-col gap-1 p-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                  pathname === link.href
                    ? "text-primary bg-primary-muted"
                    : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/profile" onClick={() => setMobileOpen(false)}>
              <span className="block px-4 py-3 text-sm font-medium text-foreground-secondary hover:text-foreground hover:bg-surface-hover rounded-lg">
                Profile
              </span>
            </Link>
            <Link href="/planner" onClick={() => setMobileOpen(false)} className="mt-2">
              <Button className="w-full">Plan My Trip</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
