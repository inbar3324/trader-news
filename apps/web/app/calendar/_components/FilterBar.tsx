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
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[12px]">
      <div className="flex items-center gap-1">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`rounded px-2 py-1 ${
              range === r.value
                ? "bg-[var(--color-surface-hi)] text-[var(--color-text)]"
                : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mx-1 h-4 w-px bg-[var(--color-border)]" />

      <div className="flex items-center gap-1">
        <span className="mr-1 text-[var(--color-text-mute)]">Currency:</span>
        {CURRENCIES.map((c) => (
          <button
            key={c}
            onClick={() => toggle("currency", c)}
            className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
              selectedCurrencies.size === 0 || selectedCurrencies.has(c)
                ? "bg-[var(--color-surface-hi)] text-[var(--color-text)]"
                : "text-[var(--color-text-mute)] hover:text-[var(--color-text-dim)]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mx-1 h-4 w-px bg-[var(--color-border)]" />

      <div className="flex items-center gap-1">
        <span className="mr-1 text-[var(--color-text-mute)]">Impact:</span>
        {IMPACTS.map((i) => (
          <button
            key={i.value}
            onClick={() => toggle("impact", i.value)}
            className={`rounded px-1.5 py-0.5 text-[11px] ${
              selectedImpacts.size === 0 || selectedImpacts.has(i.value)
                ? "bg-[var(--color-surface-hi)] text-[var(--color-text)]"
                : "text-[var(--color-text-mute)] hover:text-[var(--color-text-dim)]"
            }`}
          >
            {i.label}
          </button>
        ))}
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

      <span className="hidden text-[10px] text-[var(--color-text-mute)] md:inline">
        / search • j/k nav • Enter open
      </span>
    </div>
  );
}
