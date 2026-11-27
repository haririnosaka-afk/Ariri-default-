import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function dbAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Database belum dikonfigurasi.");
  return createClient(url, key, { auth: { persistSession: false } });
}
const API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function telegram(method: string, payload: Record<string, unknown>) {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error("Bot token belum dikonfigurasi.");
  const response = await fetch(`${API()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.description || "Telegram API error.");
  return data;
}
async function say(chatId: number, text: string, replyMarkup?: any) {
  return telegram("sendMessage", { chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });
}
async function sendMenu(chatId: number, firstName = "") {
  const name = firstName ? ` ${firstName}` : "";
  return say(chatId,
    `Halo${name}! 👋 Selamat datang di KAZAMA AI.\n\nPilih layanan di bawah. Akun Telegram perlu ditautkan ke akun web KAZAMA agar saldo Credit dan riwayat tetap satu.`,
    { inline_keyboard: [
      [{ text: "🎬 Video Generator", callback_data: "tool_video" }],
      [{ text: "🖼️ Image Generator", callback_data: "tool_image" }],
      [{ text: "🎭 Motion Control", callback_data: "tool_motion" }],
      [{ text: "🎵 Music Generator", callback_data: "tool_music" }],
      [{ text: "🎙️ Voice Studio", callback_data: "tool_voice" }],
      [{ text: "💳 Saldo Credit", callback_data: "account_balance" }],
      [{ text: "🔗 Cara tautkan akun", callback_data: "account_link" }],
    ] }
  );
}
async function linkAccount(chatId: number, from: any, rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-F0-9]{10}$/.test(code)) {
    await say(chatId, "Format kode belum benar. Buka KAZAMA saat sudah login, buat kode tautan, lalu kirim: /link KODE");
    return;
  }
  const db = dbAdmin();
  const hash = createHash("sha256").update(code).digest("hex");
  const { data: linkCode, error } = await db.from("telegram_link_codes")
    .select("user_id,expires_at").eq("code_hash", hash).single();
  if (error || !linkCode || new Date(linkCode.expires_at).getTime() <= Date.now()) {
    await say(chatId, "Kode tidak ditemukan atau sudah kedaluwarsa. Buat kode baru dari akun KAZAMA yang sudah login.");
    return;
  }
  const telegramUserId = Number(from.id);
  const { data: existing } = await db.from("telegram_account_links")
    .select("user_id").eq("telegram_user_id", telegramUserId).maybeSingle();
  if (existing && existing.user_id !== linkCode.user_id) {
    await say(chatId, "Telegram ini sudah tertaut ke akun KAZAMA lain. Hubungi admin untuk mengganti tautan akun.");
    return;
  }
  const { error: saveError } = await db.from("telegram_account_links").upsert({
    telegram_user_id: telegramUserId,
    user_id: linkCode.user_id,
    telegram_chat_id: chatId,
    telegram_username: from.username || null,
    linked_at: new Date().toISOString()
  }, { onConflict: "telegram_user_id" });
  if (saveError) throw saveError;
  await db.from("telegram_link_codes").delete().eq("code_hash", hash);
  await say(chatId, "✅ Akun Telegram berhasil ditautkan ke KAZAMA AI.\n\nKirim /saldo untuk melihat Credit akun yang sama dengan website. Gunakan /menu untuk melihat layanan.");
}
async function sendBalance(chatId: number, telegramUserId: number) {
  const db = dbAdmin();
  const { data: link, error: linkError } = await db.from("telegram_account_links")
    .select("user_id").eq("telegram_user_id", telegramUserId).single();
  if (linkError || !link) {
    await say(chatId, "Akun belum tertaut. Login ke website KAZAMA, buat kode tautan, lalu kirim /link KODE ke bot.");
    return;
  }
  const { data: profile, error } = await db.from("profiles")
    .select("email,balance").eq("id", link.user_id).single();
  if (error || !profile) throw new Error("Data saldo akun tidak dapat dibaca.");
  await say(chatId, `💳 KAZAMA AI Wallet\nAkun: ${profile.email || "KAZAMA user"}\nSaldo: ${Number(profile.balance) * 100} Credit`);
}

export async function POST(req: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const supplied = req.headers.get("x-telegram-bot-api-secret-token");
  if (!expected || supplied !== expected) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const update = await req.json();
    if (update.callback_query) {
      const callback = update.callback_query;
      await telegram("answerCallbackQuery", { callback_query_id: callback.id });
      const chatId = callback.message?.chat?.id;
      if (!chatId) return NextResponse.json({ ok: true });
      const action = String(callback.data || "");
      if (action === "account_balance") await sendBalance(chatId, Number(callback.from.id));
      else if (action === "account_link") await say(chatId, "🔗 TAUTKAN AKUN\n1. Login ke https://kazamaai.my.id di browser.\n2. Buka https://kazamaai.my.id/api/telegram/link-code.\n3. Salin kode yang muncul.\n4. Kirim ke bot dengan format /link KODE.\n\nKode hanya berlaku 10 menit dan hanya bisa dipakai sekali.");
      else {
        const labels: Record<string, string> = {
          tool_video: "Video Generator", tool_image: "Image Generator",
          tool_motion: "Motion Control", tool_music: "Music Generator", tool_voice: "Voice Studio"
        };
        await say(chatId, `🎛️ ${labels[action] || "Layanan KAZAMA"} dipilih. Integrasi proses generator langsung sedang disambungkan ke akun tertaut. Untuk keamanan, bot belum akan mengirim tugas atau memotong Credit sampai alur tersebut siap.`);
      }
      return NextResponse.json({ ok: true });
    }

    const message = update.message;
    const chatId = message?.chat?.id;
    const text = String(message?.text || "").trim();
    if (!chatId) return NextResponse.json({ ok: true });
    if (/^\/(start|menu)(?:\s|$)/i.test(text)) await sendMenu(chatId, message.from?.first_name || "");
    else if (/^\/help(?:\s|$)/i.test(text)) {
      await say(chatId, "Perintah KAZAMA AI:\n/start atau /menu — menu utama\n/link KODE — tautkan akun KAZAMA\n/saldo — cek saldo Credit\n/help — bantuan");
    } else if (/^\/link(?:\s|$)/i.test(text)) {
      await linkAccount(chatId, message.from || {}, text.replace(/^\/link\s*/i, ""));
    } else if (/^\/saldo(?:\s|$)/i.test(text)) {
      await sendBalance(chatId, Number(message.from?.id));
    } else {
      await say(chatId, "Gunakan /menu untuk memilih layanan atau /saldo untuk melihat Credit. Untuk menghubungkan akun, kirim /link KODE.");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("KAZAMA Telegram webhook:", error);
    return NextResponse.json({ ok: true });
  }
}
