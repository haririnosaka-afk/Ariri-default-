import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
const allowedModels = new Set([
  "seedance-2.0-fast", "seedance-2.5",
  "doubao-seedance-2.0-mini", "doubao-seedance-2.0-fast",
  "doubao-seedance-2.0", "doubao-seedance-2.5"
]);
const modelLimits: Record<string, { min: number; max: number; images: number; durations?: number[] }> = {
  "seedance-2.0-fast": { min: 5, max: 10, images: 10, durations: [5, 10] },
  "seedance-2.5": { min: 5, max: 30, images: 10, durations: [5, 10, 30] },
  "doubao-seedance-2.0-mini": { min: 4, max: 15, images: 30 },
  "doubao-seedance-2.0-fast": { min: 4, max: 15, images: 30 },
  "doubao-seedance-2.0": { min: 4, max: 15, images: 30 },
  "doubao-seedance-2.5": { min: 4, max: 30, images: 30 }
};

export async function POST(req: NextRequest) {
  const base = process.env.DOLA_POOL_BASE_URL?.replace(/\/+$/, "");
  const key = process.env.DOLA_POOL_API_KEY;
  if (!base || !key) return NextResponse.json({ error: "Pool server belum dihubungkan. Pasang DOLA_POOL_BASE_URL dan DOLA_POOL_API_KEY di Vercel." }, { status: 503 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Data permintaan tidak valid." }, { status: 400 }); }

  const model = String(body.model || "");
  const prompt = String(body.prompt || "").trim();
  const duration = Number(body.duration);
  const ratio = String(body.ratio || "16:9");
  const resolution = String(body.resolution || "720p");
  const referenceImages = Array.isArray(body.imageUrls) ? body.imageUrls.filter((v: unknown) => typeof v === "string" && /^https:\/\//i.test(v)) : [];

  if (!allowedModels.has(model)) return NextResponse.json({ error: "Model tidak tersedia di katalog Dola Pool." }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "Prompt wajib diisi." }, { status: 400 });
  const limits = modelLimits[model];
  if (!Number.isInteger(duration) || duration < limits.min || duration > limits.max || (limits.durations && !limits.durations.includes(duration))) {
    return NextResponse.json({ error: model + " tidak mendukung durasi " + duration + " detik menurut katalog Dola Pool." }, { status: 400 });
  }
  if (referenceImages.length > limits.images) return NextResponse.json({ error: "Model ini maksimal menerima " + limits.images + " foto referensi." }, { status: 400 });
  if (!["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"].includes(ratio)) return NextResponse.json({ error: "Rasio video tidak valid." }, { status: 400 });
  if (!["720p", "1080p", "2k", "4k"].includes(resolution)) return NextResponse.json({ error: "Resolusi tidak valid." }, { status: 400 });

  const payload: Record<string, unknown> = {
    model, prompt, duration, ratio, resolution,
    reference_images: referenceImages,
    execution_mode: "auto"
  };

  try {
    const response = await fetch(base + "/v1/videos/generations", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(55000)
    });
    const raw = await response.text();
    let data: any;
    try { data = raw ? JSON.parse(raw) : {}; } catch { return NextResponse.json({ error: "Dola Pool mengirim respons bukan JSON.", details: raw.slice(0, 400) }, { status: 502 }); }
    if (!response.ok) {
      const message = data?.detail || data?.error?.message || data?.error || raw.slice(0, 600) || "Pool menolak permintaan.";
      return NextResponse.json({ error: "Dola Pool (" + response.status + "): " + String(message) }, { status: response.status >= 400 && response.status < 500 ? response.status : 502 });
    }
    const id = data?.id || data?.task_id || data?.data?.id;
    if (!id) return NextResponse.json({ error: "Dola Pool tidak mengembalikan task ID.", details: data }, { status: 502 });
    return NextResponse.json({ ok: true, id: String(id), status: data.status || "queued", model, progress: data.progress || null });
  } catch (error) {
    return NextResponse.json({ error: "Koneksi ke Dola Pool gagal: " + (error instanceof Error ? error.message : String(error)) }, { status: 502 });
  }
}
