import { NextRequest, NextResponse } from "next/server";
import { getDoubaoSlots } from "@/lib/doubao-pool";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const expectedCode = process.env.DOUBAO_POOL_ACCESS_CODE;
  if (!expectedCode) return NextResponse.json({ error: "DOUBAO_POOL_ACCESS_CODE belum diatur di Vercel." }, { status: 503 });
  if (req.headers.get("x-kazama-pool-code") !== expectedCode) return NextResponse.json({ error: "Kode akses pool salah." }, { status: 401 });
  const slots = getDoubaoSlots(), id = req.nextUrl.searchParams.get("id"), slotIndex = Number(req.nextUrl.searchParams.get("slot"));
  if (!id) return NextResponse.json({ error: "Task ID diperlukan." }, { status: 400 });
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= slots.length) return NextResponse.json({ error: "Slot akun tidak valid atau pool berubah." }, { status: 400 });
  const slot = slots[slotIndex];
  try {
    const response = await fetch(slot.baseUrl + "/contents/generations/tasks/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + slot.apiKey, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(25000) });
    const raw = await response.text(); let data: any; try { data = raw ? JSON.parse(raw) : {}; } catch { return NextResponse.json({ error: "Respons status Ark bukan JSON." }, { status: 502 }); }
    if (!response.ok) return NextResponse.json({ error: "Ark API (" + response.status + "): " + String(data?.message || data?.error || raw.slice(0, 300)) }, { status: response.status >= 400 && response.status < 500 ? response.status : 502 });
    const root = data?.data || data?.result || data, videoUrl = root?.content?.video_url || root?.video_url || root?.output?.video_url || null;
    const failed = ["failed", "error", "cancelled", "expired"].includes(String(root?.status || "").toLowerCase());
    return NextResponse.json({ id, status: root?.status || "processing", videoUrl, error: failed ? (root?.error?.message || root?.error || root?.message || "Tugas gagal.") : null, usage: root?.usage || null, resolution: root?.resolution, duration: root?.duration });
  } catch (error) { return NextResponse.json({ error: "Gagal memeriksa status Doubao: " + (error instanceof Error ? error.message : String(error)) }, { status: 502 }); }
}
