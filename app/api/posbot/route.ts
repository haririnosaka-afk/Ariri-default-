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
  seedance_2_15s: 4000,
  seedance_20_15s: 4000,
  seedance_20_mini: 4000,
  seedance_2_mini_omni_15s: 4000,
  kling_4_15s: 7000,
  wan3_720p_30s: 8000,
  wan3_480p_30s: 6000,
  kling4_720p_20s: 6500,
  kling_4_20s: 6500,
  wan3_ref_720p_30s: 8000,
  kling4_ref_720p_15s: 8000,
  motion_control_std: 4000,
  kling_30_pro: 5000,
  kling_30_turbo: 4000,
  minimax_music3: 1000,
};
function fixedCustomerPrice(model: any): number | null {
  const key = modelKey(model).toLowerCase();
  if (FIXED_CUSTOMER_PRICES_IDR[key] !== undefined) return FIXED_CUSTOMER_PRICES_IDR[key];
  const name = String(model?.name || model?.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/minimax.*h3.*1080p.*15s|h3.*1080p.*15s/.test(name)) return 5000;
  if (/minimax.*h3.*720p.*30s|h3.*720p.*30s/.test(name)) return 6000;
  if (/minimax.*lipsync.*pro.*30s|lipsync.*pro.*30s/.test(name)) return 5000;
  if (/seedance.*2.*mini.*omni.*15s/.test(name)) return 4000;
  if (/seedance.*2(?:[ _.-]?0)?.*15s/.test(name) && !/2[ _.-]?5|25|2\.5/.test(name)) return 4000;
  if (/kling.*3(?:\.0)?.*10s/.test(name)) return 4000;
  if (/kling.*4.*20s/.test(name)) return 6500;
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
  // Seedance 2 Mini Omni memakai harga jual tetap KAZAMA; beberapa katalog provider
  // tidak mengirim field harga untuk model ini, jadi jangan sembunyikan model tersebut.
  if (["seedance_20_mini", "kling_30_turbo", "kling4_720p_20s", "kling_4_20s"].includes(key.toLowerCase()) || /kling.*4.*20s/i.test(String(model?.name||model?.title||""))) return true;
  const price = providerCost(model);
  // Model lain hanya tampil jika provider mengirim tarif valid.
  return Number.isFinite(price) && price > 0;
}
const POSBOT_VIDEO_KEYS = new Set([
  "grok_imagine_2_15s","grok_imagine_2_30s","grok_imagine_15_video_720p","betagrok_15s",
  "s2_seedance_25_30s","seedance_25_30s","seedance_30s","s2_25_30s",
  "seedance_25_30s_strict","seedance_lite_30s","seedance_25_lite","seedance_20_15s","seedance_20_15s_legacy","seedance_20_mini",
  "wan_30_hd","wan_30_720p","wan_remix_720p","wan3_hd_15s","wan3_hd_30s","wan3_hd","wan_3_hd_15s","wan_3_hd_30s",
  "minimax_h3","minimax_h3_720p","kling_25_turbo","kling_26_pro_1080p","kling_26_i2v","kling_30_turbo","kling4_720p_20s","kling_4_20s",
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
    // Full live PosBot video catalog; the frontend separates Video Gen and Motion Control.
    .filter((model: any) => isVideoModel(model) || String(modelKey(model)).toLowerCase() === "watermark_remover");
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
      const models = await getCatalog();
      return NextResponse.json({ ok: true, provider: "PosBot", models });
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
  catch (error: any) { return NextResponse.json({ ok: false, error: error.message }, { status: error.status || 401 }); }
  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "Body JSON tidak valid." }, { status: 400 }); }
  if (body.resource === "sign-upload") {
    try {
      const db = dbAdmin();
      await ensureBucket(db);
      const kind = ["image", "video", "audio"].includes(String(body.kind)) ? String(body.kind) : "image";
      const name = String(body.name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
      const path = user.id + "/" + crypto.randomUUID() + "-" + name;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) throw error || new Error("Gagal membuat tautan upload.");
      return NextResponse.json({ ok: true, bucket: BUCKET, path, token: data.token, kind });
    } catch (error: any) {
      return NextResponse.json({ ok: false, error: error.message || "Gagal menyiapkan upload." }, { status: 500 });
    }
  }
  if (body.resource === "complete-upload") {
    try {
      const path = String(body.path || "");
      if (!path.startsWith(user.id + "/")) return NextResponse.json({ ok: false, error: "Akses file ditolak." }, { status: 403 });
      const { data, error } = await dbAdmin().storage.from(BUCKET).createSignedUrl(path, 86400);
      if (error || !data?.signedUrl) throw error || new Error("Gagal membuat URL media sementara.");
      return NextResponse.json({ ok: true, url: data.signedUrl });
    } catch (error: any) {
      return NextResponse.json({ ok: false, error: error.message || "Gagal menyiapkan URL media." }, { status: 500 });
    }
  }
  if (body.resource !== "generate") return NextResponse.json({ ok: false, error: "Aksi PosBot tidak dikenal." }, { status: 400 });
  const modelId = String(body.model || "");
  const prompt = String(body.prompt || "");
  if (!modelId) return NextResponse.json({ ok: false, error: "Pilih model PosBot." }, { status: 400 });
  try {
    const models = await getCatalog();
    const model = models.find((item: any) => item.model_key === modelId);
    if (!model) return NextResponse.json({ ok: false, error: "Model tidak aktif atau tidak tersedia di katalog PosBot KAZAMA." }, { status: 400 });
    const maxPrompt = Number(model.max_prompt_length || model.max_prompt || (
      /^(wan_30_hd|wan_30_r2v)$/.test(modelId) ? 10000 :
      /^kling_30_turbo$/.test(modelId) ? 2500 :
      /seedance/.test(modelId) ? 8000 :
      /^(grok_imagine_2|minimax_h3)/.test(modelId) ? 5000 :
      2500
    ));
    if (prompt.length > maxPrompt) return NextResponse.json({ ok: false, error: "Prompt model ini maksimal " + maxPrompt.toLocaleString("id-ID") + " karakter." }, { status: 400 });
    const db = dbAdmin();
    const tokenCost = Number(model.customer_tokens);
    const chargeRef = crypto.randomUUID();
    const admin = isAdmin(user.email);
    let charged = false;
    if (!admin) {
      const { error } = await db.rpc("spend_token_amount", { p_user_id: user.id, p_reference_id: chargeRef, p_cost_units: tokenCost * 2 });
      if (error) {
        const insufficient = /insufficient_tokens/i.test(error.message);
        throw Object.assign(new Error(insufficient ? "Token KAZAMA tidak cukup untuk model ini." : error.message), { status: insufficient ? 402 : 500 });
      }
      charged = true;
    }
    let providerAccepted = false;
    try {
      const files = Array.isArray(body.files) ? body.files : [];
      const urls: Record<string, string[]> = { image: [], video: [], audio: [] };
      if (files.length) {
        await ensureBucket(db);
        for (let i = 0; i < files.length; i++) {
          const item = files[i];
          const kind = ["image", "video", "audio"].includes(item.kind) ? item.kind : "image";
          urls[kind].push(await uploadDataUrl(db, user.id, item, i));
        }
      }
      const payload: any = { model: modelId, notify_telegram: false };
      if (prompt) payload.prompt = prompt;
      if (urls.image.length) {
        payload.image_url = urls.image[0];
        payload.image_urls = urls.image;
        payload.reference_image_urls = urls.image;
      }
      if (urls.video.length) payload.video_url = urls.video[0];
      if (urls.audio.length) payload.audio_url = urls.audio[0];
      if (body.aspect_ratio) payload.aspect_ratio = body.aspect_ratio;
      if (body.negative_prompt) payload.negative_prompt = String(body.negative_prompt);
      if (body.lyrics) payload.lyrics = String(body.lyrics);
      if (typeof body.instrumental === "boolean") payload.instrumental = body.instrumental;
      if (body.voice) payload.voice = String(body.voice);
      if (body.duration) payload.duration = Number(body.duration);
      if (body.fps) payload.fps = Number(body.fps);
      if (body.extra && typeof body.extra === "object" && !Array.isArray(body.extra)) {
        for (const [key, value] of Object.entries(body.extra)) {
          if (!["model", "api_key", "authorization", "token", "resource"].includes(key.toLowerCase())) payload[key] = value;
        }
      }
      const response = await fetch(POSBOT_BASE + "/generate", {
        method: "POST",
        headers: posbotHeaders(),
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(60000),
      });
      const raw = await response.text();
      let result: any;
      try { result = raw ? JSON.parse(raw) : {}; }
      catch { throw new Error("Respons generate PosBot tidak valid."); }
      if (!response.ok || result?.success === false || result?.ok === false) {
        throw Object.assign(new Error(String(result?.error || result?.message || "PosBot menolak generate (" + response.status + ").")), { status: response.status || 502 });
      }
      providerAccepted = true;
      const jobId = String(result.job_code || result.job_id || result.id || result.data?.job_code || result.data?.job_id || "");
      if (!jobId) throw new Error("PosBot menerima request tetapi tidak mengembalikan job_code.");
      const row = {
        user_id: user.id,
        token_reference: chargeRef,
        provider_job_id: jobId,
        provider_task_id: jobId,
        provider: "posbot",
        status: dbJobStatus(result.status),
        model: modelId,
        resolution: String(body.resolution || "auto"),
        duration_seconds: Number(body.duration || body.extra?.duration || 0),
        aspect_ratio: String(body.aspect_ratio || "auto"),
        prompt,
        customer_price_idr: Number(model.customer_price_idr),
        reference_files: urls,
        updated_at: new Date().toISOString(),
      };
      const { error: insertError } = await db.from("generation_jobs").insert(row);
      if (insertError) {
        console.error("PosBot job tracking insert failed:", insertError.message);
        return NextResponse.json({ ok: true, job_id: jobId, status: result.status || "queued", model: model.name, customer_tokens: tokenCost, tracking_warning: "Provider menerima tugas, tetapi penyimpanan riwayat gagal. Jangan kirim ulang generate yang sama." });
      }
      return NextResponse.json({ ok: true, job_id: jobId, status: result.status || "queued", model: model.name, provider_cost_idr: model.price, customer_price_idr: model.customer_price_idr, customer_tokens: tokenCost, token_reference: chargeRef });
    } catch (error: any) {
      if (charged && !providerAccepted) {
        try { await db.rpc("refund_token", { p_user_id: user.id, p_reference_id: chargeRef, p_reason: "PosBot request failed before acceptance" }); } catch {}
      }
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Generate PosBot gagal." }, { status: error.status || 502 });
  }
}
