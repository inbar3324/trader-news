"use client";

import { useTransition } from "react";
import { toggleWatch } from "@/app/watchlist/actions";

interface Props {
  eventTypeId: string;
  watching: boolean;
}

export function WatchButton({ eventTypeId, watching }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await toggleWatch(eventTypeId);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title={watching ? "Remove from watchlist" : "Add to watchlist"}
      className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[12px] transition-colors disabled:opacity-50 ${
        watching
          ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
          : "border-[var(--color-border)] text-[var(--color-text-mute)] hover:border-[var(--color-text-dim)] hover:text-[var(--color-text)]"
      }`}
    >
      <span>{watching ? "★" : "☆"}</span>
      <span>{watching ? "Watching" : "Watch"}</span>
    </button>
  );
}
