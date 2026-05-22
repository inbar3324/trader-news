import { Fragment } from "react";
import Link from "next/link";
import { ImpactDot } from "./ImpactDot";
import { EmptyState } from "./EmptyState";
import {
  deltaDirection,
  formatDayHeaderNY,
  formatNumber,
  formatTimeNY,
  impactRowClass,
  ymdNY,
} from "@/lib/formatters";
import type { CalendarEvent } from "@/lib/types";

function groupByDayNY(events: CalendarEvent[]): Array<[string, CalendarEvent[]]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = ymdNY(e.release_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function deltaClass(d: "pos" | "neg" | "flat" | null): string {
  if (d === "pos") return "text-[var(--color-delta-pos)]";
  if (d === "neg") return "text-[var(--color-delta-neg)]";
  return "text-[var(--color-text)]";
}

function DeltaGlyph({ d }: { d: "pos" | "neg" | "flat" | null }) {
  if (d === "pos") return <span aria-hidden="true" className="mr-0.5">↑</span>;
  if (d === "neg") return <span aria-hidden="true" className="mr-0.5">↓</span>;
  return null;
}

export function CalendarTable({ events }: { events: CalendarEvent[] }) {
  const groups = groupByDayNY(events);
  const totalCount = events.length;

  if (groups.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="calendar tabular w-full text-[13px]">
        <caption className="sr-only">
          Economic events, {totalCount} {totalCount === 1 ? "event" : "events"} across{" "}
          {groups.length} {groups.length === 1 ? "day" : "days"}.
        </caption>
        <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-mute)]">
          <tr>
            <th scope="col" className="text-left w-[80px]">Time</th>
            <th scope="col" className="text-left w-[60px]">CCY</th>
            <th scope="col" className="text-left w-[32px]">
              <span className="sr-only">Impact</span>
              <span aria-hidden="true">Imp</span>
            </th>
            <th scope="col" className="text-left">Event</th>
            <th scope="col" className="text-right w-[90px]">Actual</th>
            <th scope="col" className="text-right w-[90px]">Forecast</th>
            <th scope="col" className="text-right w-[90px]">Previous</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(([day, dayEvents]) => (
            <Fragment key={day}>
              <tr className="day-divider">
                <th colSpan={7} scope="rowgroup" className="text-left">
                  {formatDayHeaderNY(dayEvents[0].release_at)}
                </th>
              </tr>
              {dayEvents.map((e, idx) => {
                const delta = deltaDirection(e.actual, e.forecast);
                const isFirstOfDay = idx === 0;
                return (
                  <tr
                    key={e.id}
                    data-event-id={e.id}
                    className={`event-row ${impactRowClass(e.impact)}`}
                  >
                    <td className="text-left text-[var(--color-text-dim)] font-mono text-[12px]">
                      {isFirstOfDay && (
                        <span className="sr-only">
                          Events on {formatDayHeaderNY(e.release_at)}:{" "}
                        </span>
                      )}
                      {formatTimeNY(e.release_at)}
                    </td>
                    <td className="text-left">
                      <span className="inline-flex items-center rounded bg-[var(--color-surface-hi)] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[var(--color-text)]">
                        {e.currency}
                      </span>
                    </td>
                    <td className="text-left">
                      <ImpactDot impact={e.impact} />
                    </td>
                    <td className="text-left">
                      {e.event_type_slug ? (
                        <Link
                          href={`/event/${e.event_type_slug}`}
                          className="inline-block py-0.5 text-[var(--color-text)] hover:text-[var(--color-text-link)] hover:underline focus-visible:text-[var(--color-text-link)] focus-visible:underline"
                        >
                          {e.title}
                        </Link>
                      ) : (
                        <span className="text-[var(--color-text)]">{e.title}</span>
                      )}
                    </td>
                    <td className={`text-right ${deltaClass(delta)}`}>
                      {e.actual !== null ? (
                        <span className="font-medium">
                          <DeltaGlyph d={delta} />
                          {formatNumber(e.actual)}
                          {delta && (
                            <span className="sr-only">
                              {delta === "pos" ? " above forecast" : delta === "neg" ? " below forecast" : " in line with forecast"}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-mute)]">—</span>
                      )}
                    </td>
                    <td className="text-right text-[var(--color-text-dim)]">
                      {formatNumber(e.forecast)}
                    </td>
                    <td className="text-right text-[var(--color-text-mute)]">
                      {formatNumber(e.previous)}
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
