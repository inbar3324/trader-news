"use client";

import { useState } from "react";
import type { HistoricalReaction, Symbol } from "@/lib/types";
import { VolScoreGauge } from "./VolScoreGauge";

interface Props {
  reactions: HistoricalReaction[];
  symbols: Symbol[];
  rationale: string | null;
}

// Preferred default order — trader-focused symbols first.
const SYMBOL_PRIORITY = ["NQ", "ES", "SPY", "QQQ", "GC", "CL", "EURUSD", "GBPUSD", "USDJPY", "AUDUSD"];

export function GaugePanel({ reactions, symbols, rationale }: Props) {
  const symbolMap = new Map(symbols.map((s) => [s.ticker, s]));

  // Available tickers we have reactions for
  const availableTickers = reactions
    .map((r) => r.symbol)
    .filter((t) => symbolMap.has(t));

  // Default: pick first available from priority order
  const defaultTicker =
    SYMBOL_PRIORITY.find((t) => availableTickers.includes(t)) ??
    availableTickers[0] ??
    null;

  const [selected, setSelected] = useState<string | null>(defaultTicker);

  // Order tabs by priority list
  const orderedTickers = [
    ...SYMBOL_PRIORITY.filter((t) => availableTickers.includes(t)),
    ...availableTickers.filter((t) => !SYMBOL_PRIORITY.includes(t)),
  ];

  const reaction = reactions.find((r) => r.symbol === selected) ?? null;
  const symbol = selected ? symbolMap.get(selected) ?? null : null;

  if (orderedTickers.length === 0) {
    return (
      <VolScoreGauge
        score={null}
        openScore={null}
        oneMinScore={null}
        rationale={null}
        reaction={null}
        symbol={null}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {orderedTickers.map((t) => {
          const s = symbolMap.get(t)!;
          return (
            <button
              key={t}
              onClick={() => setSelected(t)}
              className={`rounded border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${
                selected === t
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]"
                  : "border-[var(--color-border)] text-[var(--color-text-mute)] hover:text-[var(--color-text-dim)]"
              }`}
              title={s.display_name}
            >
              {t}
            </button>
          );
        })}
      </div>
      <VolScoreGauge
        score={reaction?.vol_score ?? null}
        openScore={reaction?.open_vol_score ?? null}
        oneMinScore={reaction?.one_min_score ?? null}
        rationale={rationale}
        reaction={reaction}
        symbol={symbol}
      />
    </div>
  );
}
