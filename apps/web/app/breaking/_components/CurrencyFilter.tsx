"use client";

export type CurrencyFilter = "all" | "USD" | "EUR" | "GBP" | "JPY" | "CHF" | "CAD" | "AUD";

interface Props {
  value: CurrencyFilter;
  onChange: (c: CurrencyFilter) => void;
}

const CURRENCIES: { id: CurrencyFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "USD", label: "USD" },
  { id: "EUR", label: "EUR" },
  { id: "GBP", label: "GBP" },
  { id: "JPY", label: "JPY" },
  { id: "CHF", label: "CHF" },
  { id: "CAD", label: "CAD" },
  { id: "AUD", label: "AUD" },
];

export function CurrencyFilterBar({ value, onChange }: Props) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] uppercase tracking-wider text-[var(--color-text-mute)]">
        Currency
      </span>
      {CURRENCIES.map(c => {
        const active = c.id === value;
        return (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            className={
              "rounded border px-2.5 py-1 font-mono text-[11px] tracking-wider transition-colors " +
              (active
                ? "border-amber-600 bg-amber-500 text-zinc-900"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-dim)] hover:text-zinc-900")
            }
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
