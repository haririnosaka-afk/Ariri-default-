import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE = "https://api.relayrouter.ai";

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

function modelLabel(id: string) {
  const normalized = id.toLowerCase();
  if (normalized.includes("2-5") || normalized.includes("2.5")) return "Seedance 2.5";
  if (normalized.includes("2-0") || normalized.includes("2.0")) {
    if (normalized.includes("fast")) return "Seedance 2.0 Fast";
    if (normalized.includes("mini")) return "Seedance 2.0 Mini";
    return "Seedance 2.0";
  }
  if (normalized.includes("1-5") || normalized.includes("1.5")) return "Seedance 1.5";
  return id;
}

function resolutionsFor(id: string) {
  const m = id.match(/(?:^|[-_])(480p|720p|1080p|4k)(?:$|[-_])/i);
  if (m) return [m[1].toLowerCase()];
  return ["480p", "720p", "1080p"];
}

export async function GET() {
  const key = process.env.RELAYROUTER_API_KEY;
  if (!key) return NextResponse.json({ configured: false, connected: false, models: [], error: "RELAYROUTER_API_KEY belum dipasang." }, { status: 503 });

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
      return NextResponse.json({ configured: true, connected: false, models: [], error: "RelayRouter /v1/models HTTP " + response.status, details: payload?.error || raw.slice(0, 300) }, { status: 502 });
    }

    const all = collectModels(payload);
    const models = all.map((item: any) => {
      const id = typeof item === "string" ? item : String(item?.id || item?.name || "");
      return { id, name: modelLabel(id), resolutions: resolutionsFor(id), rawName: item?.name || id };
    }).filter((item: any) => item.id && /seedance/i.test(item.id + " " + item.rawName));

    return NextResponse.json({
      configured: true,
      connected: true,
      models,
      count: models.length,
      source: "RelayRouter GET /v1/models",
      note: "Daftar model mengikuti model yang benar-benar dikembalikan API key ini. Batas durasi, foto, dan harga harus mengikuti spesifikasi dan tarif model pada akun RelayRouter."
    });
  } catch (error) {
    return NextResponse.json({ configured: true, connected: false, models: [], error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
