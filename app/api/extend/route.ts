import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
const API_URL = "https://api.relayrouter.ai/api/v3/contents/generations/tasks";
const ALLOWED_MODELS = new Set([
  "doubao-seedance-2-5-flash-261115",
  "doubao-seedance-2-5-260628"
]);

export async function POST(req: NextRequest) {
  const key = process.env.RELAYROUTER_API_KEY;
  if (!key) return NextResponse.json({ error: "RELAYROUTER_API_KEY belum dipasang di Vercel." }, { status: 503 });

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Data permintaan lanjutan tidak valid." }, { status: 400 }); }

  const model = String(body.model || "");
  const prompt = String(body.prompt || "").trim();
  const videoUrl = String(body.videoUrl || "");
  const resolution = String(body.resolution || "720p");
  if (!ALLOWED_MODELS.has(model)) return NextResponse.json({ error: "Model Seedance tidak didukung untuk proses lanjutan." }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "Prompt lanjutan wajib diisi." }, { status: 400 });
  if (!/^https:\/\//i.test(videoUrl)) return NextResponse.json({ error: "URL video referensi tidak valid." }, { status: 400 });
  if (!["480p", "720p", "1080p"].includes(resolution)) return NextResponse.json({ error: "Resolusi tidak valid." }, { status: 400 });

  // Seedance native continuation: the first 5-second result becomes a
  // reference_video; this request asks the provider for the remaining 25s.
  const payload = {
    model,
    content: [
      { type: "text", text: prompt + "\nContinue seamlessly from the supplied reference video. Preserve the same subjects, identity, scene, visual style, camera continuity and action. Generate new continuous motion; do not replay or slow down the reference." },
      { type: "video_url", role: "reference_video", video_url: { url: videoUrl } }
    ],
    duration: 25,
    ratio: "adaptive",
    size: resolution,
    output_format: "mp4",
    omni_reference_task_type: "extend",
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
    catch { return NextResponse.json({ error: "RelayRouter mengirim respons lanjutan bukan JSON.", details: raw.slice(0, 400) }, { status: 502 }); }

    if (!response.ok) {
      const message = data?.message || data?.detail || data?.error?.message || data?.error || raw.slice(0, 500) || "Permintaan extend ditolak.";
      return NextResponse.json({ error: "RelayRouter extend (" + response.status + "): " + String(message) }, { status: response.status >= 400 && response.status < 500 ? response.status : 502 });
    }

    const root = data?.data || data?.result || data;
    const id = root?.id || root?.task_id || root?.taskId || data?.id || data?.task_id;
    if (!id) return NextResponse.json({ error: "RelayRouter tidak mengembalikan task ID extend.", details: data }, { status: 502 });
    return NextResponse.json({ ok: true, id: String(id), status: root?.status || data?.status || "queued", duration: 25, stage: "extension" });
  } catch (error) {
    return NextResponse.json({ error: "Koneksi proses extend gagal: " + (error instanceof Error ? error.message : String(error)) }, { status: 502 });
  }
}
