"use client";
import { useEffect, useState } from "react";
import {
  DEFAULT_DENSITY,
  getStoredDensity,
  setStoredDensity,
  type Density,
} from "@/lib/theme";

const OPTIONS: ReadonlyArray<Density> = ["compact", "cozy", "relaxed"];

export function DensityToggle() {
  const [density, setDensity] = useState<Density>(DEFAULT_DENSITY);

  useEffect(() => {
    setDensity(getStoredDensity());
  }, []);

  function apply(next: Density) {
    setDensity(next);
    setStoredDensity(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Table density"
      className="flex items-center gap-0.5 rounded border border-[var(--color-border)] bg-[var(--color-surface-hi)] p-0.5"
    >
      {OPTIONS.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={density === d}
          onClick={() => apply(d)}
          className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--color-accent)] ${
            density === d
              ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[0_1px_0_rgba(0,0,0,0.04)]"
              : "text-[var(--color-text-mute)] hover:text-[var(--color-text-dim)]"
          }`}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
