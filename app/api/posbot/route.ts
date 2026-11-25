import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const POSBOT_BASE = "https://api.posbot.web.id/api/v1";
const TOKEN_PRICE_IDR = 2000;
const BUCKET = "posbot-inputs";

function dbAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Database belum dikonfigurasi.");
  return createClient(url, key, { auth: { persistSession: false } });
}
async function userOrThrow() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw Object.assign(new Error("Silakan masuk terlebih dahulu."), { status: 401 });
  return data.user;
}
function isAdmin(email?: string | null) {
  return !!email && !!process.env.KAZAMA_ADMIN_EMAIL &&
    email.toLowerCase() === process.env.KAZAMA_ADMIN_EMAIL.toLowerCase();
}
function posbotHeaders() {
  const key = process.env.POSBOT_API_KEY;
  if (!key) throw new Error("POSBOT_API_KEY belum terpasang di Vercel.");
  return { Authorization: "Bearer " + key, "Content-Type": "application/json", Accept: "application/json" };
}
async function posbot(path: string, init: RequestInit = {}) {
  const response = await fetch(POSBOT_BASE + path, {
    ...init,
    headers: posbotHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(60000),
  });
  const raw = await response.text();
  let data: any;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch { throw Object.assign(new Error("Respons PosBot tidak valid (" + response.status + ")."), { status: 502 }); }
  if (!response.ok || data?.success === false || data?.ok === false) {
    throw Object.assign(new Error(String(data?.error || data?.message || "PosBot menolak permintaan (" + response.status + ").")), { status: response.status || 502 });
  }
  return data;
}
function unwrapModels(data: any): any[] {
  const value = data?.models ?? data?.data?.models ?? data?.data ?? [];
  return Array.isArray(value) ? value : [];
}
function modelKey(model: any) {
  return String(model?.model_key || model?.public_key || model?.key || model?.id || model?.model || "");
}
function providerCost(model: any) {
  const raw = model?.price ?? model?.price_idr ?? model?.cost_idr ?? model?.cost ?? 0;
  return typeof raw === "number" ? raw : Number(String(raw).replace(/[^0-9]/g, ""));
}
function isImageModel(model: any) {
  const category = String(model?.category || model?.type || model?.group || "").toLowerCase();
  const key = modelKey(model).toLowerCase();
  return category.includes("image") || /^(krea|nano_banana|gpt_image|flux|seedream|face_swap|upscale_4k)/.test(key);
}
const FIXED_CUSTOMER_PRICES_IDR: Record<string, number> = {
  wan_remix: 5000,
  betamotion_1080p_pro: 6000,
  seedance_2_15s: 6000,
  kling_4_15s: 7000,
  wan3_720p_30s: 8000,
  wan3_480p_30s: 6000,
  kling4_720p_20s: 8000,
  wan3_ref_720p_30s: 8000,
  kling4_ref_720p_15s: 8000,
  motion_control_std: 4000,
  kling_30_pro: 5000,
  minimax_music3: 1000,
};
function fixedCustomerPrice(model: any): number | null {
  const key = modelKey(model).toLowerCase();
  if (FIXED_CUSTOMER_PRICES_IDR[key] !== undefined) return FIXED_CUSTOMER_PRICES_IDR[key];
  const name = String(model?.name || model?.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/minimax.*h3.*1080p.*15s|h3.*1080p.*15s/.test(name)) return 5000;
  if (/minimax.*h3.*720p.*30s|h3.*720p.*30s/.test(name)) return 6000;
  if (/minimax.*lipsync.*pro.*30s|lipsync.*pro.*30s/.test(name)) return 6000;
  if (/kling.*3(?:\.0)?.*10s/.test(name)) return 4000;
  return null;
}
function customerTokens(model: any) {
  const fixedPrice = fixedCustomerPrice(model);
  if (fixedPrice !== null) return Math.max(0.5, Math.ceil(fixedPrice / TOKEN_PRICE_IDR * 2) / 2);
  const price = providerCost(model);
  // Model tanpa harga khusus tetap memakai markup modal provider 30%.
  if (isImageModel(model)) return Math.max(0.5, Math.ceil((price * 1.3) / 1000) * 0.5);
  return Math.max(1, Math.ceil((price * 1.3) / TOKEN_PRICE_IDR));
}
function dbJobStatus(value: any) {
  const status = String(value || "").toLowerCase();
  if (["completed", "done", "success", "succeeded"].includes(status)) return "succeeded";
  if (["failed", "error", "cancelled", "canceled", "blocked"].includes(status)) return status === "blocked" ? "blocked" : "failed";
  if (["queued", "submitted", "processing"].includes(status)) return status;
  return "queued";
}
function visibleModel(model: any) {
  const key = modelKey(model);
  if (!key) return false;
  const price = providerCost(model);
  // Semua model aktif dengan tarif valid tetap tampil; biaya jual dihitung terpisah.
  return Number.isFinite(price) && price > 0;
}
const POSBOT_VIDEO_KEYS = new Set([
  "grok_imagine_2_15s","grok_imagine_2_30s","grok_imagine_15_video_720p","betagrok_15s",
  "s2_seedance_25_30s","seedance_25_30s","seedance_30s","s2_25_30s",
  "seedance_25_30s_strict","seedance_lite_30s","seedance_25_lite","seedance_20_15s","seedance_20_15s_legacy","seedance_20_mini",
  "wan_30_hd","wan_30_720p","wan_remix_720p","wan3_hd_15s","wan3_hd_30s","wan3_hd","wan_3_hd_15s","wan_3_hd_30s",
  "minimax_h3","minimax_h3_720p","kling_25_turbo","kling_26_pro_1080p","kling_26_i2v","kling_30_turbo",
  "omni_flash_t2v","omni_flash_sfv","omni_flash_i2v","omni_flash_r2v","omni_flash_11_720p","omni_flash_12_1080p","omni_flash_11","omni_11","omni_flash_12","omni_12",
  "minimax_lipsync","ltx_lipsync",
  "betamotion_hd","betamotion_720p","rh_bmhd","betamotion_1080p","betamotion","betamotion_1080p_pro","betamotion_60fps","betamotion_1080p_max",
  "motion_control_std","kling_26_std","mc_std","motion_control_pro","kling_26_pro","mc_pro",
  "kling_30_std","kling3_std","kling_30_pro","kling3_pro",
  "upscale_video","upscale_hd","upscale_auto","auto_upscale",
  "seedance_25_30s_r2v","seedance_r2v_30s","seedance_20_mini_r2v","kling_30_omni_r2v","wan_30_r2v","minimax_h3_r2v"
]);
function isVideoModel(model: any) {
  const key = modelKey(model).toLowerCase();
  if (key === "watermark_remover") return false;
  if (POSBOT_VIDEO_KEYS.has(key)) return true;
  const name = String(model?.name || model?.title || "").toLowerCase();
  const schema = model?.input_schema || model?.schema || {};
  const inputNames = [
    ...Object.keys(schema?.properties || {}),
    ...(Array.isArray(model?.required_inputs) ? model.required_inputs : []),
    ...(Array.isArray(model?.inputs_required) ? model.inputs_required : []),
    ...(Array.isArray(model?.optional_inputs) ? model.optional_inputs : []),
    ...(Array.isArray(model?.inputs_optional) ? model.inputs_optional : []),
  ].join(" ").toLowerCase();
  const metadata = [
    model?.category, model?.type, model?.group, model?.task_type,
    model?.model_type, model?.task, model?.endpoint, model?.capability,
    model?.capabilities, model?.tasks, model?.supported_tasks, model?.modalities,
  ].filter(Boolean).map((value: any) => Array.isArray(value) ? value.join(" ") : typeof value === "object" ? JSON.stringify(value) : String(value)).join(" ").toLowerCase();
  const combined = key + " " + name + " " + metadata + " " + inputNames;
  if (/audio|music|tts|voice|speech|face[ _-]?swap|upscale[ _-]?image|image[ _-]?generation/.test(metadata + " " + key)) return false;
  return (/\bi2v\b|\bt2v\b|\br2v\b|image[ _-]?to[ _-]?video|text[ _-]?to[ _-]?video|video[ _-]?to[ _-]?video|reference[ _-]?to[ _-]?video|video|motion|lip[ _-]?sync|lipsync/).test(combined);
}
async function getCatalog() {
  const [catalog, statuses] = await Promise.all([
    posbot("/models"),
    posbot("/models/status").catch(() => null),
  ]);
  const statusRows = unwrapModels(statuses || {});
  const statusMap = new Map(statusRows.map((x: any) => [String(x.model_key || x.key || ""), String(x.status || "").toLowerCase()]));
  return unwrapModels(catalog).filter(visibleModel).map((model: any) => {
    const key = modelKey(model);
    const status = statusMap.get(key);
    return {
      ...model,
      model_key: key,
      name: String(model.name || model.title || key),
      price: providerCost(model),
      customer_tokens: customerTokens(model),
      customer_price_idr: customerTokens(model) * TOKEN_PRICE_IDR,
      customer_credits: Math.round(customerTokens(model) * 200),
      status: status || model.status || "active",
    };
  }).filter((model: any) => !["maintenance", "disabled", "inactive"].includes(String(model.status).toLowerCase()))
    // KAZAMA public video catalog: keep only the requested Seedance 2.0 model.
    .filter((model: any) => model.model_key === "seedance_20_15s");
}
async function ensureBucket(db: ReturnType<typeof dbAdmin>) {
  const { data, error } = await db.storage.getBucket(BUCKET);
  if (!data) {
    const { error: createError } = await db.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 50 * 1024 * 1024 });
    if (createError && !/already exists|duplicate/i.test(createError.message)) throw createError;
  }
}
async function uploadDataUrl(db: ReturnType<typeof dbAdmin>, userId: string, item: any, index: number) {
  const value = String(item?.url || item?.data || "");
  const match = value.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) {
    if (/^https?:\/\//i.test(value)) return value;
    throw new Error("File input PosBot tidak valid.");
  }
  const mime = match[1];
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 50 * 1024 * 1024) throw new Error("Ukuran file maksimal 50 MB.");
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("mp4") ? "mp4" : mime.includes("webm") ? "webm" : mime.includes("mpeg") ? "mp3" : mime.includes("wav") ? "wav" : "jpg";
  const path = userId + "/" + crypto.randomUUID() + "-" + index + "." + ext;
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error("Gagal mengunggah file referensi: " + error.message);
  const { data: signed, error: signedError } = await db.storage.from(BUCKET).createSignedUrl(path, 86400);
  if (signedError || !signed?.signedUrl) throw signedError || new Error("Gagal membuat URL referensi sementara.");
  return signed.signedUrl;
}

export async function GET(request: NextRequest) {
  let user: any;
  try { user = await userOrThrow(); }
  catch (error: any) { return NextResponse.json({ ok: false, error: error.message }, { status: error.status || 401 }); }
  const resource = request.nextUrl.searchParams.get("resource") || "models";
  try {
    if (resource === "debug-seedance") {
      if (!isAdmin(user.email)) return NextResponse.json({ ok: false, error: "Akses admin diperlukan." }, { status: 403 });
      return NextResponse.json({ ok: true, seedance_models: [] });
    }
    if (resource === "settings") return NextResponse.json({ configured: !!process.env.POSBOT_API_KEY });
    if (resource === "models" || resource === "video-models") {
      return NextResponse.json({ ok: true, provider: "PosBot", models: [] });
    }
    if (resource === "balance") {
      const data = await posbot("/balance");
      return NextResponse.json({ ok: true, balance: data.saldo_generate ?? data.balance ?? data.data?.saldo_generate ?? null, currency: data.currency || "IDR" });
    }
    if (resource === "status") {
      const id = String(request.nextUrl.searchParams.get("id") || "");
      if (!id) return NextResponse.json({ ok: false, error: "ID tugas tidak valid." }, { status: 400 });
      const db = dbAdmin();
      const { data: row, error } = await db.from("generation_jobs").select("*")
        .eq("user_id", user.id).eq("provider", "posbot").eq("provider_job_id", id).single();
      if (error || !row) return NextResponse.json({ ok: false, error: "Tugas tidak ditemukan pada akun ini." }, { status: 404 });
      const data = await posbot("/status/" + encodeURIComponent(id));
      const job = data.job || data.data || data;
      const status = String(job.status || job.state || row.status || "processing").toLowerCase();
      const resultUrl = job.result_url || job.url || row.result_url || null;
      const failed = ["failed", "error", "cancelled", "canceled"].includes(status);
      const completed = ["completed", "done", "success"].includes(status);
      await db.from("generation_jobs").update({
        status: failed ? "failed" : completed ? "succeeded" : dbJobStatus(status),
        result_url: resultUrl,
        error_message: job.error || job.message || null,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      if (failed && row.token_reference) {
        await db.rpc("refund_token", { p_user_id: user.id, p_reference_id: row.token_reference, p_reason: "PosBot job " + status });
      }
      return NextResponse.json({ ok: true, job_id: id, status, progress: job.progress ?? null, result_url: resultUrl, error: job.error || null });
    }
    return NextResponse.json({ ok: false, error: "Resource PosBot tidak dikenal." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "PosBot sedang tidak tersedia." }, { status: error.status || 502 });
  }
}

export async function POST(request: NextRequest) {
  let user: any;
  try { user = await userOrThrow(); }
  catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status || 401 });
  }
  return NextResponse.json({
    ok: false,
    error: "Generate video PosBot telah dinonaktifkan dari KAZAMA. Gunakan Nexa Omni Flash 1.2.",
  }, { status: 410 });
}
