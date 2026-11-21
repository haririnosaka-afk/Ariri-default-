import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseServer() {
  const jar = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase belum dikonfigurasi.");
  return createServerClient(url, anon, {
    cookies: {
      get(name: string) { return jar.get(name)?.value; },
      set(name: string, value: string, options: any) { try { jar.set({ name, value, ...options }); } catch {} },
      remove(name: string, options: any) { try { jar.set({ name, value: "", ...options }); } catch {} },
    },
  });
}
