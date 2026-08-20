import Link from "next/link";
import { MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-section-alt mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-muted border border-border-accent">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <span className="text-lg font-semibold">Blistrip</span>
            </div>
            <p className="text-sm text-foreground-secondary max-w-sm leading-relaxed">
              Tell us the trip you&apos;re dreaming about. We&apos;ll figure out the rest.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4">Product</h4>
            <ul className="space-y-2.5 text-sm text-foreground-secondary">
              <li><Link href="/planner" className="hover:text-primary transition-colors">Plan a Trip</Link></li>
              <li><Link href="/explore" className="hover:text-primary transition-colors">Explore</Link></li>
              <li><Link href="/saved" className="hover:text-primary transition-colors">Saved Trips</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm text-foreground-secondary">
              <li><Link href="/about" className="hover:text-primary transition-colors">How It Works</Link></li>
              <li><Link href="/profile" className="hover:text-primary transition-colors">Profile</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted">&copy; {new Date().getFullYear()} Blistrip. All rights reserved.</p>
          <p className="text-xs text-muted">Prices shown are estimates, not live availability.</p>
        </div>
      </div>
    </footer>
  );
}
