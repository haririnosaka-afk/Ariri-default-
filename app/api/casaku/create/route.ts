import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PACKAGES: Record<string, { label: string; credits: number; amount: number }> = {
  starter: { label: "STARTER", credits: 500, amount: 5000 },
  pro: { label: "PRO", credits: 2500, amount: 25000 },
  plus: { label: "PLUS", credits: 5000, amount: 50000 },
  creator: { label: "CREATOR", credits: 10100, amount: 100000 },
};

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Database pembayaran belum dikonfigurasi.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await supabaseServer();
    const { data: authData, error: authError } = await auth.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const selected = PACKAGES[String(body.package || "").toLowerCase()];
    if (!selected) return NextResponse.json({ ok: false, error: "Paket Credit tidak valid." }, { status: 400 });

    const licenseKey = process.env.CASAKU_LICENSE_KEY;
    const qrId = process.env.CASAKU_QRIS_ID;
    if (!licenseKey || !qrId) {
      return NextResponse.json({ ok: false, error: "Pembayaran QRIS belum dikonfigurasi oleh admin." }, { status: 503 });
    }

    const packageIds = (process.env.CASAKU_PACKAGE_IDS || "id.dana")
      .split(",").map((x) => x.trim()).filter(Boolean);
    const response = await fetch("https://api.casaku.id/api/generate/v2/qris", {
      method: "POST",
      headers: { "x-license-key": licenseKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        paymentMethod: "qris",
        qr_id: qrId,
        amount: selected.amount,
        packageIds,
        useUniqueCode: false,
        expiredInMinutes: 15,
        qrType: "dynamic",
        useQris: true,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    const raw = await response.text();
    let result: any;
    try { result = raw ? JSON.parse(raw) : {}; }
    catch { throw new Error("Respons pembayaran tidak valid."); }
    if (!response.ok || result?.success === false || result?.status === "error") {
      throw new Error(String(result?.message || result?.error || "Gagal membuat QR pembayaran."));
    }

    const payload = result?.data || result;
    const transactionId = String(payload.transactionId || payload.transaction_id || "");
    const qrString = String(payload.qr_string || payload.qrString || "");
    const amountIdr = Number(payload.totalAmount ?? payload.amount ?? selected.amount);
    if (!transactionId || !qrString || !Number.isSafeInteger(amountIdr) || amountIdr !== selected.amount) {
      throw new Error("Data QR pembayaran dari Casaku tidak lengkap atau nominalnya tidak cocok.");
    }

    const expiresAt = payload.expiredAt || payload.expiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error: insertError } = await adminDb().from("casaku_payment_orders").insert({
      user_id: authData.user.id,
      transaction_id: transactionId,
      amount_idr: amountIdr,
      credits: selected.credits,
      status: "pending",
      qr_string: qrString,
      expires_at: expiresAt,
    });
    if (insertError) {
      try {
        await fetch("https://api.casaku.id/api/generate/cancel-status", {
          method: "POST",
          headers: { "x-license-key": licenseKey, "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId }),
          cache: "no-store",
        });
      } catch {}
      throw new Error("Transaksi gagal disimpan. Silakan coba buat QR baru.");
    }

    return NextResponse.json({
      ok: true,
      payment: {
        transactionId,
        packageName: selected.label,
        credits: selected.credits,
        amountIdr,
        qrString,
        expiresAt,
        status: "pending",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Pembayaran gagal dibuat." },
      { status: 500 },
    );
  }
}
