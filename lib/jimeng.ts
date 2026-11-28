// lib/jimeng.ts
// Client Jimeng web (jimeng.jianying.com) untuk Seedance 2.5 / 2.5 Flash.
// FILE BARU, additive saja. Tidak mengubah NexaBot, PosBot, atau model lain di KAZAMA AI.
// Diadaptasi dari MokoKing666/dsh-jimeng v1.1.0 (MIT) dan dari lib/jimeng.js di doubao-pool.
//
// - Sessionid DIBACA DARI ENV Vercel JIMENG_SESSIONIDS (dipisah koma, 1 per akun)
//   atau JIMENG_COOKIE (1 header Cookie lengkap). Jangan pernah paste sessionid
//   di chat atau commit ke GitHub.
// - TIDAK ada silent downgrade durasi: kalau minta 30 detik tapi katalog akun
//   itu tidak mencantumkan 30 detik, resolveVideoModel() throw error.
// - getHistory() = 1x cek status, untuk polling dari route /api/jimeng.
//
// PERINGATAN: ini reverse-engineered, bukan API resmi. Endpoint bisa berubah,
// submit bisa ditolak `shark not pass` / butuh a_bogus dari browser, akun bisa
// kena limit/blokir. Bukti di dsh-jimeng sendiri hanya 1 frame video Seedance 2.5
// 4 detik, BUKAN 30 detik. Jadi 30 detik di sini BELUM terverifikasi sampai ada
// 1x generate live 30 detik yang berhasil dari akun Jimeng sendiri.

import { createHash, randomUUID } from "node:crypto";

export const JIMENG_ORIGIN = "https://jimeng.jianying.com";
const AID = 513695;
const APP_VERSION = "5.8.0";
const PLATFORM_CODE = "7";
const DRAFT_VERSION = "3.3.20";
const WEB_VERSION = "7.5.0";

const STATUS_FAILED = new Set([30, 40]);
const STATUS_DONE = new Set([21, 50]);
export const VIDEO_RATIOS = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];

// Model Jimeng yang jadi target KAZAMA AI (dari katalog live 2026-11-28).
export const JIMENG_FLASH_KEY = "dreamina_seedance_45_flash";
export const JIMENG_PRO_KEY = "dreamina_seedance_45_pro";

const WEB_ID = String(Math.floor(Math.random() * 1e18) + 7e18);

export type JimengAccount = { id: string; provider: "jimeng"; sessionid: string; short: string };

export function getJimengAccounts(): JimengAccount[] {
  const raw = process.env.JIMENG_SESSIONIDS || process.env.JIMENG_COOKIE || "";
  if (!raw.trim()) return [];
  if (raw.includes("sessionid=")) {
    return [{ id: "jimeng-1", provider: "jimeng", sessionid: raw.trim(), short: "cookie-header..." }];
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean).map((sessionid, i) => ({
    id: `jimeng-${i + 1}`,
    provider: "jimeng" as const,
    sessionid,
    short: sessionid.slice(0, 6) + "..." + sessionid.slice(-4),
  }));
}

export function getJimengAccountById(id: string): JimengAccount | null {
  return getJimengAccounts().find((a) => a.id === id) || null;
}

export function buildCookieHeader(sessionid: string): string {
  if (!sessionid || !sessionid.trim()) {
    throw new Error("JIMENG_SESSIONIDS belum diisi. Isi di Vercel Environment Variables, bukan di chat.");
  }
  const s = sessionid.trim();
  if (s.includes("sessionid=")) return s;
  return `sessionid=${s}; sessionid_ss=${s}; sid_tt=${s}; store-region=cn-gd`;
}

function sign(uri: string, deviceTime: number): string {
  return createHash("md5")
    .update(`9e2c|${uri.slice(-7)}|${PLATFORM_CODE}|${APP_VERSION}|${deviceTime}||11ac`)
    .digest("hex");
}

async function send(cookie: string, method: string, uri: string, body: string | undefined, query: string, referer: string, attempt = 0): Promise<string> {
  const deviceTime = Math.floor(Date.now() / 1000);
  try {
    const response = await fetch(`${JIMENG_ORIGIN}${uri}?${query}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        Cookie: cookie,
        "Device-Time": String(deviceTime),
        Sign: sign(uri, deviceTime),
        "Sign-Ver": "1",
        Appid: String(AID),
        Appvr: APP_VERSION,
        Pf: PLATFORM_CODE,
        Origin: JIMENG_ORIGIN,
        Referer: referer,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
      },
      body,
    });
    return await response.text();
  } catch (error: any) {
    if (attempt < 2) {
      await new Promise((done) => setTimeout(done, 800 * (attempt + 1)));
      return send(cookie, method, uri, body, query, referer, attempt + 1);
    }
    const detail = error?.cause?.code ?? error?.cause?.message ?? error?.message ?? String(error);
    throw new Error(`Gagal konek ke Jimeng (${uri}): ${detail}`);
  }
}

async function call(cookie: string, method: string, uri: string, data?: any, extraParams: Record<string, string> = {}, referer = `${JIMENG_ORIGIN}/ai-tool/home`): Promise<any> {
  const query = new URLSearchParams({ aid: String(AID), device_platform: "web", region: "CN", webId: WEB_ID, ...extraParams }).toString();
  const text = await send(cookie, method, uri, data === undefined ? undefined : JSON.stringify(data), query, referer);
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Jimeng mengembalikan non-JSON dari ${uri}: ${text.slice(0, 200)} — kemungkinan butuh signature browser (a_bogus/shark), jalur HTTP murni gagal di akun ini.`);
  }
  if (parsed.ret !== undefined && parsed.ret !== "0") {
    const hint = parsed.ret === "1006" || parsed.ret === "5000" ? " (kredit tidak cukup)" : "";
    throw new Error(`Jimeng error ret=${parsed.ret}${hint}: ${parsed.errmsg ?? "unknown error"}`);
  }
  return parsed.data ?? parsed;
}

export async function readCredit(cookie: string): Promise<{ vip: number; gift: number; purchase: number; total: number }> {
  const data = await call(cookie, "POST", "/commerce/v1/benefits/user_credit", {});
  const credit = data?.credit ?? {};
  const vip = Number(credit.vip_credit ?? 0);
  const gift = Number(credit.gift_credit ?? 0);
  const purchase = Number(credit.purchase_credit ?? 0);
  return { vip, gift, purchase, total: vip + gift + purchase };
}

export type JimengModel = { key: string; kind: string; name: string; tip: string; durations: number[]; ratios: string[]; supportsReference: boolean; benefitType: string | null };

function collectModelNodes(value: any, out: any[] = []): any[] {
  if (value === null || typeof value !== "object") return out;
  if (typeof value.model_req_key === "string") out.push(value);
  for (const child of Object.values(value)) collectModelNodes(child, out);
  return out;
}

function normalizeModel(node: any, kind: string): JimengModel {
  const name = node.model_name ?? node.name ?? node.title ?? "";
  const tip = node.model_tip ?? node.description ?? node.desc ?? "";
  // Durasi: API Jimeng Nov 2026 sudah TIDAK lagi mengirim duration_option.
  // Bentuk baru: options[] -> key frames enum int_value [96,120,...,720] pada fps 24 = 4..30 detik.
  let durations: number[] = Array.isArray(node.duration_option) ? node.duration_option.filter(Number.isInteger) : [];
  let ratios: string[] = Array.isArray(node.video_aspect_ratio_option) && node.video_aspect_ratio_option.length > 0 ? node.video_aspect_ratio_option : VIDEO_RATIOS;
  if (Array.isArray(node.options)) {
    const fpsOpt = node.options.find((o: any) => o.key === "fps");
    const fps = fpsOpt?.enum_val?.int_value?.[0] ?? 24;
    const framesOpt = node.options.find((o: any) => o.key === "frames");
    const frames = framesOpt?.enum_val?.int_value;
    if (durations.length === 0 && Array.isArray(frames) && frames.length > 0) {
      durations = frames.map((f: number) => f / fps).filter((d: number) => Number.isInteger(d));
    }
    const ratioOpt = node.options.find((o: any) => o.key === "video_aspect_ratio");
    if (Array.isArray(ratioOpt?.enum_val?.string_value) && ratioOpt.enum_val.string_value.length > 0) {
      ratios = ratioOpt.enum_val.string_value;
    }
    if (durations.length === 0) {
      const editOpt = node.options.find((o: any) => o.key === "edit_config");
      const min = editOpt?.edit_config_val?.edit_min_video_duration;
      const max = editOpt?.edit_config_val?.edit_max_video_duration;
      if (Number.isInteger(min) && Number.isInteger(max) && max >= min) {
        durations = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      }
    }
  }
  return {
    key: node.model_req_key,
    kind,
    name: typeof name === "string" ? name.trim() : "",
    tip: typeof tip === "string" ? tip.trim() : "",
    durations,
    ratios,
    supportsReference: Array.isArray(node.feats)
      ? node.feats.includes("support_first_image") || node.feats.includes("support_end_image")
      : Array.isArray(node.options) && node.options.some((o: any) => o.key === "first_frame_config"),
    benefitType: node.commercial_config?.default?.benefit_type ?? null,
  };
}

export async function fetchCatalog(cookie: string): Promise<{ images: JimengModel[]; videos: JimengModel[] }> {
  const commonParams = { web_version: WEB_VERSION, da_version: DRAFT_VERSION, aigc_features: "app_lip_sync" };
  const [imageResult, videoResult] = await Promise.allSettled([
    call(cookie, "POST", "/mweb/v1/get_common_config", { is_client_filter: false, need_beta_model: true }, { ...commonParams, needCache: "true", needRefresh: "false" }, `${JIMENG_ORIGIN}/ai-tool/image/generate`),
    call(cookie, "POST", "/mweb/v1/video_generate/get_common_config", { scene: "generate_video", params: { needCache: true, needRefresh: false } }, commonParams, `${JIMENG_ORIGIN}/ai-tool/video/generate`),
  ]);
  const unique = (nodes: any[], kind: string): JimengModel[] => {
    const byKey = new Map<string, JimengModel>();
    for (const node of nodes) {
      if (typeof node.model_req_key !== "string" || node.model_req_key === "") continue;
      if (!byKey.has(node.model_req_key)) byKey.set(node.model_req_key, normalizeModel(node, kind));
    }
    const values: JimengModel[] = [];
    byKey.forEach((value) => values.push(value));
    return values;
  };
  const images = imageResult.status === "fulfilled" ? unique(Array.isArray((imageResult.value as any)?.model_list) ? (imageResult.value as any).model_list : collectModelNodes(imageResult.value), "image") : [];
  const videos = videoResult.status === "fulfilled" ? unique(Array.isArray((videoResult.value as any)?.model_list) ? (videoResult.value as any).model_list : collectModelNodes(videoResult.value), "video") : [];
  if (images.length === 0 && videos.length === 0) {
    const reason = [imageResult, videoResult].filter((r) => r.status === "rejected").map((r: any) => r.reason?.message ?? String(r.reason)).join(" / ");
    throw new Error(`Tidak dapat katalog model dari Jimeng${reason ? `: ${reason}` : ""}`);
  }
  return { images, videos };
}

export function pickModel(models: JimengModel[], { key, prefer }: { key?: string; prefer?: string } = {}): JimengModel | undefined {
  if (!models || models.length === 0) return undefined;
  if (typeof key === "string" && key.trim() !== "") {
    const exact = models.find((m) => m.key === key.trim()) ?? models.find((m) => m.key.toLowerCase() === key.trim().toLowerCase());
    if (!exact) throw new Error(`Model ${key} tidak ada di akun ini. Yang tersedia: ${models.map((m) => m.key).join(", ")}`);
    return exact;
  }
  if (typeof prefer === "string" && prefer.trim() !== "") {
    const wanted = prefer.trim().toLowerCase();
    const byName = models.find((m) => m.name.toLowerCase().includes(wanted)) ?? models.find((m) => m.key.toLowerCase().includes(wanted));
    if (byName) return byName;
  }
  return models[0];
}

export async function resolveVideoModel(cookie: string, { key, prefer, duration, ratio }: { key?: string; prefer?: string; duration?: number; ratio?: string } = {}): Promise<{ model: JimengModel; duration: number; ratio: string; allowedDurations: number[] }> {
  const catalog = await fetchCatalog(cookie);
  const model = pickModel(catalog.videos, { key, prefer });
  if (!model) throw new Error("Akun ini tidak mengembalikan model video apa pun.");
  const allowed = model.durations.length > 0 ? model.durations : [5];
  if (duration !== undefined && !allowed.includes(duration)) {
    throw new Error(`Model ${model.key} (${model.name || ""}) di akun ini hanya mengizinkan durasi ${allowed.join(", ")} detik, bukan ${duration} detik.`);
  }
  const chosenDuration = duration ?? allowed[0];
  const chosenRatio = ratio && model.ratios.includes(ratio) ? ratio : (model.ratios[0] ?? "16:9");
  return { model, duration: chosenDuration, ratio: chosenRatio, allowedDurations: allowed };
}

export function buildVideoDraft({ prompt, model, ratio, duration, resolution = "720p" }: { prompt: string; model: string; ratio: string; duration: number; resolution?: string }): any {
  const componentId = randomUUID().toUpperCase();
  const metrics = JSON.stringify({ enterFrom: "click", isDefaultSeed: 1, promptSource: "custom", isRegenerate: false, originSubmitId: randomUUID().toUpperCase() });
  const commerce = { benefit_type: "", resource_id: "generate_video", resource_id_type: "str", resource_sub_type: "aigc" };
  const draft = {
    type: "draft", id: randomUUID().toUpperCase(), min_version: "3.0.5", is_from_tsn: true, version: DRAFT_VERSION, main_component_id: componentId,
    component_list: [{ type: "video_base_component", id: componentId, min_version: "1.0.0", metadata: { type: "", id: randomUUID().toUpperCase(), created_platform: 3, created_platform_version: "", created_time_in_ms: Date.now(), created_did: "" }, generate_type: "gen_video", aigc_mode: "workbench", abilities: { type: "", id: randomUUID().toUpperCase(), gen_video: { id: randomUUID().toUpperCase(), type: "", text_to_video_params: { type: "", id: randomUUID().toUpperCase(), model_req_key: model, priority: 0, seed: Math.floor(Math.random() * 100000000) + 2500000000, video_aspect_ratio: ratio, video_gen_inputs: [{ duration_ms: duration * 1000, first_frame_image: null, end_frame_image: null, fps: 24, id: randomUUID().toUpperCase(), min_version: "3.0.5", prompt, resolution, type: "", video_mode: 2 }] }, video_task_extra: metrics } } }],
  };
  return { extend: { root_model: model, m_video_commerce_info: commerce, m_video_commerce_info_list: [commerce] }, submit_id: randomUUID().toUpperCase(), metrics_extra: metrics, draft_content: JSON.stringify(draft), http_common_info: { aid: AID } };
}

export async function submitVideo(cookie: string, { prompt, model, ratio, duration, resolution = "720p" }: { prompt: string; model: string; ratio: string; duration: number; resolution?: string }): Promise<string> {
  const data = await call(cookie, "POST", "/mweb/v1/aigc_draft/generate", buildVideoDraft({ prompt, model, ratio, duration, resolution }), { aigc_features: "app_lip_sync", web_version: WEB_VERSION, da_version: DRAFT_VERSION, web_component_open_flag: "1" }, `${JIMENG_ORIGIN}/ai-tool/video/generate`);
  const historyId = data?.aigc_data?.history_record_id;
  if (historyId === undefined || historyId === null) throw new Error("Jimeng tidak mengembalikan history_record_id, submit tidak jalan.");
  return String(historyId);
}

function videoUrlOf(record: any): string | undefined {
  for (const item of record?.item_list ?? []) {
    const video = item?.video ?? {};
    const url = video?.transcoded_video?.origin?.video_url ?? video?.play_url ?? video?.download_url ?? video?.url;
    if (typeof url === "string" && url.length > 0) return url;
  }
  return undefined;
}

export async function getHistory(cookie: string, historyId: string): Promise<{ historyId: string; status: number | null; url?: string; done: boolean; failCode?: any }> {
  const data = await call(cookie, "POST", "/mweb/v1/get_history_by_ids", { history_ids: [historyId] });
  const record = data?.[historyId] ?? data?.history_list?.[0] ?? null;
  if (!record) return { historyId, status: null, url: undefined, done: false };
  const status = record?.task?.status ?? record?.status ?? null;
  const url = videoUrlOf(record);
  if (url) return { historyId, status, url, done: true, failCode: record?.fail_code };
  if (STATUS_FAILED.has(status)) throw new Error(`Jimeng generate gagal status=${status} fail_code=${record?.fail_code ?? "-"}`);
  if (STATUS_DONE.has(status)) throw new Error(`Task selesai tapi tidak ada URL video (status=${status})`);
  return { historyId, status, url: undefined, done: false, failCode: record?.fail_code };
}
