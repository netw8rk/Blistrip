"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptionCard } from "@/components/ui/option-card";
import { INTEREST_META, PACE_META, STYLE_META } from "@/lib/preference-meta";
import { cn } from "@/lib/utils";
import {
  BUDGET_OPTIONS,
  DEFAULT_USER_PREFERENCES,
  INTEREST_OPTIONS,
  PACE_OPTIONS,
  TRAVEL_STYLE_OPTIONS,
  type UserPreferences,
} from "@/types/trip";

interface PreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: UserPreferences;
  onChange: (prefs: UserPreferences) => void;
  onSave: () => void;
}

export function PreferencesDialog({ open, onOpenChange, prefs, onChange, onSave }: PreferencesDialogProps) {
  const updatePref = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    onChange({ ...prefs, [key]: value });
  };

  const toggleActivity = (activity: string) => {
    onChange({
      ...prefs,
      favoriteActivities: prefs.favoriteActivities.includes(activity)
        ? prefs.favoriteActivities.filter((item) => item !== activity)
        : [...prefs.favoriteActivities, activity],
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[min(90vh,760px)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl data-[state=open]:animate-slide-up focus:outline-none"
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-6">
            <div>
              <Dialog.Title className="text-lg font-semibold text-foreground">Travel preferences</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-foreground-secondary">
                Defaults for new trips in the planner.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-lg p-1 text-muted transition-colors hover:bg-surface-hover hover:text-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <div className="space-y-8 overflow-y-auto px-5 py-6 sm:px-6">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground">Travel style</h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {TRAVEL_STYLE_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt}
                    selected={prefs.travelStyle === opt}
                    onClick={() => updatePref("travelStyle", opt)}
                    icon={STYLE_META[opt].icon}
                    label={opt}
                    hint={STYLE_META[opt].hint}
                  />
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground">Nightly stay budget</h3>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {BUDGET_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt}
                    selected={prefs.budgetPreference === opt}
                    onClick={() => updatePref("budgetPreference", opt)}
                    label={opt}
                    compact
                    className="justify-center py-3 [&>span]:flex-none"
                  />
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground">Interests</h3>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {INTEREST_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt}
                    selected={prefs.favoriteActivities.includes(opt)}
                    onClick={() => toggleActivity(opt)}
                    icon={INTEREST_META[opt]}
                    label={opt}
                    compact
                  />
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground">Pace</h3>
              <div className="grid grid-cols-1 gap-2.5">
                {PACE_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt}
                    selected={prefs.preferredPace === opt}
                    onClick={() => updatePref("preferredPace", opt)}
                    icon={PACE_META[opt].icon}
                    label={opt}
                    hint={PACE_META[opt].hint}
                  />
                ))}
              </div>
            </section>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/70 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => onChange(DEFAULT_USER_PREFERENCES)}
              className="text-sm font-medium text-muted transition-colors hover:text-foreground-secondary"
            >
              Reset defaults
            </button>
            <Button
              onClick={() => {
                onSave();
                onOpenChange(false);
              }}
            >
              Save preferences
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
