import {NextResponse} from "next/server";
export const dynamic = "force-dynamic";
const MODEL_ID = "doubao-seedance-2-5-260628";
const RESOLUTIONS = ["480p", "720p", "1080p"] as const;
function readRate(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}
export async function GET() {
  const key = process.env.RELAYROUTER_API_KEY;
  const envNames: Record<(typeof RESOLUTIONS)[number], string> = {
    "480p": "RELAYROUTER_SEEDANCE_480P_IDR_PER_SECOND",
    "720p": "RELAYROUTER_SEEDANCE_720P_IDR_PER_SECOND",
    "1080p": "RELAYROUTER_SEEDANCE_1080P_IDR_PER_SECOND",
  };
  const byResolution = Object.fromEntries(RESOLUTIONS.map((resolution) => [resolution, readRate(envNames[resolution])]));
  const availableRates = Object.values(byResolution).filter((value): value is number => typeof value === "number");
  return NextResponse.json({
    configured: Boolean(key), connected: Boolean(key),
    rates: { [MODEL_ID]: { idrPerSecond: null, byResolution, source: availableRates.length ? "RelayRouter console rate configured in Vercel environment" : "No verified per-second rate configured", verified: availableRates.length > 0 } },
    currency: "IDR", unit: "Rupiah per second", pricingMode: "verified_console_rate_only",
    note: availableRates.length ? "Estimasi = tarif per detik dari konsol RelayRouter × durasi. Tagihan akhir mengikuti pemakaian aktual." : "Tarif belum tersedia. KAZAMA tidak memakai angka perkiraan atau tarif dari penyedia lain."
  });
}
