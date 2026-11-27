import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Database belum dikonfigurasi.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  try {
    const auth = await supabaseServer();
    const { data: authData, error: authError } = await auth.auth.getUser();
    if (authError || !authData.user) return NextResponse.json({ ok: false, error: "Silakan masuk." }, { status: 401 });

    const transactionId = req.nextUrl.searchParams.get("transactionId") || "";
    if (!transactionId) return NextResponse.json({ ok: false, error: "ID transaksi wajib diisi." }, { status: 400 });

    const db = adminDb();
    const { data: order, error } = await db.from("casaku_payment_orders")
      .select("transaction_id,status,amount_idr,credits,expires_at,credited_at")
      .eq("transaction_id", transactionId)
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ ok: false, error: "Transaksi tidak ditemukan." }, { status: 404 });

    const { data: profile, error: profileError } = await db.from("profiles")
      .select("balance").eq("id", authData.user.id).single();
    if (profileError) throw profileError;

    return NextResponse.json({
      ok: true,
      payment: {
        transactionId: order.transaction_id,
        status: order.status,
        amountIdr: Number(order.amount_idr),
        credits: Number(order.credits),
        expiresAt: order.expires_at,
        creditedAt: order.credited_at,
      },
      balance: Number(profile.balance) * 100,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Gagal memeriksa pembayaran." }, { status: 500 });
  }
}
