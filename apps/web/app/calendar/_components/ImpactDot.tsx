import { impactDotColor } from "@/lib/formatters";
import type { ImpactLevel } from "@/lib/types";

export function ImpactDot({ impact }: { impact: ImpactLevel }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-2 w-2 rounded-full ${impactDotColor(impact)}`} aria-label={impact} />
    </span>
  );
}
