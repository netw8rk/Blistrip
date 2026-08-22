"use client";

import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  showLabel?: boolean;
}

export function Progress({ value, className, showLabel }: ProgressProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-muted text-right">{Math.round(value)}%</p>
      )}
    </div>
  );
}

interface BudgetBarProps {
  label: string;
  amount: number;
  total: number;
  color?: string;
}

export function BudgetBar({ label, amount, total, color = "bg-primary" }: BudgetBarProps) {
  const percentage = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-base">
        <span className="text-foreground-secondary">{label}</span>
        <span className="font-medium">${amount.toLocaleString()}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
