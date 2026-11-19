export type DoubaoSlot = { label: string; apiKey: string; baseUrl: string };
export function getDoubaoSlots(): DoubaoSlot[] {
  const raw = process.env.DOUBAO_ARK_API_KEYS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: any, index: number) => {
      if (typeof item === "string") return { label: "Doubao account " + (index + 1), apiKey: item.trim(), baseUrl: "https://ark.cn-beijing.volces.com/api/v3" };
      const baseUrl = String(item?.baseUrl || item?.base_url || "https://ark.cn-beijing.volces.com/api/v3");
      return { label: String(item?.label || ("Doubao account " + (index + 1))), apiKey: String(item?.apiKey || item?.api_key || "").trim(), baseUrl: baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl };
    }).filter((slot: DoubaoSlot) => slot.apiKey && slot.baseUrl.startsWith("https://"));
  } catch { return []; }
}
let cursor = 0;
export function nextDoubaoSlot(): number {
  const slots = getDoubaoSlots();
  if (!slots.length) return -1;
  const selected = cursor % slots.length;
  cursor = (cursor + 1) % slots.length;
  return selected;
}
export function safeDoubaoPoolStatus() {
  const slots = getDoubaoSlots();
  return { configured: slots.length > 0, provider: "Volcengine Ark / Doubao Seedance", accountCount: slots.length,
    accounts: slots.map((slot, index) => ({ slot: index, label: slot.label, connected: true })),
    models: [
      { id: "doubao-seedance-2-5-260628", name: "Seedance 2.5", maxDuration: 30, maxImages: 30, resolutions: ["480p","720p","1080p","4k"] },
      { id: "doubao-seedance-2-5-flash-261115", name: "Seedance 2.5 Flash", maxDuration: 30, maxImages: 10, resolutions: ["480p","720p"] }
    ] };
}
