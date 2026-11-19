import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// KAZAMA estimate rule requested by the owner:
// 1 second of video = 1 RelayRouter API call.
// The per-call reference rate used here is USD 0.0013.
// The selected resolution is explicitly looked up; the current per-call
// reference rate is flat across the supported 2.5 resolutions.
const MODEL_ID = "doubao-seedance-2-5-260628";
const USD_PER_CALL = 0.0013;
const USD_TO_IDR = 18295;
const IDR_PER_CALL = USD_PER_CALL * USD_TO_IDR;

export async function GET() {
  const configured = Boolean(process.env.RELAYROUTER_API_KEY);
  const byResolution = {
    "480p": IDR_PER_CALL,
    "720p": IDR_PER_CALL,
    "1080p": IDR_PER_CALL
  };

  return NextResponse.json({
    configured,
    connected: configured,
    rates: {
      [MODEL_ID]: {
        idrPerSecond: IDR_PER_CALL,
        byResolution,
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
    note: "Estimasi KAZAMA = tarif per panggilan USD 0.0013 × 1 panggilan per detik × durasi × kurs referensi Rp18.295/USD. Tarif per panggilan pada patokan ini sama untuk 480p, 720p, dan 1080p; resolusi tetap dipilih dan divalidasi saat generate. Ini estimasi, bukan saldo atau tagihan aktual RelayRouter."
  });
}
