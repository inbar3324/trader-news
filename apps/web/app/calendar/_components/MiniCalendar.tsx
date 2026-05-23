"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

const NY_TZ = "America/New_York";

function ymdInNY(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: NY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

type Cell = { iso: string; day: number; inMonth: boolean };

function buildMonthGrid(viewYear: number, viewMonth: number): Cell[] {
  // viewMonth is 1-12. Anchor all dates at 12:00 UTC so the offset to NY
  // (UTC-4/-5) never slips the calendar date during DST transitions.
  const first = new Date(Date.UTC(viewYear, viewMonth - 1, 1, 12));
  const firstDow = first.getUTCDay(); // 0 = Sun
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0, 12)).getUTCDate();
  const cells: Cell[] = [];

  // leading days from previous month
  const prevDaysInMonth = new Date(Date.UTC(viewYear, viewMonth - 1, 0, 12)).getUTCDate();
  for (let i = firstDow - 1; i >= 0; i--) {
    const day = prevDaysInMonth - i;
    const date = new Date(Date.UTC(viewYear, viewMonth - 2, day, 12));
    cells.push({ iso: ymdInNY(date), day, inMonth: false });
  }
  // current month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(viewYear, viewMonth - 1, day, 12));
    cells.push({ iso: ymdInNY(date), day, inMonth: true });
  }
  // trailing days to fill 6-week grid
  while (cells.length < 42) {
    const last = cells[cells.length - 1];
    const lastP = parseYmd(last.iso);
    if (!lastP) break;
    const nextDate = new Date(Date.UTC(lastP.y, lastP.m - 1, lastP.d + 1, 12));
    cells.push({
      iso: ymdInNY(nextDate),
      day: nextDate.getUTCDate(),
      inMonth: false,
    });
  }
  return cells.slice(0, 42);
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export function MiniCalendar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const todayIso = useMemo(() => ymdInNY(new Date()), []);
  const todayParts = useMemo(() => parseYmd(todayIso), [todayIso]);

  const selectedDay = params.get("d");
  const grid = useMemo(() => {
    if (!todayParts) return [];
    return buildMonthGrid(todayParts.y, todayParts.m);
  }, [todayParts]);

  if (!todayParts) return null;

  const monthLabel = new Date(
    Date.UTC(todayParts.y, todayParts.m - 1, 1, 12),
  ).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: NY_TZ });

  function selectDay(iso: string) {
    const next = new URLSearchParams(params.toString());
    next.set("d", iso);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-medium text-[var(--color-text)]">{monthLabel}</span>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-[var(--color-text-mute)]">
        {DOW.map((d, i) => (
          <div key={i} className="py-0.5">
            {d}
          </div>
        ))}
        {grid.map((cell) => {
          const isToday = cell.iso === todayIso;
          const isSelected = selectedDay === cell.iso;
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => selectDay(cell.iso)}
              aria-label={cell.iso}
              aria-current={isToday ? "date" : undefined}
              aria-pressed={isSelected}
              className={`flex h-7 items-center justify-center rounded text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)] ${
                isSelected
                  ? "bg-[var(--color-accent)] font-semibold text-white"
                  : isToday
                    ? "bg-[var(--color-accent-soft)] font-semibold text-[var(--color-accent)]"
                    : cell.inMonth
                      ? "text-[var(--color-text)] hover:bg-[var(--color-surface-hi)]"
                      : "text-[var(--color-text-mute)] hover:bg-[var(--color-surface-hi)]"
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
