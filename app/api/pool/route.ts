import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let base = process.env.DOLA_POOL_BASE_URL || "";
  while (base.endsWith("/")) base = base.slice(0, -1);
  const key = process.env.DOLA_POOL_API_KEY;

  if (!base || !key) {
    return NextResponse.json({
      configured: false,
      connected: false,
      message: "Dola Pool belum dikonfigurasi.",
    }, { status: 503 });
  }

  try {
    const response = await fetch(base + "/health", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json().catch(() => ({} as any));
    if (!response.ok) {
      return NextResponse.json({
        configured: true,
        connected: false,
        message: "Health check Dola Pool gagal (" + response.status + ").",
      }, { status: 502 });
    }

    // Only expose aggregate pool health. Never return account names, cookies,
    // proxy details, or other provider-side account metadata to the browser.
    const pool = data.pool || {};
    const counts = {
      total: Number(pool.account_count || 0),
      healthy: Number(pool.healthy_count || 0),
      standby: Number(pool.standby_count || 0),
      cooldown: Number(pool.cooldown_count || 0),
      expired: Number(pool.expired_count || 0),
      inflight: Number(pool.inflight || 0),
      jobsToday: Number(pool.jobs_today || 0),
      queued: Number(data.queue?.queued ?? data.pending_tasks ?? 0),
      running: Number(data.queue?.running ?? 0),
    };

    return NextResponse.json({
      configured: true,
      connected: data.ok === true,
      available: data.available === true,
      counts,
      message: data.available === true
        ? "Pool terhubung dan melaporkan kapasitas tersedia."
        : "Pool terhubung, tetapi saat ini tidak melaporkan kapasitas tersedia.",
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      connected: false,
      message: "Tidak dapat menghubungi Dola Pool: " +
        (error instanceof Error ? error.message : String(error)),
    }, { status: 502 });
  }
}
