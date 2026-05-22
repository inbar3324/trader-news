const ROW_WIDTHS = [60, 70, 50, 65, 75, 55, 68, 72, 48, 62, 70, 58];

export function TableSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto" aria-busy="true" aria-label="Loading calendar">
      <table className="calendar tabular w-full text-[13px]">
        <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-mute)]">
          <tr>
            <th scope="col" className="text-left w-[80px]">Time</th>
            <th scope="col" className="text-left w-[60px]">CCY</th>
            <th scope="col" className="text-left w-[32px]">Imp</th>
            <th scope="col" className="text-left">Event</th>
            <th scope="col" className="text-right w-[90px]">Actual</th>
            <th scope="col" className="text-right w-[90px]">Forecast</th>
            <th scope="col" className="text-right w-[90px]">Previous</th>
          </tr>
        </thead>
        <tbody>
          <tr className="day-divider">
            <th colSpan={7} scope="rowgroup" className="text-left">
              <span className="skel-block inline-block h-3 w-[140px] align-middle" />
            </th>
          </tr>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="event-row">
              <td><span className="skel-block inline-block h-3 w-[44px]" /></td>
              <td><span className="skel-block inline-block h-3 w-[28px]" /></td>
              <td><span className="skel-block inline-block h-2 w-2 rounded-full" /></td>
              <td>
                <span
                  className="skel-block inline-block h-3"
                  style={{ width: `${ROW_WIDTHS[i % ROW_WIDTHS.length]}%` }}
                />
              </td>
              <td className="text-right"><span className="skel-block inline-block h-3 w-[40px]" /></td>
              <td className="text-right"><span className="skel-block inline-block h-3 w-[40px]" /></td>
              <td className="text-right"><span className="skel-block inline-block h-3 w-[40px]" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
