import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE = "https://seedanceoflegends.com/mx/v1";
const PROVIDER = "seedanceoflegends";

function dbAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Database KAZAMA belum dikonfigurasi.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function isAdmin(email?: string) {
  return !!email && !!process.env.KAZAMA_ADMIN_EMAIL &&
    email.toLowerCase() === process.env.KAZAMA_ADMIN_EMAIL.toLowerCase();
}

async function currentUser(req: NextRequest) {
  const internal = req.headers.get("x-kazama-internal-secret");
  if (internal && internal === process.env.TELEGRAM_WEBHOOK_SECRET) {
    const telegramId = Number(req.headers.get("x-kazama-telegram-user-id") || 0);
    if (!Number.isSafeInteger(telegramId) || telegramId <= 0)
      throw Object.assign(new Error("Identitas Telegram tidak valid."), { status: 401 });
    const db = dbAdmin();
    const { data: link } = await db.from("telegram_account_links").select("user_id")
      .eq("telegram_user_id", telegramId).maybeSingle();
    let userId = link?.user_id as string | undefined;
    if (!userId) {
      const { data: native } = await db.from("telegram_native_accounts").select("user_id")
        .eq("telegram_user_id", telegramId).maybeSingle();
      userId = native?.user_id as string | undefined;
    }
    if (!userId) throw Object.assign(new Error("Akun Telegram belum terhubung."), { status: 401 });
    const { data: profile, error } = await db.from("profiles").select("id,email").eq("id", userId).single();
    if (error || !profile) throw Object.assign(new Error("Profil akun Telegram tidak ditemukan."), { status: 401 });
    return { id: profile.id, email: profile.email || "", source: "telegram" };
  }
  const client = await supabaseServer();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw Object.assign(new Error("Silakan masuk terlebih dahulu."), { status: 401 });
  return { ...data.user, source: "website" };
}

function apiHeaders(extra: Record<string, string> = {}) {
  const key = process.env.SEEDANCE_KEY;
  if (!key) throw Object.assign(new Error("API Seedance belum dikonfigurasi di server."), { status: 503 });
  return { Authorization: "Bearer " + key, ...extra };
}

async function providerJson(response: Response) {
  const raw = await response.text();
  let data: any;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch { throw Object.assign(new Error("Respons Seedance tidak valid."), { status: 502 }); }
  if (!response.ok) {
    const message = String(data?.detail || data?.error || "Seedance sedang tidak tersedia.");
    throw Object.assign(new Error(message), { status: response.status });
  }
  return data;
}

function jsonError(error: any) {
  return NextResponse.json(
    { ok: false, error: error instanceof Error ? error.message : String(error) },
    { status: Number(error?.status) || 500 }
  );
}

export async function GET(req: NextRequest) {
  let user: any;
  try { user = await currentUser(req); } catch (error) { return jsonError(error); }
  try {
    const query = req.nextUrl.searchParams;
    const resource = query.get("resource") || "models";
    if (resource === "models" || resource === "balance" || resource === "videos") {
      const path = resource === "models" ? "/models" : resource === "balance" ? "/balance" : "/videos?limit=20";
      const response = await fetch(BASE + path, {
        headers: apiHeaders(), cache: "no-store", signal: AbortSignal.timeout(30000)
      });
      return NextResponse.json(await providerJson(response));
    }
    if (resource === "video") {
      const id = String(query.get("id") || "").trim();
      if (!id) return NextResponse.json({ ok: false, error: "ID video wajib diisi." }, { status: 400 });
      const db = dbAdmin();
      const { data: row, error } = await db.from("generation_jobs")
        .select("id,user_id,provider_job_id,token_reference,provider,status")
        .eq("user_id", user.id).eq("provider", PROVIDER).eq("provider_job_id", id).maybeSingle();
      if (error || !row) return NextResponse.json({ ok: false, error: "Video tidak ditemukan di akun ini." }, { status: 404 });
      const response = await fetch(BASE + "/videos/" + encodeURIComponent(id), {
        headers: apiHeaders(), cache: "no-store", signal: AbortSignal.timeout(30000)
      });
      const video = await providerJson(response);
      const status = String(video.status || "queued").toLowerCase();
      await db.from("generation_jobs").update({ status }).eq("id", row.id).eq("user_id", user.id);
      if (status === "failed" && row.status !== "failed" && row.token_reference && !String(row.token_reference).startsWith("admin-")) {
        await db.rpc("refund_token", {
          p_user_id: user.id,
          p_reference_id: row.token_reference,
          p_reason: "Seedance video generation failed"
        });
      }
      return NextResponse.json({ ...video, ok: true });
    }
    return NextResponse.json({ ok: false, error: "Resource tidak dikenal." }, { status: 400 });
  } catch (error) { return jsonError(error); }
}

export async function POST(req: NextRequest) {
  let user: any;
  try { user = await currentUser(req); } catch (error) { return jsonError(error); }
  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    try {
      const incoming = await req.formData();
      const file = incoming.get("file");
      if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "File referensi wajib dipilih." }, { status: 400 });
      if (file.size > 30 * 1024 * 1024) return NextResponse.json({ ok: false, error: "Ukuran file maksimal 30 MB." }, { status: 400 });
      const outgoing = new FormData();
      outgoing.append("file", file, file.name);
      const kind = incoming.get("kind");
      if (typeof kind === "string" && kind) outgoing.append("kind", kind);
      const response = await fetch(BASE + "/files", {
        method: "POST", headers: apiHeaders(), body: outgoing,
        cache: "no-store", signal: AbortSignal.timeout(60000)
      });
      return NextResponse.json(await providerJson(response));
    } catch (error) { return jsonError(error); }
  }
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Body JSON tidak valid." }, { status: 400 });
  }
  const resource = String(body.resource || "generate");
  if (resource !== "generate") {
    return NextResponse.json({ ok: false, error: "Resource tidak dikenal." }, { status: 400 });
  }
  const model = String(body.model || "").trim();
  const prompt = String(body.prompt || "").trim();
  const duration = Number(body.duration);
  const aspectRatio = String(body.aspect_ratio || "16:9");
  if (!model || !prompt || !Number.isInteger(duration) || duration < 1) {
    return NextResponse.json({ ok: false, error: "Model, prompt, dan durasi yang valid wajib diisi." }, { status: 400 });
  }
  for (const field of ["images", "videos", "audios"]) {
    if (body[field] !== undefined && (!Array.isArray(body[field]) || body[field].some((x: any) => typeof x !== "string"))) {
      return NextResponse.json({ ok: false, error: "Daftar referensi " + field + " tidak valid." }, { status: 400 });
    }
  }

  const db = dbAdmin();
  const admin = isAdmin(user.email);
  const tokenReference = admin ? "admin-" + crypto.randomUUID() : crypto.randomUUID();
  let charged = false;
  let accepted = false;
  try {
    if (!admin) {
      const { error } = await db.rpc("spend_token", {
        p_user_id: user.id, p_reference_id: tokenReference, p_cost_units: 1
      });
      if (error) throw Object.assign(
        new Error(error.message.includes("insufficient_tokens")
          ? "Token tidak cukup. Silakan isi saldo terlebih dahulu."
          : error.message),
        { status: error.message.includes("insufficient_tokens") ? 402 : 500 }
      );
      charged = true;
    }
    const idempotencyKey = crypto.randomUUID();
    const response = await fetch(BASE + "/videos", {
      method: "POST",
      headers: apiHeaders({ "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }),
      body: JSON.stringify({
        model, prompt, duration, aspect_ratio: aspectRatio,
        ...(Array.isArray(body.images) && body.images.length ? { images: body.images } : {}),
        ...(Array.isArray(body.videos) && body.videos.length ? { videos: body.videos } : {}),
        ...(Array.isArray(body.audios) && body.audios.length ? { audios: body.audios } : {})
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(60000)
    });
    const result = await providerJson(response);
    if (!result?.id) throw Object.assign(new Error("Seedance tidak mengembalikan ID video."), { status: 502 });
    accepted = true;
    const { error: insertError } = await db.from("generation_jobs").insert({
      user_id: user.id,
      source: user.source === "telegram" ? "telegram" : "website",
      token_reference: tokenReference,
      provider_job_id: String(result.id),
      provider_task_id: String(result.id),
      provider: PROVIDER,
      status: String(result.status || "queued"),
      model,
      resolution: aspectRatio,
      duration_seconds: duration,
      aspect_ratio: aspectRatio,
      prompt
    });
    if (insertError) {
      console.error("Seedance generation_jobs insert failed:", insertError.message);
      return NextResponse.json({
        ...result, ok: true, token_charged: charged,
        tracking_warning: "Video sudah diterima Seedance, tetapi sinkronisasi riwayat tertunda. Jangan kirim ulang."
      });
    }
    return NextResponse.json({ ...result, ok: true, token_charged: charged, token_reference: tokenReference });
  } catch (error: any) {
    if (charged && !accepted) {
      try {
        await db.rpc("refund_token", {
          p_user_id: user.id, p_reference_id: tokenReference,
          p_reason: "Seedance request failed before provider accepted it"
        });
      } catch (refundError) { console.error("Seedance token refund failed:", refundError); }
    }
    return jsonError(error);
  }
}
