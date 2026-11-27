import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Casaku may verify the webhook URL with GET/HEAD before sending payment events.
export async function GET() {
  return NextResponse.json({ ok: true, service: "casaku-webhook" }, { status: 200 });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: { Allow: "GET, HEAD, POST, OPTIONS" } });
}

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Database webhook belum dikonfigurasi.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const secret = process.env.CASAKU_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "Webhook belum dikonfigurasi." }, { status: 503 });

  const rawBody = await req.text();
  const signature = req.headers.get("x-casaku-signature") || "";
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return NextResponse.json({ ok: false, error: "Signature tidak valid." }, { status: 401 });
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ ok: false, error: "Signature tidak cocok." }, { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); }
  catch { return NextResponse.json({ ok: false, error: "Payload JSON tidak valid." }, { status: 400 }); }

  if (String(payload?.status || "").toLowerCase() !== "paid") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const transactionId = String(payload?.transactionId || "");
  const amountIdr = Number(payload?.amount);
  if (!transactionId || !Number.isSafeInteger(amountIdr) || amountIdr <= 0) {
    return NextResponse.json({ ok: false, error: "Data transaksi tidak lengkap." }, { status: 400 });
  }

  try {
    const { data, error } = await adminDb().rpc("settle_casaku_payment", {
      p_transaction_id: transactionId,
      p_amount_idr: amountIdr,
      p_payload: payload,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, credited: true, balance: data });
  } catch (error) {
    console.error("Casaku webhook settlement failed:", error);
    return NextResponse.json({ ok: false, error: "Transaksi belum dapat diproses." }, { status: 500 });
  }
}
