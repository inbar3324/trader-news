import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { toggleWatch } from "./actions";

export const metadata = { title: "Watchlist — TraderNews" };

interface WatchlistRow {
  id: string;
  event_type_id: string;
  notify: boolean;
  event_types: {
    slug: string;
    display_name: string;
    currency: string;
    category: string;
    default_impact: string;
  } | null;
}

export default async function WatchlistPage() {
  const supabase = await getSupabaseServer();
  if (!supabase) redirect("/auth/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const { data: rows } = await supabase
    .from("watchlists")
    .select("id, event_type_id, notify, event_types(slug, display_name, currency, category, default_impact)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const items = (rows ?? []) as unknown as WatchlistRow[];

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Watchlist</h1>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-dim)]">
            {user.email} · {items.length} event{items.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <form action="/auth/sign-out" method="POST">
          <button
            type="submit"
            className="rounded border border-[var(--color-border)] px-3 py-1.5 text-[12px] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
          >
            Sign out
          </button>
        </form>
      </div>

      {items.length === 0 ? (
        <div className="mt-12 text-center text-[var(--color-text-mute)]">
          <p>Nothing here yet.</p>
          <p className="mt-1 text-[12px]">
            Click the ★ on any event page to start tracking it.
          </p>
          <a href="/calendar" className="mt-4 inline-block text-[12px] text-[var(--color-accent)] hover:underline">
            Go to calendar →
          </a>
        </div>
      ) : (
        <table className="tabular mt-4 w-full text-[13px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-mute)]">
              <th className="pb-2 text-left">Event</th>
              <th className="pb-2 text-left w-[60px]">CCY</th>
              <th className="pb-2 text-left w-[100px]">Category</th>
              <th className="pb-2 w-[80px]" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const et = item.event_types;
              return (
                <tr key={item.id} className="border-t border-[var(--color-border)] hover:bg-white/[0.02]">
                  <td className="py-2.5">
                    {et ? (
                      <a
                        href={`/event/${et.slug}`}
                        className="hover:text-[var(--color-accent)]"
                      >
                        {et.display_name}
                      </a>
                    ) : (
                      <span className="text-[var(--color-text-mute)]">Unknown event</span>
                    )}
                  </td>
                  <td className="py-2.5 font-mono text-[12px]">{et?.currency ?? "—"}</td>
                  <td className="py-2.5 capitalize text-[var(--color-text-dim)]">
                    {et?.category ?? "—"}
                  </td>
                  <td className="py-2.5 text-right">
                    <form
                      action={async () => {
                        "use server";
                        await toggleWatch(item.event_type_id);
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-text-mute)] hover:border-red-500 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
