"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD"] as const;
const IMPACTS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;
const RANGES = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "next", label: "Next week" },
  { value: "next2", label: "+2 wks" },
  { value: "next3", label: "+3 wks" },
  { value: "month", label: "4 wks" },
] as const;

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [query, setQuery] = useState(params.get("q") ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      const trimmed = query.trim();
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      if (next.toString() !== params.toString()) {
        router.replace(`${pathname}?${next.toString()}`);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function toggle(key: string, value: string) {
    const current = new Set((params.get(key) ?? "").split(",").filter(Boolean));
    if (current.has(value)) current.delete(value);
    else current.add(value);
    const next = new URLSearchParams(params.toString());
    if (current.size > 0) next.set(key, Array.from(current).join(","));
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  function setRange(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("range", value);
    router.replace(`${pathname}?${next.toString()}`);
  }

  const selectedCurrencies = new Set((params.get("currency") ?? "").split(",").filter(Boolean));
  const selectedImpacts = new Set((params.get("impact") ?? "").split(",").filter(Boolean));
  const range = params.get("range") ?? "week";

  return (
    <div className="sticky top-[52px] z-[15] flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[12px]">
      <div className="flex items-center gap-1 lg:hidden">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`rounded px-2 py-1 transition-colors ${
              range === r.value
                ? "bg-[var(--color-accent-soft)] font-medium text-[var(--color-text)]"
                : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mx-1 hidden h-4 w-px bg-[var(--color-border)] lg:hidden" />

      <div className="flex items-center gap-1">
        <span className="mr-1 text-[10px] uppercase tracking-wider text-[var(--color-text-mute)]">Currency</span>
        {CURRENCIES.map((c) => {
          const active = selectedCurrencies.size === 0 || selectedCurrencies.has(c);
          return (
            <button
              key={c}
              onClick={() => toggle("currency", c)}
              aria-pressed={selectedCurrencies.has(c)}
              className={`rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors ${
                active
                  ? "border-[var(--color-border-strong)] bg-[var(--color-surface-hi)] text-[var(--color-text)]"
                  : "border-transparent text-[var(--color-text-mute)] hover:bg-[var(--color-surface-hi)] hover:text-[var(--color-text-dim)]"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      <div className="mx-1 h-4 w-px bg-[var(--color-border)]" />

      <div className="flex items-center gap-1">
        <span className="mr-1 text-[10px] uppercase tracking-wider text-[var(--color-text-mute)]">Impact</span>
        {IMPACTS.map((i) => {
          const active = selectedImpacts.size === 0 || selectedImpacts.has(i.value);
          return (
            <button
              key={i.value}
              onClick={() => toggle("impact", i.value)}
              aria-pressed={selectedImpacts.has(i.value)}
              className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] transition-colors ${
                active
                  ? "border-[var(--color-border-strong)] bg-[var(--color-surface-hi)] text-[var(--color-text)]"
                  : "border-transparent text-[var(--color-text-mute)] hover:bg-[var(--color-surface-hi)] hover:text-[var(--color-text-dim)]"
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  i.value === "high"
                    ? "bg-[var(--color-impact-high-fg)]"
                    : i.value === "medium"
                      ? "bg-[var(--color-impact-med-fg)]"
                      : "bg-[var(--color-impact-low-fg)]"
                }`}
              />
              {i.label}
            </button>
          );
        })}
      </div>

      <label htmlFor="calendar-search" className="sr-only">
        Search events by title
      </label>
      <input
        id="calendar-search"
        type="search"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        aria-label="Search events by title"
        placeholder="Search events…  /"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setQuery("");
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="ml-auto w-[200px] rounded border border-[var(--color-border)] bg-[var(--color-surface-hi)] px-2 py-1 text-[12px] placeholder:text-[var(--color-text-mute)] focus-visible:border-[var(--color-accent)] focus-visible:outline-none"
      />

      <span className="hidden text-[10px] text-[var(--color-text-mute)] xl:inline">
        <kbd className="font-mono">/</kbd> search · <kbd className="font-mono">j</kbd>/<kbd className="font-mono">k</kbd> nav · <kbd className="font-mono">?</kbd> help
      </span>
    </div>
  );
}
