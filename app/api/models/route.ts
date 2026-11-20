import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Verified RelayRouter Seedance 2.5 model from its dedicated async video API.
const MODELS = [
  {
    id: "doubao-seedance-2-5-260628:floor",
    name: "Seedance 2.5 · Lowest price",
    minDuration: 4,
    maxDuration: 30,
    durations: [4, 5, 6, 8, 10, 12, 15, 20, 25, 30],
    resolutions: ["480p", "720p", "1080p"],
    maxImages: 9,
    route: "RelayRouter · :floor (lowest price)"
  }
];

export async function GET() {
  const configured = Boolean(process.env.RELAYROUTER_API_KEY);
  return NextResponse.json({
    configured,
    connected: configured,
    models: MODELS,
    count: MODELS.length,
    provider: "RelayRouter",
    routing: "floor",
    note: configured ? "API key tersedia di server. Koneksi akan diverifikasi saat permintaan dibuat." : "RELAYROUTER_API_KEY belum dipasang di Vercel."
  });
}
