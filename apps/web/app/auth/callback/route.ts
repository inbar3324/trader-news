import { NextResponse } from "next/server";
import { getSupabaseAction } from "@/lib/supabase/action";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/watchlist";

  if (code) {
    const supabase = await getSupabaseAction();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/sign-in?error=auth_failed`);
}
