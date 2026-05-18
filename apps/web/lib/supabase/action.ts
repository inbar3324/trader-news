// Supabase client for Server Actions and Route Handlers where cookies CAN be written.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getSupabaseAction() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) =>
        toSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]),
        ),
    },
  });
}
