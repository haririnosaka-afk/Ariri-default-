import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Tarif Live Price Seedance 2.5 yang diberikan dari RelayRouter Console.
// Satuan tarif adalah USD per detik (1 detik = 1 panggilan).
const USD_TO_IDR = 18295;
const SEEDANCE_25 = "doubao-seedance-2-5-260628";
const USD_PER_SECOND: Record<string, number> = {
  "480p": 0.0925,
  "720p": 0.2080,
  "1080p": 0.5118
};
const USD_PER_SECOND_WITH_REFERENCE_VIDEO: Record<string, number> = {
  "480p": 0.0941,
  "720p": 0.2115,
  "1080p": 0.5205
};

export async function GET() {
  const byResolution: Record<string, number> = {};
  const referenceVideoByResolution: Record<string, number> = {};
  for (const [resolution, usd] of Object.entries(USD_PER_SECOND)) {
    byResolution[resolution] = usd * USD_TO_IDR;
  }
  for (const [resolution, usd] of Object.entries(USD_PER_SECOND_WITH_REFERENCE_VIDEO)) {
    referenceVideoByResolution[resolution] = usd * USD_TO_IDR;
  }

  return NextResponse.json({
    configured: Boolean(process.env.RELAYROUTER_API_KEY),
    connected: Boolean(process.env.RELAYROUTER_API_KEY),
    currency: "IDR",
    unit: "Rupiah per second",
    pricingMode: "manual_relayrouter_console_live_price",
    usdToIdr: USD_TO_IDR,
    rates: {
      [SEEDANCE_25]: {
        idrPerSecond: null,
        byResolution,
        usdPerSecond: null,
        source: "RelayRouter Console Live Price supplied by user",
        verified: true,
        referenceVideoByResolution,
        usdPerSecondWithReferenceVideo: USD_PER_SECOND_WITH_REFERENCE_VIDEO
      }
    },
    hasRates: true,
    note: "Tarif Seedance 2.5 dimasukkan dari Live Price RelayRouter Console. Estimasi dihitung per detik dikali durasi. Tarif referensi video disimpan terpisah; unggah referensi video belum tersedia di antarmuka saat ini."
  });
}
