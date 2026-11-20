import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function findVideoUrl(value: any): string | null {
  if (!value || typeof value !== "object") return null;
  if (typeof value.video_url === "string") return value.video_url;
  if (typeof value.videoUrl === "string") return value.videoUrl;
  if (typeof value.url === "string" && /video|mp4/i.test(String(value.type || value.mime_type || ""))) return value.url;
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) { const found = findVideoUrl(item); if (found) return found; }
    } else if (child && typeof child === "object") {
      const found = findVideoUrl(child); if (found) return found;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const key = process.env.RELAYROUTER_API_KEY;
  if (!key) return NextResponse.json({ error: "RELAYROUTER_API_KEY belum dipasang di Vercel." }, { status: 503 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Task ID diperlukan." }, { status: 400 });

  try {
    const response = await fetch("https://api.relayrouter.ai/api/v3/contents/generations/tasks/" + encodeURIComponent(id), {
      headers: { Authorization: "Bearer " + key, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000)
    });
    const raw = await response.text();
    let data: any;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { return NextResponse.json({ error: "Respons status RelayRouter bukan JSON." }, { status: 502 }); }

    if (!response.ok) {
      const message = data?.message || data?.detail || data?.error || raw.slice(0, 400);
      return NextResponse.json({ error: "RelayRouter (" + response.status + "): " + String(message) }, { status: response.status >= 400 && response.status < 500 ? response.status : 502 });
    }

    const root = data?.data || data?.result || data;
    const status = String(root?.status || root?.task_status || "processing").toLowerCase();
    const videoUrl = findVideoUrl(root);
    const failed = ["failed", "error", "cancelled", "canceled", "expired"].includes(status);
    const completed = ["succeeded", "success", "completed", "done"].includes(status);
    return NextResponse.json({
      id,
      status: completed && videoUrl ? "completed" : status,
      videoUrl,
      error: failed ? String(root?.error?.message || root?.error || root?.message || "Tugas gagal.") : null,
      progress: root?.progress ?? root?.percentage ?? null,
      resolution: root?.resolution || null,
      duration: root?.duration || null
    });
  } catch (error) {
    return NextResponse.json({ error: "Tidak dapat memeriksa tugas di RelayRouter: " + (error instanceof Error ? error.message : String(error)) }, { status: 502 });
  }
}
