import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE = "https://api.relayrouter.ai";
const USD_TO_IDR = 18295;

function collectModels(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  for (const key of ["data", "models", "result"]) {
    const value = payload?.[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      for (const nested of ["data", "models", "items"]) {
        if (Array.isArray(value[nested])) return value[nested];
      }
    }
  }
  return [];
}

function firstNumber(...values: any[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0) return Number(value);
  }
  return null;
}

function extractUsdPerSecond(item: any): number | null {
  const p = item?.pricing ?? item?.price ?? item?.rates ?? {};
  return firstNumber(
    p?.usd_per_second, p?.usdPerSecond, p?.per_second, p?.perSecond,
    p?.video_usd_per_second, p?.videoUsdPerSecond,
    item?.usd_per_second, item?.usdPerSecond, item?.video_sec_usd
  );
}

function extractUsdPerCall(item: any): number | null {
  const p = item?.pricing ?? item?.price ?? item?.rates ?? {};
  return firstNumber(
    p?.usd_per_call, p?.usdPerCall, p?.per_call, p?.perCall,
    p?.call_usd, p?.callUsd, item?.usd_per_call, item?.usdPerCall
  );
}

function extractResolutionRates(item: any): Record<string, number> {
  const p = item?.pricing ?? item?.price ?? item?.rates ?? {};
  const source = p?.by_resolution ?? p?.byResolution ?? p?.resolutions ?? p?.resolution_prices ?? p?.resolutionPrices;
  const result: Record<string, number> = {};
  if (source && typeof source === "object" && !Array.isArray(source)) {
    for (const [resolution, raw] of Object.entries(source)) {
      const value = typeof raw === "object" && raw !== null
        ? firstNumber((raw as any).usd_per_second, (raw as any).usdPerSecond, (raw as any).usd_per_call, (raw as any).usdPerCall, (raw as any).price)
        : firstNumber(raw);
      if (value !== null) result[resolution.toLowerCase()] = value;
    }
  }
  return result;
}

export async function GET() {
  const key = process.env.RELAYROUTER_API_KEY;
  if (!key) return NextResponse.json({ configured: false, connected: false, rates: {}, currency: "IDR", error: "RELAYROUTER_API_KEY belum dipasang." }, { status: 503 });

  try {
    const response = await fetch(BASE + "/v1/models", {
      headers: { Authorization: "Bearer " + key, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    });
    const raw = await response.text();
    let payload: any;
    try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
    if (!response.ok) {
      return NextResponse.json({ configured: true, connected: false, rates: {}, currency: "IDR", error: "RelayRouter /v1/models HTTP " + response.status, details: payload?.error || raw.slice(0, 300) }, { status: 502 });
    }

    const rates: Record<string, any> = {};
    for (const item of collectModels(payload)) {
      const id = typeof item === "string" ? item : String(item?.id || item?.name || "");
      if (!id || !/seedance/i.test(id)) continue;
      const usdPerSecond = extractUsdPerSecond(item);
      const usdPerCall = extractUsdPerCall(item);
      const resolutionUsd = extractResolutionRates(item);
      const byResolution: Record<string, number> = {};
      for (const [resolution, usd] of Object.entries(resolutionUsd)) {
        // RelayRouter values are treated as USD per second unless explicitly tagged as per-call.
        const idr = usd * USD_TO_IDR;
        byResolution[resolution] = idr;
      }
      const baseUsd = usdPerSecond ?? usdPerCall;
      rates[id] = {
        idrPerSecond: baseUsd === null ? null : baseUsd * USD_TO_IDR,
        byResolution,
        usdPerSecond,
        usdPerCall,
        source: "RelayRouter GET /v1/models",
        verified: true
      };
    }

    const hasRates = Object.values(rates).some((rate: any) => rate.idrPerSecond !== null || Object.keys(rate.byResolution).length > 0);
    return NextResponse.json({
      configured: true,
      connected: true,
      rates,
      currency: "IDR",
      unit: "Rupiah per second",
      pricingMode: "relayrouter_catalog",
      usdToIdr: USD_TO_IDR,
      hasRates,
      note: hasRates
        ? "Estimasi dihitung dari metadata harga yang dikembalikan langsung oleh katalog RelayRouter. Jika katalog memberi tarif per resolusi, tarif tiap resolusi digunakan."
        : "RelayRouter /v1/models berhasil diakses, tetapi respons katalog tidak menyertakan tarif. KAZAMA tidak mengarang harga; periksa tarif model dan resolusi di Console RelayRouter."
    });
  } catch (error) {
    return NextResponse.json({ configured: true, connected: false, rates: {}, currency: "IDR", error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
