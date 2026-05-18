"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAction } from "@/lib/supabase/action";

export async function toggleWatch(eventTypeId: string) {
  const supabase = await getSupabaseAction();
  if (!supabase) return { error: "No Supabase config" };

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return { error: "Not authenticated" };

  // Check if already watching
  const { data: existing } = await supabase
    .from("watchlists")
    .select("id")
    .eq("user_id", user.id)
    .eq("event_type_id", eventTypeId)
    .maybeSingle();

  if (existing) {
    await supabase.from("watchlists").delete().eq("id", existing.id);
  } else {
    await supabase.from("watchlists").insert({ user_id: user.id, event_type_id: eventTypeId });
  }

  revalidatePath("/watchlist");
  revalidatePath("/event/[slug]", "page");
  return { watching: !existing };
}
