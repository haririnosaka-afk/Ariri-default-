import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Database belum dikonfigurasi.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ ok: false, error: "Silakan login ke KAZAMA AI terlebih dahulu." }, { status: 401 });

    const code = randomBytes(5).toString("hex").toUpperCase();
    const codeHash = createHash("sha256").update(code).digest("hex");
    const db = adminDb();
    const { error: deleteError } = await db.from("telegram_link_codes").delete().eq("user_id", user.id);
    if (deleteError) throw deleteError;
    const { error: insertError } = await db.from("telegram_link_codes").insert({
      code_hash: codeHash,
      user_id: user.id,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });
    if (insertError) throw insertError;

    return NextResponse.json({
      ok: true,
      code,
      expires_in_minutes: 10,
      instruction: "Kirim /link " + code + " ke @KazamaAIBot. Kode hanya berlaku 10 menit dan hanya dapat digunakan sekali."
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Gagal membuat kode tautan." }, { status: 500 });
  }
}
