export function DataSourceBanner({ source }: { source: "mock" | "supabase" }) {
  if (source !== "mock") return null;
  return (
    <div
      role="status"
      className="flex items-start gap-2 border-b border-[var(--color-border)] bg-[var(--color-impact-med)] px-4 py-2 text-[11px] text-[var(--color-impact-med-fg)]"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mt-0.5 flex-shrink-0"
      >
        <path d="M8 1.5L1 14h14L8 1.5zM8 6v4M8 12h.01" />
      </svg>
      <span className="text-[var(--color-text)]">
        Showing mock data — Supabase env vars not set. Add them to{" "}
        <code className="rounded bg-[var(--color-surface)] px-1 font-mono text-[10px] text-[var(--color-text-dim)]">
          .env.local
        </code>{" "}
        and run the{" "}
        <code className="rounded bg-[var(--color-surface)] px-1 font-mono text-[10px] text-[var(--color-text-dim)]">
          pull-calendar
        </code>{" "}
        worker.
      </span>
    </div>
  );
}
