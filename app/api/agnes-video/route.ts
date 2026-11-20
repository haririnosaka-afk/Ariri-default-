import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const BASE = (process.env.AGNES_BASE_URL || "https://apihub.agnes-ai.com/v1").replace(/\\/+$/, "");
const MODEL = "agnes-video-2.5-flash";
export async function POST(req: NextRequest) {
  const key = process.env.AGNES_API_KEY;
  if (!key) return NextResponse.json({ error: "Agnes belum dikonfigurasi. Tambahkan AGNES_API_KEY di Vercel." }, { status: 503 });
  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: "Data permintaan tidak valid." }, { status: 400 }); }
  const prompt = String(body.prompt || "").trim();
  const mode = String(body.mode || "text");
  const seconds = String(body.seconds || "5");
  const ratio = String(body.aspect_ratio || "16:9");
  const images = Array.isArray(body.images) ? body.images.filter((x: unknown) => typeof x === "string" && /^https?:\\/\\//i.test(x.trim())) : [];
  const audios = Array.isArray(body.audios) ? body.audios.filter((x: unknown) => typeof x === "string" && /^https?:\\/\\//i.test(x.trim())) : [];
  const first = String(body.first_frame || "").trim(), last = String(body.last_frame || "").trim();
  if (!prompt) return NextResponse.json({ error: "Prompt wajib diisi." }, { status: 400 });
  if (prompt.length > 7000) return NextResponse.json({ error: "Prompt maksimal 7.000 karakter." }, { status: 400 });
  if (!/^([4-9]|1[0-2])$/.test(seconds)) return NextResponse.json({ error: "Agnes Video 2.5 Flash mendukung durasi 4–12 detik." }, { status: 400 });
  if (!["16:9","21:9","4:3","1:1","3:4","9:16"].includes(ratio)) return NextResponse.json({ error: "Rasio video tidak valid." }, { status: 400 });
  if (!["text","reference","keyframe"].includes(mode)) return NextResponse.json({ error: "Mode video tidak valid." }, { status: 400 });
  if (mode === "text" && (images.length || audios.length || first || last)) return NextResponse.json({ error: "Mode text tidak menerima media referensi." }, { status: 400 });
  if (mode === "reference" && (!images.length && !audios.length)) return NextResponse.json({ error: "Mode reference membutuhkan minimal satu URL foto atau audio publik." }, { status: 400 });
  if (images.length > 5) return NextResponse.json({ error: "Maksimal 5 foto referensi." }, { status: 400 });
  if (audios.length > 3) return NextResponse.json({ error: "Maksimal 3 audio referensi." }, { status: 400 });
  if (mode === "keyframe" && !first && !last) return NextResponse.json({ error: "Mode keyframe membutuhkan first frame atau last frame URL." }, { status: 400 });
  if (mode !== "keyframe" && (first || last)) return NextResponse.json({ error: "First/last frame hanya digunakan pada mode keyframe." }, { status: 400 });
  const payload: any = { model: MODEL, prompt, seconds, mode, size: "720P", aspect_ratio: ratio, n: 1 };
  if (mode === "reference") { if (images.length) payload.images = images; if (audios.length) payload.audios = audios; }
  if (mode === "keyframe") { if (first) payload.first_frame = first; if (last) payload.last_frame = last; }
  try {
    const response = await fetch(BASE + "/videos", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(55000) });
    const raw = await response.text(); let data: any; try { data = raw ? JSON.parse(raw) : {}; } catch { return NextResponse.json({ error: "Respons Agnes Video bukan JSON.", details: raw.slice(0,250) }, { status: 502 }); }
    if (!response.ok) return NextResponse.json({ error: "Agnes Video ("+response.status+"): "+String(data?.detail || data?.error?.message || data?.message || raw.slice(0,350)) }, { status: response.status >= 400 && response.status < 500 ? response.status : 502 });
    const id = data?.video_id || data?.id || data?.task_id;
    if (!id) return NextResponse.json({ error: "Agnes tidak mengembalikan video_id." }, { status: 502 });
    return NextResponse.json({ ok: true, id: String(id), status: String(data?.status || "queued"), model: MODEL, duration: Number(seconds), resolution: "720P", ratio });
  } catch (error) { return NextResponse.json({ error: "Koneksi Agnes Video gagal: " + (error instanceof Error ? error.message : String(error)) }, { status: 502 }); }
}
