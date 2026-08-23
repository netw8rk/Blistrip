"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DestinationSuggestion } from "@/lib/travel/suggest-places";

interface DestinationPickerProps {
  value: string;
  selected: boolean;
  selectedLabel?: string;
  onQueryChange: (value: string) => void;
  onSelect: (suggestion: DestinationSuggestion) => void;
  autoFocus?: boolean;
}

export function DestinationPicker({
  value,
  selected,
  selectedLabel,
  onQueryChange,
  onSelect,
  autoFocus,
}: DestinationPickerProps) {
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listId = useId();

  useEffect(() => {
    const query = value.trim();
    if (selected || query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const res = await fetch(`/api/places/suggest?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { suggestions?: DestinationSuggestion[] };
        const next = data.suggestions ?? [];
        setSuggestions(next);
        setHighlight(0);
        setOpen(next.length > 0);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [value, selected]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function pick(suggestion: DestinationSuggestion) {
    onSelect(suggestion);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border transition-all duration-200",
          selected
            ? "border-border-accent bg-primary-muted/20 shadow-[0_0_0_1px_rgba(169,149,214,0.12)]"
            : "border-border/60 bg-background/60 hover:border-border hover:bg-background/80"
        )}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Start typing a city, then pick it from the list"
          value={selected ? selectedLabel || value : value}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => {
            if (!selected && suggestions.length > 0) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (!open || suggestions.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlight((index) => (index + 1) % suggestions.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlight((index) => (index - 1 + suggestions.length) % suggestions.length);
            } else if (event.key === "Enter") {
              event.preventDefault();
              pick(suggestions[highlight]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className="h-12 rounded-xl border-0 bg-transparent pl-11 pr-11 shadow-none focus-visible:ring-0"
          autoComplete="off"
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
        />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted animate-spin" />
        )}
        {selected && !loading && (
          <Check className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-border/70 bg-surface/95 p-1 shadow-[0_20px_50px_-24px_rgba(42,36,28,0.45)] backdrop-blur-md"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.id} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3.5 py-3 text-left text-sm transition-colors",
                  index === highlight
                    ? "bg-primary-muted text-foreground"
                    : "text-foreground-secondary hover:bg-surface-hover"
                )}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pick(suggestion)}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                <span>{suggestion.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && selectedLabel && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/40 px-3 py-1 text-xs text-foreground-secondary">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          We&apos;ll search around{" "}
          <span className="font-medium text-foreground">{selectedLabel}</span>
        </p>
      )}
      {!selected && value.trim().length >= 2 && !loading && suggestions.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          No matching places yet. Try a city name, then pick one from the list.
        </p>
      )}
    </div>
  );
}
