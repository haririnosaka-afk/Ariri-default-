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

// Return only fields useful for comparing requested duration, delivered duration,
// task mode and provider-reported usage. Never return credentials or raw payloads.
function collectDiagnostics(value: any): Record<string, unknown> {
  const keys = [
    "duration", "video_duration", "output_duration", "requested_duration",
    "task_type", "omni_reference_task_type", "mode", "draft", "draft_task",
    "usage", "billing", "cost", "price", "credits", "tokens",
    "model", "model_name", "status", "task_status"
  ];
  const out: Record<string, unknown> = {};
  const visit = (node: any, depth: number) => {
    if (!node || typeof node !== "object" || depth > 4) return;
    for (const [key, val] of Object.entries(node)) {
      if (keys.includes(key.toLowerCase()) && (typeof val !== "object" || val === null)) out[key] = val;
      if (["usage", "billing", "cost", "price", "credits", "tokens", "meta", "metadata", "data", "result"].includes(key.toLowerCase()) && val && typeof val === "object") {
        if (Array.isArray(val)) continue;
        const safe: Record<string, unknown> = {};
        for (const [childKey, childVal] of Object.entries(val as Record<string, unknown>)) {
          if (/duration|usage|bill|cost|price|credit|token|model|task|draft|status|seconds|amount|unit/i.test(childKey) &&
              (childVal === null || ["string", "number", "boolean"].includes(typeof childVal))) safe[childKey] = childVal;
        }
        if (Object.keys(safe).length) out[key] = safe;
      }
      if (val && typeof val === "object" && !Array.isArray(val)) visit(val, depth + 1);
    }
  };
  visit(value, 0);
  return out;
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
      duration: root?.duration ?? root?.video_duration ?? root?.output_duration ?? null,
      diagnostics: collectDiagnostics(data)
    });
  } catch (error) {
    return NextResponse.json({ error: "Tidak dapat memeriksa tugas di RelayRouter: " + (error instanceof Error ? error.message : String(error)) }, { status: 502 });
  }
}
