"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function EmptyState() {
  const params = useSearchParams();
  const hasAnyFilter =
    !!params.get("currency") || !!params.get("impact") || !!params.get("q");

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-center">
      <div
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-hi)] text-[var(--color-text-mute)]"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 3v4M16 3v4M9 14l6 4M15 14l-6 4" />
        </svg>
      </div>
      <p className="text-[14px] font-medium text-[var(--color-text)]">
        No events match these filters
      </p>
      <p className="max-w-[360px] text-[12px] text-[var(--color-text-dim)]">
        Try widening the range or clearing one of the active filters.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {hasAnyFilter && (
          <Link
            href="/calendar"
            className="rounded-full bg-[var(--color-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            Clear filters
          </Link>
        )}
        <Link
          href="/calendar?range=week"
          className="rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-hi)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          Show this week
        </Link>
      </div>
    </div>
  );
}
