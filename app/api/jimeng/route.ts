// app/api/jimeng/route.ts
// FILE BARU, additive saja. Jalur Jimeng untuk KAZAMA AI — terpisah dari NexaBot.
// Tidak mengubah app/api/studio/route.ts, tidak memotong Credit KAZAMA,
// tidak menyentuh Supabase token_ledger / generation_jobs.
// Jimeng memakai kredit gratis akun Jimeng sendiri (pool JIMENG_SESSIONIDS),
// jadi generate di sini TIDAK memotong Credit KAZAMA. Itu sengaja, sesuai
// tujuan pool: pakai kuota gratis harian akun Jimeng.
//
// Auth: hanya user KAZAMA yang sudah login (Supabase, sama seperti studio).
// Sessionid TIDAK PERNAH dikirim ke browser — hanya dipakai server-side
// dari env Vercel JIMENG_SESSIONIDS / JIMENG_COOKIE.
//
// Endpoints:
//   GET  /api/jimeng?resource=catalog  -> daftar model video live dari Jimeng (gratis)
//   GET  /api/jimeng?resource=credit   -> sisa kredit akun Jimeng pertama (gratis)
//   GET  /api/jimeng?resource=status&historyId=..&account=jimeng-1 -> 1x cek status
//   POST /api/jimeng  {prompt, model?, duration?, ratio?, resolution?}
//        -> submit ke Jimeng, coba akun berikutnya kalau akun pertama gagal
//           (login expired / kredit habis), return {historyId, account, model, duration}

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import {
  getJimengAccounts,
  getJimengAccountById,
  buildCookieHeader,
  fetchCatalog,
  readCredit,
  resolveVideoModel,
  submitVideo,
  getHistory,
  JIMENG_FLASH_KEY,
  JIMENG_PRO_KEY,
} from "@/lib/jimeng";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function currentUser() {
  const s = await supabaseServer();
  const { data, error } = await s.auth.getUser();
  if (error || !data.user) throw Object.assign(new Error("Silakan masuk terlebih dahulu."), { status: 401 });
  return data.user;
}

function err(e: unknown, fallback = 502) {
  const status = (e as any)?.status || fallback;
  return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status });
}

export async function GET(req: NextRequest) {
  try {
    await currentUser();
  } catch (e) {
    return err(e, 401);
  }
  const q = req.nextUrl.searchParams;
  const resource = q.get("resource") || "catalog";
  const accounts = getJimengAccounts();
  if (accounts.length === 0) {
    return NextResponse.json(
      { ok: false, error: "JIMENG_SESSIONIDS belum diisi di Vercel Environment Variables. Isi dulu, lalu redeploy." },
      { status: 402 },
    );
  }
  try {
    if (resource === "catalog") {
      const cookie = buildCookieHeader(accounts[0].sessionid);
      const catalog = await fetchCatalog(cookie);
      return NextResponse.json({
        ok: true,
        accounts: accounts.map((a) => a.id),
        flash: catalog.videos.find((m) => m.key === JIMENG_FLASH_KEY) || null,
        pro: catalog.videos.find((m) => m.key === JIMENG_PRO_KEY) || null,
        videos: catalog.videos,
      });
    }
    if (resource === "credit") {
      const cookie = buildCookieHeader(accounts[0].sessionid);
      const credit = await readCredit(cookie);
      return NextResponse.json({ ok: true, account: accounts[0].id, credit });
    }
    if (resource === "status") {
      const historyId = q.get("historyId") || "";
      const accountId = q.get("account") || accounts[0].id;
      if (!historyId) return NextResponse.json({ ok: false, error: "historyId wajib diisi." }, { status: 400 });
      const account = getJimengAccountById(accountId) || accounts[0];
      const cookie = buildCookieHeader(account.sessionid);
      const result = await getHistory(cookie, historyId);
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ ok: false, error: "Resource tidak dikenal." }, { status: 400 });
  } catch (e) {
    return err(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await currentUser();
  } catch (e) {
    return err(e, 401);
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON tidak valid." }, { status: 400 });
  }
  const prompt = String(body.prompt || "").trim();
  const duration = Number(body.duration ?? 30);
  const ratio = String(body.ratio || "16:9");
  const resolution = String(body.resolution || "720p");
  const modelKey = String(body.model || JIMENG_FLASH_KEY);
  if (!prompt) return NextResponse.json({ ok: false, error: "Prompt wajib diisi." }, { status: 400 });
  if (![4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].includes(duration)) {
    return NextResponse.json({ ok: false, error: "Durasi Jimeng hanya 4–30 detik." }, { status: 400 });
  }
  const accounts = getJimengAccounts();
  if (accounts.length === 0) {
    return NextResponse.json(
      { ok: false, error: "JIMENG_SESSIONIDS belum diisi di Vercel Environment Variables. Isi dulu, lalu redeploy." },
      { status: 402 },
    );
  }
  const errors: string[] = [];
  for (const account of accounts) {
    try {
      const cookie = buildCookieHeader(account.sessionid);
      const resolved = await resolveVideoModel(cookie, { key: modelKey, duration, ratio });
      const historyId = await submitVideo(cookie, {
        prompt,
        model: resolved.model.key,
        ratio: resolved.ratio,
        duration: resolved.duration,
        resolution,
      });
      return NextResponse.json({
        ok: true,
        historyId,
        account: account.id,
        model: resolved.model.key,
        modelName: resolved.model.name,
        duration: resolved.duration,
        ratio: resolved.ratio,
        resolution,
      });
    } catch (e) {
      errors.push(`${account.id}: ${e instanceof Error ? e.message : String(e)}`);
      // Coba akun berikutnya (pool). Kalau ini akun terakhir, error dikembalikan di bawah.
    }
  }
  return NextResponse.json(
    { ok: false, error: "Semua akun Jimeng gagal submit. " + errors.join(" | ") },
    { status: 502 },
  );
}
