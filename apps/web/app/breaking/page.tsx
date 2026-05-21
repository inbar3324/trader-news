import { getSupabaseServer } from "@/lib/supabase/server";
import type { BreakingHeadline } from "@/lib/types";
import { BreakingFeed } from "./_components/BreakingFeed";

export const metadata = { title: "Breaking news — TraderNews" };
export const revalidate = 60;

async function fetchInitialHeadlines(): Promise<BreakingHeadline[]> {
  const supabase = await getSupabaseServer();
  if (!supabase) return [];

  const { data } = await supabase
    .from("breaking_headlines")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(100);

  return (data ?? []) as BreakingHeadline[];
}

export default async function BreakingPage() {
  const initial = await fetchInitialHeadlines();

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <header className="border-b border-[var(--color-border)] pb-4">
        <h1 className="text-xl font-semibold tracking-tight">Breaking news</h1>
        <p className="mt-1 text-[12px] text-[var(--color-text-dim)]">
          Federal Reserve · ECB · WSJ · Yahoo Finance. Polled every 5 minutes during the NY session.
          AI-verified summaries on high-impact headlines.
        </p>
      </header>

      {initial.length === 0 ? (
        <div className="mt-6 rounded border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-[var(--color-text-mute)]">
          No headlines yet — feed populates during US market sessions.
        </div>
      ) : (
        <BreakingFeed initial={initial} />
      )}
    </div>
  );
}
