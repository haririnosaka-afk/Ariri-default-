import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const API_URL = "https://api.relayrouter.ai/api/v3/contents/generations/tasks";
const MODEL_CONFIG: Record<string, { label: string; resolutions: string[] }> = {
  "doubao-seedance-2-5-260628": {
    label: "Seedance 2.5",
    resolutions: ["480p", "720p", "1080p"]
  },
  "doubao-seedance-2-5-flash-261115": {
    label: "Seedance 2.5 Flash",
    resolutions: ["480p", "720p"]
  }
};

export async function POST(req: NextRequest) {
  const key = process.env.RELAYROUTER_API_KEY;
  if (!key) return NextResponse.json({ error: "RELAYROUTER_API_KEY belum dipasang di Vercel." }, { status: 503 });

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Data permintaan tidak valid." }, { status: 400 }); }

  const model = String(body.model || "doubao-seedance-2-5-flash-261115");
  const config = MODEL_CONFIG[model];
  const prompt = String(body.prompt || "").trim();
  const duration = Number(body.duration);
  const ratio = String(body.ratio || "16:9");
  const resolution = String(body.resolution || body.size || "720p");
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((v: unknown) => typeof v === "string" && /^https:\/\//i.test(v))
    : [];

  if (!config) return NextResponse.json({ error: "Model Seedance yang dipilih tidak tersedia." }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "Prompt wajib diisi." }, { status: 400 });
  if (!Number.isInteger(duration) || duration < 4 || duration > 30) return NextResponse.json({ error: config.label + " mendukung durasi 4–30 detik." }, { status: 400 });
  if (!["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"].includes(ratio)) return NextResponse.json({ error: "Rasio video tidak valid." }, { status: 400 });
  if (!config.resolutions.includes(resolution)) return NextResponse.json({ error: config.label + " mendukung resolusi " + config.resolutions.join(", ") + "." }, { status: 400 });
  if (imageUrls.length > 9) return NextResponse.json({ error: "Maksimal 9 foto referensi untuk permintaan ini." }, { status: 400 });

  const content: any[] = [{ type: "text", text: prompt }];
  for (const url of imageUrls) {
    content.push({ type: "image_url", role: "reference_image", image_url: { url } });
  }

  const payload = {
    model,
    content,
    duration,
    generate_audio: body.generateAudio === true,
    omni_reference_task_type: "auto",
    output_format: "mp4",
    ratio,
    size: resolution,
    watermark: false
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(55000)
    });
    const raw = await response.text();
    let data: any;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { return NextResponse.json({ error: "RelayRouter mengirim respons bukan JSON.", details: raw.slice(0, 400) }, { status: 502 }); }

    if (!response.ok) {
      const message = data?.message || data?.detail || data?.error?.message || data?.error || raw.slice(0, 500) || "Permintaan ditolak.";
      return NextResponse.json({ error: "RelayRouter (" + response.status + "): " + String(message) }, { status: response.status >= 400 && response.status < 500 ? response.status : 502 });
    }

    const root = data?.data || data?.result || data;
    const id = root?.id || root?.task_id || root?.taskId || data?.id || data?.task_id;
    if (!id) return NextResponse.json({ error: "RelayRouter tidak mengembalikan task ID.", details: data }, { status: 502 });

    return NextResponse.json({
      ok: true,
      id: String(id),
      status: root?.status || data?.status || "queued",
      model: config.label,
      duration,
      resolution,
      ratio
    });
  } catch (error) {
    return NextResponse.json({ error: "Koneksi ke RelayRouter gagal: " + (error instanceof Error ? error.message : String(error)) }, { status: 502 });
  }
}
