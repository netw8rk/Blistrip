import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "accent" | "secondary" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
        variant === "default" && "bg-primary-muted text-primary",
        variant === "accent" && "bg-accent text-accent-text border border-accent/40",
        variant === "secondary" && "bg-surface-hover text-foreground-secondary border border-border",
        variant === "outline" && "border border-border text-muted",
        className
      )}
      {...props}
    />
  );
}
