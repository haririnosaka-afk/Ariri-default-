import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// Dola Pool's public client API does not expose a guaranteed per-second price.
// Never reuse the old RelayRouter tariff for Dola/Doubao account-pool jobs.
export async function GET() {
  const base = process.env.DOLA_POOL_BASE_URL?.replace(/\/+$/, "");
  const key = process.env.DOLA_POOL_API_KEY;
  let connected = false;
  let pool: any = null;
  if (base && key) {
    try {
      const response = await fetch(base + "/health", { cache: "no-store", signal: AbortSignal.timeout(8000) });
      const data = await response.json().catch(() => ({}));
      connected = response.ok && data?.ok !== false;
      pool = data?.pool || null;
    } catch {}
  }
  return NextResponse.json({
    configured: Boolean(base && key),
    connected,
    rates: {},
    hasRates: false,
    pool,
    pricingMode: "pool_account_quota",
    note: "Tarif Rupiah per detik tidak tersedia dari API pool. Biaya/kuota bergantung pada akun Dola atau Doubao yang dipilih oleh pool; KAZAMA tidak menebak harga."
  });
}
