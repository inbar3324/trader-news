"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export function HeaderAuth() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // No Supabase config → skip
    try {
      const supabase = getSupabaseClient();
      supabase.auth.getSession().then(({ data }) => {
        setEmail(data.session?.user.email ?? null);
        setReady(true);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
        setEmail(session?.user.email ?? null);
      });
      return () => subscription.unsubscribe();
    } catch {
      setReady(true);
    }
  }, []);

  if (!ready) return null;

  if (email) {
    return (
      <div className="flex items-center gap-3">
        <a href="/watchlist" className="hover:text-[var(--color-text)] text-[12px]">
          Watchlist
        </a>
        <form action="/auth/sign-out" method="POST">
          <button
            type="submit"
            className="rounded border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-text-mute)] hover:text-[var(--color-text)]"
          >
            Sign out
          </button>
        </form>
      </div>
    );
  }

  return (
    <a
      href="/auth/sign-in"
      className="rounded border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-text-mute)] hover:text-[var(--color-text)]"
    >
      Sign in
    </a>
  );
}
