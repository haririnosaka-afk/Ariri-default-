import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const studio = "https://kazamaai.my.id/studio";

async function telegram(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram bot token belum dikonfigurasi.");
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

async function sendMenu(chatId: number, firstName = "") {
  const greeting = firstName ? `Halo ${firstName}! 👋\n\n` : "Halo! 👋\n\n";
  return telegram("sendMessage", {
    chat_id: chatId,
    text: greeting +
      "Selamat datang di *KAZAMA AI* ✨\n" +
      "Studio AI untuk membuat video, gambar, musik, dan suara.\n\n" +
      "Pilih layanan yang ingin kamu buka. Untuk saat ini, proses generator berjalan melalui studio KAZAMA; integrasi generator langsung di chat dan sinkronisasi akun Telegram sedang disiapkan.",
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎬 Video Generator", url: studio + "?tab=models" }],
        [{ text: "🖼️ Image Generator", url: studio + "?tab=image" }],
        [{ text: "🎭 Motion Control & Recreate", url: studio + "?tab=recreate" }],
        [{ text: "🎵 Music Generator", url: studio + "?tab=music" }],
        [{ text: "🎙️ Voice Studio", url: studio + "?tab=voice" }],
        [{ text: "📂 Riwayat Kreasi", url: studio + "?tab=history" }],
        [{ text: "🌐 Buka KAZAMA AI", url: "https://kazamaai.my.id" }],
      ],
    },
  });
}

export async function POST(req: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const supplied = req.headers.get("x-telegram-bot-api-secret-token");
  if (!expected || supplied !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const update = await req.json();
    if (update.callback_query) {
      const callback = update.callback_query;
      await telegram("answerCallbackQuery", { callback_query_id: callback.id });
      if (callback.message?.chat?.id) await sendMenu(callback.message.chat.id, callback.from?.first_name || "");
      return NextResponse.json({ ok: true });
    }

    const message = update.message;
    const chatId = message?.chat?.id;
    const text = String(message?.text || "").trim();
    if (!chatId || !text) return NextResponse.json({ ok: true });

    if (/^\/(start|menu)(?:\s|$)/i.test(text)) {
      await sendMenu(chatId, message.from?.first_name || "");
    } else if (/^\/help(?:\s|$)/i.test(text)) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text: "Perintah KAZAMA AI:\n/start — buka menu utama\n/menu — tampilkan menu layanan\n/help — bantuan\n\nAkun dan Credit tetap dikelola melalui website KAZAMA AI untuk sementara.",
      });
    } else {
      await telegram("sendMessage", {
        chat_id: chatId,
        text: "Pilih layanan melalui tombol /menu. Generator langsung di Telegram dan tautan akun akan diaktifkan pada tahap berikutnya.",
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("KAZAMA Telegram webhook:", error);
    // Return 200 to avoid Telegram retry storms for a malformed or unsupported update.
    return NextResponse.json({ ok: true });
  }
}
