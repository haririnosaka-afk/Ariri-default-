import { NextRequest, NextResponse } from "next/server";
import { getDoubaoSlots, nextDoubaoSlot } from "@/lib/doubao-pool";
export const runtime = "nodejs";
export const maxDuration = 60;
async function parse(response: Response) { const raw = await response.text(); try { return { data: raw ? JSON.parse(raw) : {}, raw }; } catch { return { data: null as any, raw }; } }
export async function POST(req: NextRequest) {
  const expectedCode = process.env.DOUBAO_POOL_ACCESS_CODE;
  if (!expectedCode) return NextResponse.json({ error: "DOUBAO_POOL_ACCESS_CODE belum diatur di Vercel." }, { status: 503 });
  if (req.headers.get("x-kazama-pool-code") !== expectedCode) return NextResponse.json({ error: "Kode akses pool salah." }, { status: 401 });
  const slots = getDoubaoSlots();
  if (!slots.length) return NextResponse.json({ error: "Pool Doubao belum dikonfigurasi. Tambahkan DOUBAO_ARK_API_KEYS di Vercel." }, { status: 503 });
  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 }); }
  const model = String(body.model || "doubao-seedance-2-5-260628");
  const isFlash = model === "doubao-seedance-2-5-flash-261115";
  if (!isFlash && model !== "doubao-seedance-2-5-260628") return NextResponse.json({ error: "Model Doubao tidak didukung oleh pool ini." }, { status: 400 });
  const duration = Number(body.duration ?? 30), resolution = String(body.resolution || "720p"), ratio = String(body.ratio || "16:9"), prompt = String(body.prompt || "").trim();
  const urls = Array.isArray(body.imageUrls) ? body.imageUrls.filter((value: any) => typeof value === "string" && /^https:\/\//i.test(value)) : [];
  if (!prompt) return NextResponse.json({ error: "Prompt wajib diisi." }, { status: 400 });
  if (!Number.isInteger(duration) || duration < 4 || duration > 30) return NextResponse.json({ error: "Durasi harus 4–30 detik." }, { status: 400 });
  if (isFlash && urls.length > 10) return NextResponse.json({ error: "Seedance 2.5 Flash maksimal 10 foto referensi." }, { status: 400 });
  if (!isFlash && urls.length > 30) return NextResponse.json({ error: "Seedance 2.5 maksimal 30 foto referensi." }, { status: 400 });
  if (!(isFlash ? ["480p", "720p"] : ["480p", "720p", "1080p", "4k"]).includes(resolution)) return NextResponse.json({ error: "Resolusi tidak didukung model yang dipilih." }, { status: 400 });
  if (!["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"].includes(ratio)) return NextResponse.json({ error: "Rasio tidak valid." }, { status: 400 });
  const content: any[] = [{ type: "text", text: prompt }, ...urls.map((url: string) => ({ type: "image_url", role: "reference_image", image_url: { url } }))];
  const payload = { model, content, duration, ratio, resolution, generate_audio: Boolean(body.generateAudio), watermark: Boolean(body.watermark), output_format: "mp4" };
  const first = nextDoubaoSlot(), order = Array.from({ length: slots.length }, (_, offset) => (first + offset) % slots.length);
  let lastError = "Tidak ada akun Doubao yang dapat memproses permintaan.";
  for (const slotIndex of order) {
    const slot = slots[slotIndex];
    try {
      const response = await fetch(slot.baseUrl + "/contents/generations/tasks", { method: "POST", headers: { Authorization: "Bearer " + slot.apiKey, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(55000) });
      const { data, raw } = await parse(response);
      if (response.ok) {
        const taskId = data?.id || data?.task_id || data?.data?.id;
        if (!taskId) return NextResponse.json({ error: "Ark menerima request tetapi tidak mengembalikan task ID.", details: data || raw.slice(0, 400) }, { status: 502 });
        return NextResponse.json({ ok: true, id: String(taskId), status: data?.status || "queued", provider: "doubao-ark", providerSlot: slotIndex, model, accountLabel: slot.label });
      }
      lastError = String(data?.message || data?.error?.message || data?.error || raw.slice(0, 350) || "Ark API menolak request.");
      if (response.status !== 429) return NextResponse.json({ error: "Doubao Ark (" + response.status + "): " + lastError, providerSlot: slotIndex }, { status: response.status >= 500 ? 502 : response.status });
    } catch (error) { return NextResponse.json({ error: "Koneksi terputus setelah request dikirim. Status penerimaan belum pasti; tidak mencoba akun lain agar tidak membuat tagihan ganda. " + (error instanceof Error ? error.message : String(error)) }, { status: 502 }); }
  }
  return NextResponse.json({ error: "Semua akun dalam pool sedang sibuk atau gagal. " + lastError }, { status: 503 });
}
