"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getUserPreferences, saveUserPreferences } from "@/lib/storage";
import {
  BUDGET_OPTIONS,
  INTEREST_OPTIONS,
  PACE_OPTIONS,
  TRAVEL_STYLE_OPTIONS,
  type UserPreferences,
} from "@/types/trip";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export default function ProfileClient() {
  const [prefs, setPrefs] = useState<UserPreferences>({
    travelStyle: "Comfortable",
    budgetPreference: "$1,000–$2,000",
    favoriteActivities: [],
    preferredPace: "Balanced",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPrefs(getUserPreferences());
  }, []);

  const toggleActivity = (activity: string) => {
    setPrefs((prev) => ({
      ...prev,
      favoriteActivities: prev.favoriteActivities.includes(activity)
        ? prev.favoriteActivities.filter((a) => a !== activity)
        : [...prev.favoriteActivities, activity],
    }));
    setSaved(false);
  };

  const handleSave = () => {
    saveUserPreferences(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <p className="eyebrow mb-2">Preferences</p>
      <h1 className="text-3xl font-bold mb-2">Your Profile</h1>
      <p className="text-foreground-secondary mb-8">
        Set your travel preferences to personalize future trip plans.
      </p>

      <div className="space-y-8">
        <section>
          <h2 className="font-semibold mb-3">Travel Style</h2>
          <div className="grid grid-cols-2 gap-2">
            {TRAVEL_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { setPrefs((p) => ({ ...p, travelStyle: opt })); setSaved(false); }}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm text-left transition-colors",
                  prefs.travelStyle === opt
                    ? "border-border-accent bg-primary-muted text-primary"
                    : "border-border bg-surface-elevated hover:border-border-accent"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-3">Budget Preference</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {BUDGET_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { setPrefs((p) => ({ ...p, budgetPreference: opt })); setSaved(false); }}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm text-left transition-colors",
                  prefs.budgetPreference === opt
                    ? "border-border-accent bg-primary-muted text-primary"
                    : "border-border bg-surface-elevated hover:border-border-accent"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-3">Favorite Activities</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {INTEREST_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => toggleActivity(opt)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm text-left transition-colors flex items-center justify-between",
                  prefs.favoriteActivities.includes(opt)
                    ? "border-border-accent bg-primary-muted text-primary"
                    : "border-border bg-surface-elevated hover:border-border-accent"
                )}
              >
                {opt}
                {prefs.favoriteActivities.includes(opt) && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-3">Preferred Pace</h2>
          <div className="grid grid-cols-1 gap-2">
            {PACE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { setPrefs((p) => ({ ...p, preferredPace: opt })); setSaved(false); }}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm text-left transition-colors",
                  prefs.preferredPace === opt
                    ? "border-border-accent bg-primary-muted text-primary"
                    : "border-border bg-surface-elevated hover:border-border-accent"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </section>

        <Card className="p-4 bg-surface-elevated border-border">
          <p className="text-sm text-foreground-secondary">
            Account authentication coming soon. Your preferences are saved locally on this device.
          </p>
        </Card>

        <Button onClick={handleSave} className="w-full sm:w-auto">
          {saved ? "Saved!" : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
}
