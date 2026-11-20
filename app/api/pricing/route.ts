import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// No fixed per-second price is hardcoded: actual billing depends on the
// active RelayRouter model, resolution, duration and reference inputs.
export async function GET() {
  const configured = Boolean(process.env.RELAYROUTER_API_KEY);
  return NextResponse.json({
    configured,
    connected: configured,
    provider: "RelayRouter",
    pricingMode: "provider_actual_usage",
    hasRates: false,
    rates: {},
    note: "Biaya mengikuti pemakaian aktual RelayRouter. Tarif per detik belum diisi karena harus dicocokkan dengan harga model yang aktif."
  });
}
