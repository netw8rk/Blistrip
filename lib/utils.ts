import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function parseBudgetRange(budget: string, customBudget?: number): number {
  if (budget === "custom" && customBudget) return customBudget;
  const map: Record<string, number> = {
    "<$500": 450,
    "$500–$1,000": 750,
    "$1,000–$2,000": 1500,
    "$2,000–$4,000": 3000,
    "$4,000+": 5000,
  };
  return map[budget] ?? 1500;
}

export function calculateDuration(startDate?: string, endDate?: string, flexible?: boolean): number {
  if (flexible || !startDate || !endDate) return 5;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}
