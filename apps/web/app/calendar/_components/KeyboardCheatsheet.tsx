"use client";
import { useEffect } from "react";

const ROWS: ReadonlyArray<{ keys: string[]; label: string }> = [
  { keys: ["j", "↓"], label: "Next event" },
  { keys: ["k", "↑"], label: "Previous event" },
  { keys: ["Shift+J"], label: "Jump to next day" },
  { keys: ["Shift+K"], label: "Jump to previous day" },
  { keys: ["Enter"], label: "Open event details" },
  { keys: ["/"], label: "Focus search" },
  { keys: ["⌘K"], label: "Open command palette" },
  { keys: ["g", "t"], label: "Go to today" },
  { keys: ["g", "w"], label: "Go to this week" },
  { keys: ["g", "n"], label: "Go to next week" },
  { keys: ["d"], label: "Cycle table density" },
  { keys: ["t"], label: "Toggle light / dark theme" },
  { keys: ["?"], label: "Show this help" },
  { keys: ["Esc"], label: "Close / clear selection" },
];

export function KeyboardCheatsheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cheatsheet-title"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close keyboard shortcuts"
        onClick={onClose}
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-[440px] overflow-hidden rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[0_24px_48px_rgba(40,38,32,0.18)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2
            id="cheatsheet-title"
            className="text-[13px] font-semibold text-[var(--color-text)]"
          >
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-mute)] hover:bg-[var(--color-surface-hi)] hover:text-[var(--color-text)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--color-accent)]"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          </button>
        </div>
        <ul className="max-h-[60vh] divide-y divide-[var(--color-border)] overflow-y-auto px-4 py-2 text-[12px]">
          {ROWS.map((r, i) => (
            <li key={i} className="flex items-center justify-between py-2">
              <span className="text-[var(--color-text)]">{r.label}</span>
              <span className="flex items-center gap-1">
                {r.keys.map((k, j) => (
                  <kbd
                    key={j}
                    className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-[var(--color-border-strong)] bg-[var(--color-surface-hi)] px-1.5 font-mono text-[10px] text-[var(--color-text-dim)]"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
