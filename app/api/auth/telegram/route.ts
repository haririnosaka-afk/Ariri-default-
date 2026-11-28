import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Database login belum dikonfigurasi.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function verifyTelegramPayload(input: any, botToken: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === "hash") continue;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return false;
    fields[key] = String(value);
  }
  if (!/^\d+$/.test(fields.id || "") || !/^\d+$/.test(fields.auth_date || "")) return false;
  if (typeof input.hash !== "string" || !/^[a-f0-9]{64}$/i.test(input.hash)) return false;
  const authDate = Number(fields.auth_date);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(authDate) || authDate > now + 60 || now - authDate > 600) return false;
  const checkString = Object.keys(fields).sort().map((key) => key + "=" + fields[key]).join("\n");
  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest();
  const supplied = Buffer.from(input.hash, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function POST(req: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return NextResponse.json({ error: "Login Telegram belum dikonfigurasi." }, { status: 503 });
    const payload = await req.json();
    if (!verifyTelegramPayload(payload, botToken)) {
      return NextResponse.json({ error: "Data login Telegram tidak valid atau sudah kedaluwarsa." }, { status: 401 });
    }

    const telegramId = String(payload.id);
    const db = adminDb();
    const replayKey = createHash("sha256").update(telegramId + ":" + payload.hash).digest("hex");
    await db.from("telegram_login_events").delete().lt("expires_at", new Date().toISOString());
    const { error: replayError } = await db.from("telegram_login_events").insert({
      payload_hash: replayKey,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });
    if (replayError) {
      if (replayError.code === "23505") return NextResponse.json({ error: "Permintaan login ini sudah digunakan. Tekan Login Telegram lagi." }, { status: 409 });
      throw replayError;
    }

    let userId: string | null = null;
    const { data: linked, error: linkError } = await db.from("telegram_account_links")
      .select("user_id").eq("telegram_user_id", telegramId).maybeSingle();
    if (linkError) throw linkError;
    if (linked?.user_id) userId = String(linked.user_id);

    if (!userId) {
      const { data: native, error: nativeError } = await db.from("telegram_native_accounts")
        .select("user_id").eq("telegram_user_id", telegramId).maybeSingle();
      if (nativeError) throw nativeError;
      if (native?.user_id) userId = String(native.user_id);
    }

    const displayName = [String(payload.first_name || ""), String(payload.last_name || "")].filter(Boolean).join(" ").slice(0, 120) || "Telegram User";
    if (!userId) {
      const email = "tg-" + telegramId + "@telegram.kazamaai.my.id";
      const created = await db.auth.admin.createUser({
        email,
        password: randomBytes(32).toString("hex") + "Aa1!",
        email_confirm: true,
        user_metadata: {
          full_name: displayName,
          telegram_user_id: telegramId,
          telegram_username: payload.username ? String(payload.username).slice(0, 64) : null
        }
      });
      let authUser = created.data.user;
      if (created.error) {
        const listed = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (listed.error) throw new Error("Akun Telegram tidak dapat ditemukan.");
        authUser = listed.data.users.find((item: any) => item.email === email) || null;
      }
      if (!authUser?.id || !authUser.email) throw new Error("Akun Telegram gagal dibuat.");
      userId = authUser.id;
      const { error: saveError } = await db.from("telegram_native_accounts").upsert({
        telegram_user_id: telegramId,
        user_id: userId,
        telegram_chat_id: telegramId,
        telegram_username: payload.username ? String(payload.username).slice(0, 64) : null
      }, { onConflict: "telegram_user_id" });
      if (saveError) throw saveError;
    }

    const { data: authResult, error: authError } = await db.auth.admin.getUserById(userId);
    if (authError || !authResult.user?.email) throw new Error("Identitas akun KAZAMA tidak ditemukan.");
    const { data: link, error: generateError } = await db.auth.admin.generateLink({
      type: "magiclink",
      email: authResult.user.email
    });
    if (generateError) throw generateError;
    const tokenHash = (link as any)?.properties?.hashed_token;
    if (!tokenHash) throw new Error("Sesi login aman gagal dibuat.");
    return NextResponse.json({ ok: true, token_hash: tokenHash });
  } catch (error) {
    console.error("KAZAMA Telegram login:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Login Telegram gagal." }, { status: 500 });
  }
}
