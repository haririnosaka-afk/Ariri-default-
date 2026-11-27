import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    const adminEmail = process.env.KAZAMA_ADMIN_EMAIL?.toLowerCase();
    if (!user || !user.email || user.email.toLowerCase() !== adminEmail) {
      return NextResponse.json({ ok: false, error: "Akses admin ditolak." }, { status: 403 });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!token || !secret) {
      return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN atau TELEGRAM_WEBHOOK_SECRET belum tersedia di Vercel." }, { status: 500 });
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://kazamaai.my.id";
    const webhookUrl = base.replace(/\/+$/, "") + "/api/telegram/webhook";
    const api = `https://api.telegram.org/bot${token}`;

    const [hookResponse, commandsResponse] = await Promise.all([
      fetch(api + "/setWebhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: secret,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: true
        }),
        cache: "no-store"
      }),
      fetch(api + "/setMyCommands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commands: [
            { command: "start", description: "Buka menu KAZAMA AI" },
            { command: "menu", description: "Tampilkan menu layanan" },
            { command: "help", description: "Bantuan penggunaan bot" },
            { command: "link", description: "Tautkan akun KAZAMA" },
            { command: "saldo", description: "Lihat saldo Credit" },
            { command: "video", description: "Buat video dari prompt teks" },
            { command: "image", description: "Buat gambar dari prompt teks" },
            { command: "status", description: "Periksa tugas generator terakhir" },
            { command: "music", description: "Buat musik dari prompt" },
            { command: "tts", description: "Ubah teks menjadi ucapan" },
            { command: "voice", description: "Buat voice dari teks" },
            { command: "motion", description: "Motion Control dengan video dan foto" },
            { command: "i2v", description: "Buat video dari foto" },
            { command: "clone", description: "Kloning voice dari audio" }
          ]
        }),
        cache: "no-store"
      })
    ]);

    const hook = await hookResponse.json().catch(() => ({}));
    const commands = await commandsResponse.json().catch(() => ({}));
    if (!hookResponse.ok || !hook.ok) {
      return NextResponse.json({ ok: false, error: hook.description || "Gagal memasang webhook Telegram." }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      webhook: webhookUrl,
      description: "Webhook Telegram berhasil dipasang.",
      commandsConfigured: !!commands.ok
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
