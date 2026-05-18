import Link from "next/link";
import { ImpactDot } from "./ImpactDot";
import {
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

export function CalendarTable({ events }: { events: CalendarEvent[] }) {
  const groups = groupByDayNY(events);

  return (
    <div className="overflow-x-auto">
      <table className="calendar tabular w-full text-[13px]">
        <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-mute)]">
          <tr>
            <th className="text-left w-[80px]">Time</th>
            <th className="text-left w-[60px]">CCY</th>
            <th className="text-left w-[32px]">Imp</th>
            <th className="text-left">Event</th>
            <th className="text-right w-[90px]">Actual</th>
            <th className="text-right w-[90px]">Forecast</th>
            <th className="text-right w-[90px]">Previous</th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-[var(--color-text-mute)]">
                No events match the current filters.
              </td>
            </tr>
          )}
          {groups.map(([day, dayEvents]) => (
            <>
              <tr key={`day-${day}`} className="day-divider">
                <td colSpan={7}>{formatDayHeaderNY(dayEvents[0].release_at)}</td>
              </tr>
              {dayEvents.map((e) => (
                <tr key={e.id} className={`event-row ${impactRowClass(e.impact)}`}>
                  <td className="text-left text-[var(--color-text-dim)]">{formatTimeNY(e.release_at)}</td>
                  <td className="text-left font-mono text-[12px]">{e.currency}</td>
                  <td className="text-left">
                    <ImpactDot impact={e.impact} />
                  </td>
                  <td className="text-left">
                    {e.event_type_slug ? (
                      <Link
                        href={`/event/${e.event_type_slug}`}
                        className="hover:text-[var(--color-accent)]"
                      >
                        {e.title}
                      </Link>
                    ) : (
                      e.title
                    )}
                  </td>
                  <td className="text-right">
                    {e.actual !== null ? (
                      <span className="font-medium">{formatNumber(e.actual)}</span>
                    ) : (
                      <span className="text-[var(--color-text-mute)]">—</span>
                    )}
                  </td>
                  <td className="text-right text-[var(--color-text-dim)]">{formatNumber(e.forecast)}</td>
                  <td className="text-right text-[var(--color-text-mute)]">{formatNumber(e.previous)}</td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
