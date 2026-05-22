import type { ImpactLevel, UnitLabel } from "./types";

const NY_TZ = "America/New_York";

export function formatTimeNY(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    timeZone: NY_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDayHeaderNY(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    timeZone: NY_TZ,
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function ymdNY(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: NY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function impactRowClass(impact: ImpactLevel): string {
  switch (impact) {
    case "high":
      return "row-high";
    case "medium":
      return "row-med";
    default:
      return "";
  }
}

export function impactDotColor(impact: ImpactLevel): string {
  switch (impact) {
    case "high":
      return "bg-[var(--color-impact-high-fg)]";
    case "medium":
      return "bg-[var(--color-impact-med-fg)]";
    case "low":
      return "bg-[var(--color-impact-low-fg)]";
    case "holiday":
      return "bg-sky-500";
  }
}

export function impactLabel(impact: ImpactLevel): string {
  switch (impact) {
    case "high":
      return "High impact";
    case "medium":
      return "Medium impact";
    case "low":
      return "Low impact";
    case "holiday":
      return "Holiday";
  }
}

export function deltaDirection(
  actual: number | null,
  forecast: number | null,
): "pos" | "neg" | "flat" | null {
  if (actual === null || forecast === null) return null;
  if (actual > forecast) return "pos";
  if (actual < forecast) return "neg";
  return "flat";
}

export function formatNumber(n: number | null, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatMove(value: number, unit: UnitLabel, pipSize?: number | null): string {
  if (unit === "percent") return `${(value * 100).toFixed(2)}%`;
  if (unit === "pips" && pipSize) return `${(value / pipSize).toFixed(1)} pips`;
  if (unit === "points") return `${value.toFixed(2)} pts`;
  return value.toString();
}
