import { NextResponse } from "next/server";
import { getSupabaseAction } from "@/lib/supabase/action";

export async function POST(request: Request) {
  const supabase = await getSupabaseAction();
  if (supabase) await supabase.auth.signOut();

  const origin = new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/auth/sign-in`, { status: 302 });
}
