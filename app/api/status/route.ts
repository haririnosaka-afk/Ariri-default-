import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const base = process.env.DOLA_POOL_BASE_URL?.replace(/\/+$/, "");
  const key = process.env.DOLA_POOL_API_KEY;
  if (!base || !key) return NextResponse.json({ error: "Pool server belum dihubungkan." }, { status: 503 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Task ID diperlukan." }, { status: 400 });
  try {
    const response = await fetch(base + "/v1/videos/" + encodeURIComponent(id), {
      headers: { Authorization: "Bearer " + key, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    });
    const raw = await response.text();
    let data: any;
    try { data = raw ? JSON.parse(raw) : {}; } catch { return NextResponse.json({ error: "Respons status Dola Pool bukan JSON." }, { status: 502 }); }
    if (!response.ok) {
      const message = data?.detail || data?.error || raw.slice(0, 400);
      return NextResponse.json({ error: "Dola Pool (" + response.status + "): " + String(message) }, { status: response.status >= 400 && response.status < 500 ? response.status : 502 });
    }
    const root = data?.data || data?.result || data;
    const status = String(root.status || "processing").toLowerCase();
    const videoUrl = root.video_url || root.video_url_hd || root.output?.video_url || null;
    const failed = ["failed", "error", "cancelled", "expired"].includes(status);
    return NextResponse.json({
      id, status, videoUrl,
      error: failed ? String(root.error?.message || root.error || root.detail || "Tugas gagal.") : null,
      progress: root.progress || null,
      resolution: root.resolution || null,
      duration: root.duration || null
    });
  } catch (error) {
    return NextResponse.json({ error: "Tidak dapat memeriksa tugas di Dola Pool: " + (error instanceof Error ? error.message : String(error)) }, { status: 502 });
  }
}
