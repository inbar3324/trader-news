"use client";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { setStoredDensity, setStoredTheme, type Density, type Theme } from "@/lib/theme";

const RANGES: ReadonlyArray<{ value: string; label: string; hint: string }> = [
  { value: "today", label: "Today", hint: "g t" },
  { value: "tomorrow", label: "Tomorrow", hint: "" },
  { value: "week", label: "This Week", hint: "g w" },
  { value: "next", label: "Next Week", hint: "g n" },
  { value: "next2", label: "Next 2 Weeks", hint: "" },
  { value: "month", label: "Next 4 Weeks", hint: "" },
];

const DENSITIES: ReadonlyArray<Density> = ["compact", "cozy", "relaxed"];
const THEMES: ReadonlyArray<Theme> = ["light", "dark"];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const router = useRouter();

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange, close]);

  function jumpRange(range: string) {
    router.push(`/calendar?range=${range}`);
    close();
  }

  function applyDensity(d: Density) {
    setStoredDensity(d);
    close();
  }

  function applyTheme(t: Theme) {
    setStoredTheme(t);
    close();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]"
    >
      <button
        type="button"
        aria-label="Close command palette"
        onClick={close}
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[0_24px_48px_rgba(40,38,32,0.18)]">
        <Command label="Command palette" className="flex flex-col">
          <Command.Input
            placeholder="Search events, jump to dates, change settings…"
            className="h-12 w-full border-b border-[var(--color-border)] bg-transparent px-4 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-mute)] outline-none"
          />
          <Command.List className="max-h-[420px] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-[12px] text-[var(--color-text-mute)]">
              No matches.
            </Command.Empty>

            <Command.Group
              heading="Jump to"
              className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-mute)] [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5"
            >
              {RANGES.map((r) => (
                <Command.Item
                  key={r.value}
                  value={`jump ${r.value} ${r.label}`}
                  onSelect={() => jumpRange(r.value)}
                  className="flex cursor-pointer items-center justify-between rounded px-3 py-1.5 text-[13px] text-[var(--color-text)] aria-selected:bg-[var(--color-accent-soft)] aria-selected:text-[var(--color-text)]"
                >
                  <span>{r.label}</span>
                  {r.hint && (
                    <kbd className="font-mono text-[10px] text-[var(--color-text-mute)]">
                      {r.hint}
                    </kbd>
                  )}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group
              heading="Density"
              className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-mute)] [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:pt-3"
            >
              {DENSITIES.map((d) => (
                <Command.Item
                  key={d}
                  value={`density ${d}`}
                  onSelect={() => applyDensity(d)}
                  className="flex cursor-pointer items-center rounded px-3 py-1.5 text-[13px] text-[var(--color-text)] aria-selected:bg-[var(--color-accent-soft)]"
                >
                  <span className="capitalize">{d}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group
              heading="Theme"
              className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-mute)] [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:pt-3"
            >
              {THEMES.map((t) => (
                <Command.Item
                  key={t}
                  value={`theme ${t}`}
                  onSelect={() => applyTheme(t)}
                  className="flex cursor-pointer items-center rounded px-3 py-1.5 text-[13px] text-[var(--color-text)] aria-selected:bg-[var(--color-accent-soft)]"
                >
                  <span className="capitalize">{t}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
