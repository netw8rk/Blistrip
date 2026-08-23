import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function OptionCard({
  selected,
  onClick,
  icon: Icon,
  label,
  hint,
  compact,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: LucideIcon;
  label: string;
  hint?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group relative flex w-full text-left transition-all duration-200 rounded-xl border",
        compact ? "items-center gap-2.5 px-3 py-2.5" : "items-start gap-3 px-3.5 py-3",
        selected
          ? "border-border-accent bg-primary-muted shadow-[0_0_0_1px_rgba(169,149,214,0.2)]"
          : "border-border/70 bg-background/60 hover:border-border hover:bg-surface/80",
        className
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg border transition-colors",
            compact ? "h-7 w-7" : "mt-0.5 h-8 w-8",
            selected
              ? "border-border-accent bg-background/70 text-primary"
              : "border-border/60 bg-background/50 text-muted group-hover:text-foreground-secondary"
          )}
        >
          <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm font-medium leading-snug",
            selected ? "text-foreground" : "text-foreground-secondary"
          )}
        >
          {label}
        </span>
        {hint ? <span className="mt-0.5 block text-xs text-muted leading-snug">{hint}</span> : null}
      </span>
      {!compact ? (
        <Check
          className={cn(
            "mt-1 h-4 w-4 shrink-0 transition-opacity",
            selected ? "text-primary opacity-100" : "opacity-0"
          )}
        />
      ) : null}
    </button>
  );
}
