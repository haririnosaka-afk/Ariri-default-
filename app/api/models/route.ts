import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// These are the exact model IDs documented by the configured Dola Pool API.
// Provider selection is handled inside Dola Pool, not in the KAZAMA UI.
const MODELS = [
  { id: "seedance-2.0-fast", name: "Seedance 2.0 Fast · Dola", minDuration: 5, maxDuration: 15, durations: [5, 10, 15], resolutions: ["720p", "1080p", "2k", "4k"], maxImages: 10, route: "Dola account pool" },
  { id: "seedance-2.5", name: "Seedance 2.5 · Dola", minDuration: 5, maxDuration: 30, durations: [5, 10, 30], resolutions: ["720p", "1080p", "2k", "4k"], maxImages: 10, route: "Dola account pool" },
  { id: "doubao-seedance-2.0-mini", name: "Seedance 2.0 Mini · Doubao", minDuration: 4, maxDuration: 15, durations: [4, 5, 6, 8, 10, 12, 15], resolutions: ["720p"], maxImages: 30, route: "Doubao account pool" },
  { id: "doubao-seedance-2.0-fast", name: "Seedance 2.0 Fast · Doubao", minDuration: 4, maxDuration: 15, durations: [4, 5, 6, 8, 10, 12, 15], resolutions: ["720p"], maxImages: 30, route: "Doubao account pool" },
  { id: "doubao-seedance-2.0", name: "Seedance 2.0 · Doubao", minDuration: 4, maxDuration: 15, durations: [4, 5, 6, 8, 10, 12, 15], resolutions: ["720p"], maxImages: 30, route: "Doubao account pool" },
  { id: "doubao-seedance-2.5", name: "Seedance 2.5 · Doubao", minDuration: 4, maxDuration: 30, durations: [4, 5, 6, 8, 10, 12, 15, 20, 25, 30], resolutions: ["720p"], maxImages: 30, route: "Doubao account pool" }
];

export async function GET() {
  const base = process.env.DOLA_POOL_BASE_URL?.replace(/\/+$/, "");
  const key = process.env.DOLA_POOL_API_KEY;
  if (!base || !key) {
    return NextResponse.json({ configured: false, connected: false, models: MODELS, count: MODELS.length, error: "DOLA_POOL_BASE_URL dan DOLA_POOL_API_KEY belum dipasang di Vercel." });
  }
  try {
    const response = await fetch(base + "/health", { cache: "no-store", signal: AbortSignal.timeout(10000) });
    const health = await response.json().catch(() => ({}));
    return NextResponse.json({ configured: true, connected: response.ok && health?.ok !== false, models: MODELS, count: MODELS.length, pool: health?.pool || null, available: health?.available ?? response.ok, source: "Dola Pool /health + documented model catalog" });
  } catch (error) {
    return NextResponse.json({ configured: true, connected: false, models: MODELS, count: MODELS.length, error: error instanceof Error ? error.message : String(error) });
  }
}
