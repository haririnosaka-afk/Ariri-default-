import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const MODEL_ID = "doubao-seedance-2-5-260628";
// RelayRouter Seedance 2.5: $0.0013 per call; KAZAMA treats 1 second as 1 call.
// USD/IDR reference: 18,295 IDR per USD (BCA sell rate, 19 Nov 2026).
const USD_PER_CALL = 0.0013;
const USD_TO_IDR = 18295;
const IDR_PER_SECOND = USD_PER_CALL * USD_TO_IDR;
export async function GET() {
  const key = process.env.RELAYROUTER_API_KEY;
  const byResolution = { "480p": IDR_PER_SECOND, "720p": IDR_PER_SECOND, "1080p": IDR_PER_SECOND };
  return NextResponse.json({
    configured: Boolean(key),
    connected: Boolean(key),
    rates: { [MODEL_ID]: { idrPerSecond: IDR_PER_SECOND, byResolution, source: "RelayRouter Seedance 2.5 per-call rate; 1 second = 1 call", verified: true } },
    currency: "IDR",
    unit: "Rupiah per second (1 second = 1 call)",
    pricingMode: "per_call_times_duration",
    usdPerCall: USD_PER_CALL,
    usdToIdr: USD_TO_IDR,
    note: "Estimasi = USD 0.0013 per call × 1 call per second × durasi × kurs Rp18.295/USD. Tagihan akhir mengikuti pemakaian aktual RelayRouter."
  });
}
