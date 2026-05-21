"use client";

export type FilterMode = "all" | "impact5" | "macro";

interface Props {
  mode: FilterMode;
  onChange: (m: FilterMode) => void;
  total: number;
  shown: number;
}

const TABS: { id: FilterMode; label: string }[] = [
  { id: "impact5", label: "Impact 5+" },
  { id: "macro",   label: "Fed / macro only" },
  { id: "all",     label: "All" },
];

export function FilterControls({ mode, onChange, total, shown }: Props) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <div className="inline-flex rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
        {TABS.map(t => {
          const active = t.id === mode;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={
                "rounded px-3 py-1 text-[12px] transition-colors " +
                (active
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-[var(--color-text-dim)] hover:text-zinc-100")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <span className="font-mono text-[11px] text-[var(--color-text-mute)]">
        showing {shown} / {total}
      </span>
    </div>
  );
}
