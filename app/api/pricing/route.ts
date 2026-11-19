import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MODEL_ID = "doubao-seedance-2-5-260628";
const USD_PER_CALL = 0.0013;
const USD_TO_IDR = 18295;
const IDR_PER_CALL = USD_PER_CALL * USD_TO_IDR;

export async function GET() {
  const key = process.env.RELAYROUTER_API_KEY;
  const configured = Boolean(key);
  let connected = false;
  let connectionError: string | undefined;

  if (key) {
    try {
      const response = await fetch("https://api.relayrouter.ai/v1/models", {
        headers: { Authorization: "Bearer " + key, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(10000)
      });
      connected = response.ok;
      if (!response.ok) {
        const body = await response.text();
        connectionError = "RelayRouter model-list check returned HTTP " + response.status + (body ? ": " + body.slice(0, 180) : "");
      }
    } catch (error) {
      connectionError = error instanceof Error ? error.message : String(error);
    }
  }

  return NextResponse.json({
    configured,
    connected,
    connectionError,
    rates: {
      [MODEL_ID]: {
        idrPerSecond: IDR_PER_CALL,
        byResolution: {
          "480p": IDR_PER_CALL,
          "720p": IDR_PER_CALL,
          "1080p": IDR_PER_CALL
        },
        usdPerCall: USD_PER_CALL,
        source: "KAZAMA per-call reference rate; 1 second = 1 call",
        verified: false
      }
    },
    currency: "IDR",
    unit: "Rupiah per second (1 second = 1 call)",
    pricingMode: "per_call_times_duration",
    usdToIdr: USD_TO_IDR,
    maxAutoDuration: 30,
    note: "Estimasi KAZAMA = USD 0.0013 per panggilan × 1 panggilan per detik × durasi × kurs referensi Rp18.295/USD. Patokan per panggilan ini sama untuk 480p, 720p, dan 1080p; resolusi tetap dipilih dan dikirim ke API. Ini estimasi, bukan tagihan aktual RelayRouter."
  });
}
