"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setErrorMsg(error.message);
        setStatus("error");
      } else {
        setStatus("sent");
      }
    } catch {
      setErrorMsg("Unexpected error — try again.");
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto mt-20 max-w-[360px] px-4">
      <div className="flex items-center gap-2 mb-8">
        <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]" />
        <span className="font-semibold tracking-tight">TraderNews</span>
      </div>

      <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-[13px] text-[var(--color-text-dim)]">
        Enter your email — we&apos;ll send you a magic link.
      </p>

      {status === "sent" ? (
        <div className="mt-6 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1 text-[13px] text-[var(--color-text-dim)]">
            We sent a magic link to <strong>{email}</strong>. Click it to sign in.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] placeholder:text-[var(--color-text-mute)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded bg-[var(--color-accent)] px-3 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {status === "sending" ? "Sending…" : "Send magic link"}
          </button>
          {status === "error" && (
            <p className="text-[12px] text-red-400">{errorMsg}</p>
          )}
        </form>
      )}
    </div>
  );
}
