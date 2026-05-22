"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const LINKS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "week", label: "This Week" },
  { value: "next", label: "Next Week" },
  { value: "next2", label: "Next 2 Weeks" },
  { value: "month", label: "Next 4 Weeks" },
];

export function JumpLinks() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("range") ?? "week";
  const hasDay = params.has("d");

  function jump(range: string) {
    const next = new URLSearchParams(params.toString());
    next.set("range", range);
    next.delete("d");
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <nav aria-label="Date range" className="flex flex-col gap-0.5">
      {LINKS.map((l) => {
        const isActive = !hasDay && active === l.value;
        return (
          <button
            key={l.value}
            type="button"
            onClick={() => jump(l.value)}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex h-7 items-center rounded px-2 text-[12px] transition-colors ${
              isActive
                ? "bg-[var(--color-accent-soft)] font-medium text-[var(--color-text)]"
                : "text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hi)] hover:text-[var(--color-text)]"
            } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]`}
          >
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-[var(--color-accent)]"
              />
            )}
            <span className="pl-1">{l.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
