import { impactDotColor, impactLabel } from "@/lib/formatters";
import type { ImpactLevel } from "@/lib/types";

export function ImpactDot({ impact }: { impact: ImpactLevel }) {
  return (
    <span
      className="inline-flex h-3 w-3 items-center justify-center"
      title={impactLabel(impact)}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${impactDotColor(impact)}`}
        aria-hidden="true"
      />
      <span className="sr-only">{impactLabel(impact)}</span>
    </span>
  );
}
