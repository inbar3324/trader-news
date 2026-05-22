"use client";
import { useEffect, useState } from "react";

export function CommandPaletteTrigger({ onOpen }: { onOpen?: () => void }) {
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform));
  }, []);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open command palette"
      className="group flex h-7 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hi)] pl-2 pr-1.5 text-[12px] text-[var(--color-text-mute)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-dim)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--color-accent)]"
    >
      <SearchIcon />
      <span className="hidden md:inline">Search</span>
      <kbd className="ml-1 flex h-4 items-center rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 font-mono text-[10px] text-[var(--color-text-mute)]">
        {isMac ? "⌘K" : "Ctrl+K"}
      </kbd>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5l3 3" />
    </svg>
  );
}
