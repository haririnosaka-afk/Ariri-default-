"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Model = { model_key: string; name: string; price: number; customer_tokens: number; customer_price_idr: number; status?: string; description?: string; category?: string; [key: string]: any };
type Upload = { kind: "image" | "video" | "audio"; file: File };

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || "Permintaan gagal.");
  return data;
}
const idr = (value: number) => "Rp" + Number(value || 0).toLocaleString("id-ID");

export default function PosBotStudio() {
  const [models, setModels] = useState<Model[]>([]);
  const [selected, setSelected] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState("");
  const [ratio, setRatio] = useState("9:16");
  const [lyrics, setLyrics] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [voice, setVoice] = useState("id-ID-Standard-A");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const model = useMemo(() => models.find((item) => item.model_key === selected) || null, [models, selected]);
  const maxImages = useMemo(() => {
    const explicit = Number(model?.max_images || model?.max_reference_images || model?.reference_image_limit || 0);
    if (explicit > 0) return Math.min(16, explicit);
    const key = model?.model_key || "";
    if (key.includes("gpt_image_25")) return 16;
    if (key.includes("seedream_5_pro")) return 10;
    if (key === "s2_seedance_25_30s" || key === "seedance_20_15s") return 2;
    if (key === "seedance_20_mini") return 1;
    if (key === "seedance_20_mini_r2v" || key === "seedance_25_30s_strict") return 6;
    if (key.includes("seedance") || key.includes("wan3") || key.includes("wan_30_r2v")) return 9;
    if (key.includes("flux_2")) return 6;
    return 4;
  }, [model]);
  const imageCount = uploads.filter((item) => item.kind === "image").length;
  const tokenCost = Number(model?.customer_tokens || 0);

  async function load() {
    setRefreshing(true);
    try {
      const [catalog, wallet] = await Promise.all([
        request("/api/posbot?resource=models"),
        request("/api/posbot?resource=balance").catch(() => null),
      ]);
      const items: Model[] = catalog.models || [];
      setModels(items);
      setSelected((current) => items.some((item) => item.model_key === current) ? current : items[0]?.model_key || "");
      if (wallet?.balance !== undefined && wallet?.balance !== null) setBalance(Number(wallet.balance));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat katalog PosBot.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!job?.job_id || ["completed", "done", "success", "failed", "error", "cancelled", "canceled"].includes(String(job.status).toLowerCase())) return;
    const timer = setInterval(async () => {
      try {
        const status = await request("/api/posbot?resource=status&id=" + encodeURIComponent(job.job_id));
        setJob((current: any) => ({ ...current, ...status }));
        if (["completed", "done", "success"].includes(String(status.status).toLowerCase())) {
          setNotice("Generate PosBot selesai. Hasil video/file sudah tersedia.");
          const wallet = await request("/api/posbot?resource=balance").catch(() => null);
          if (wallet?.balance !== undefined) setBalance(Number(wallet.balance));
        }
        if (["failed", "error", "cancelled", "canceled"].includes(String(status.status).toLowerCase())) {
          setError(status.error || "Generate gagal. Token KAZAMA akan dikembalikan jika provider mengonfirmasi kegagalan.");
          const wallet = await request("/api/posbot?resource=balance").catch(() => null);
          if (wallet?.balance !== undefined) setBalance(Number(wallet.balance));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Status job belum dapat diperbarui.");
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [job?.job_id, job?.status]);

  function addFiles(kind: Upload["kind"], files: FileList | null) {
    if (!files) return;
    const added = Array.from(files).map((file) => ({ kind, file }));
    if (kind === "image" && imageCount + added.length > maxImages) { setError("Model ini maksimal " + maxImages + " foto referensi."); return; }
    if (kind !== "image" && added.some((item) => item.file.size > 50 * 1024 * 1024)) { setError("Ukuran video/audio maksimal 50 MB per file."); return; }
    setUploads((current) => [...current.filter((item) => item.kind !== kind || kind === "image"), ...added]);
  }
  async function generate() {
    if (!model) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) throw new Error("Konfigurasi Supabase publik belum lengkap di Vercel.");
      const supabase = createClient(supabaseUrl, supabaseKey);
      const files = await Promise.all(uploads.map(async (item) => {
        const signed = await request("/api/posbot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource: "sign-upload", kind: item.kind, name: item.file.name }) });
        const uploaded = await supabase.storage.from("posbot-inputs").uploadToSignedUrl(signed.path, signed.token, item.file, { contentType: item.file.type || "application/octet-stream" });
        if (uploaded.error) throw new Error("Upload " + item.file.name + " gagal: " + uploaded.error.message);
        const completed = await request("/api/posbot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource: "complete-upload", path: signed.path }) });
        return { kind: item.kind, url: completed.url };
      }));
      const result = await request("/api/posbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "generate", model: model.model_key, prompt, files,
          aspect_ratio: ratio, negative_prompt: negative,
          lyrics, instrumental, voice,
        }),
      });
      setJob({ job_id: result.job_id, status: result.status || "queued", model: result.model || model.name, model_key: selected, customer_tokens: result.customer_tokens, result_url: null });
      setNotice("Permintaan diterima PosBot. Status akan diperbarui otomatis.");
      setUploads([]);
      const wallet = await request("/api/posbot?resource=balance").catch(() => null);
      if (wallet?.balance !== undefined) setBalance(Number(wallet.balance));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate PosBot gagal.");
    } finally {
      setBusy(false);
    }
  }

  const mediaRules = String(model?.description || model?.input_schema?.description || "");
  const status = String(job?.status || "").toLowerCase();
  const running = !!job && !["completed", "done", "success", "failed", "error", "cancelled", "canceled"].includes(status);
  const resultUrl = String(job?.result_url || "");
  const resultKey = String(job?.model_key || selected).toLowerCase();
  const resultKind = /\\.(mp3|wav|m4a|ogg)(?:\\?|$)/i.test(resultUrl) || /music|suno|lyria|mureka|sonauto|acestep|tts|voice|lipsync/.test(resultKey) ? "audio" : /\\.(png|jpe?g|webp|gif)(?:\\?|$)/i.test(resultUrl) || /gpt_image|nano_banana|seedream|flux|krea|face_swap|upscale_4k/.test(resultKey) ? "image" : "video";

  return <main style={{ minHeight: "100vh", background: "#090b12", color: "#f5f6fa", padding: "28px 16px 60px", fontFamily: "Inter,system-ui,sans-serif" }}>
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      <a href="/" style={{ color: "#aeb8d0", textDecoration: "none", fontSize: 13 }}>← Kembali ke KAZAMA Studio</a>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", margin: "22px 0" }}>
        <div><div style={{ color: "#9aa7c2", letterSpacing: 2, fontSize: 11 }}>PROVIDER KEDUA · TERPISAH DARI NEXABOT</div><h1 style={{ margin: "8px 0", fontSize: 34 }}>PosBot <span style={{ color: "#9b8cff" }}>Studio</span></h1><p style={{ margin: 0, color: "#aeb8d0" }}>Katalog PosBot live. Semua model Omni Flash dari PosBot otomatis dikecualikan.</p></div>
        <div style={{ background: "#151a28", border: "1px solid #2b3449", borderRadius: 14, padding: "12px 16px", minWidth: 170 }}><small style={{ color: "#9aa7c2" }}>SALDO PROVIDER POSBOT</small><div style={{ fontSize: 22, fontWeight: 700, marginTop: 5 }}>{balance === null ? "—" : idr(balance)}</div><button onClick={load} disabled={refreshing} style={{ marginTop: 8, background: "transparent", border: 0, color: "#b7aaff", padding: 0, cursor: "pointer" }}>{refreshing ? "Memuat..." : "Refresh katalog & saldo"}</button></div>
      </header>

      {error && <div style={{ padding: 13, marginBottom: 14, borderRadius: 10, background: "#3a1d27", color: "#ffd5dc" }}>{error}</div>}
      {notice && <div style={{ padding: 13, marginBottom: 14, borderRadius: 10, background: "#173528", color: "#c6ffdf" }}>{notice}</div>}
      <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(260px,1fr)", gap: 16 }}>
        <div style={{ background: "#121725", border: "1px solid #293249", borderRadius: 16, padding: 20 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Buat generasi PosBot</h2>
          <label style={labelStyle}>PILIH MODEL</label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} style={fieldStyle} disabled={loading || !models.length}>
            {models.map((item) => <option key={item.model_key} value={item.model_key}>{item.name} · {idr(item.customer_price_idr)}</option>)}
          </select>
          {loading && <p style={muted}>Memuat katalog PosBot...</p>}
          {!loading && !models.length && <p style={muted}>Katalog belum tersedia. Periksa POSBOT_API_KEY di Vercel dan saldo akun provider.</p>}
          {model && <div style={{ background: "#0c111d", borderRadius: 12, padding: 13, margin: "12px 0 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><b>{model.name}</b><b style={{ color: "#c7baff" }}>{tokenCost} token · {idr(model.customer_price_idr)}</b></div>
            <p style={{ ...muted, marginBottom: 6 }}>Biaya provider: {idr(model.price)} · Tarif KAZAMA dibulatkan ke token penuh (Rp2.000/token).</p>
            {mediaRules && <p style={{ ...muted, margin: 0 }}>{mediaRules}</p>}
          </div>}
          <label style={labelStyle}>PROMPT</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} placeholder="Tulis instruksi generasi..." style={{ ...fieldStyle, resize: "vertical" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <div><label style={labelStyle}>ASPECT RATIO</label><select value={ratio} onChange={(e) => setRatio(e.target.value)} style={fieldStyle}>{["9:16","16:9","1:1","3:4","4:3","2:3","3:2","21:9"].map(x => <option key={x}>{x}</option>)}</select></div>
            <div><label style={labelStyle}>STATUS KATALOG</label><div style={{ ...fieldStyle, color: "#aeb8d0" }}>Tarif & status model diperbarui live dari PosBot.</div></div>
          </div>
          <label style={{ ...labelStyle, marginTop: 14 }}>FOTO REFERENSI (MAKS. {maxImages})</label>
          <input type="file" accept="image/*" multiple onChange={(e) => addFiles("image", e.target.files)} style={fieldStyle} />
          <div style={muted}>{imageCount} foto dipilih. File akan diunggah privat melalui backend KAZAMA ke storage publik khusus URL input PosBot.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <div><label style={labelStyle}>VIDEO ACUAN (OPSIONAL)</label><input type="file" accept="video/mp4,video/webm" onChange={(e) => addFiles("video", e.target.files)} style={fieldStyle}/></div>
            <div><label style={labelStyle}>AUDIO ACUAN (OPSIONAL)</label><input type="file" accept="audio/mpeg,audio/wav,audio/*" onChange={(e) => addFiles("audio", e.target.files)} style={fieldStyle}/></div>
          </div>
          <label style={{ ...labelStyle, marginTop: 14 }}>NEGATIVE PROMPT (OPSIONAL)</label>
          <textarea value={negative} onChange={(e) => setNegative(e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} placeholder="Elemen yang ingin dihindari..."/>
          <label style={{ ...labelStyle, marginTop: 14 }}>LIRIK (KHUSUS MODEL MUSIK)</label>
          <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} placeholder="Opsional: lirik lagu..."/>
          <label style={{ display: "flex", alignItems: "center", gap: 9, color: "#cbd3e5", fontSize: 13, margin: "12px 0" }}><input type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)}/> Musik instrumental saja</label>
          <label style={labelStyle}>VOICE TTS (KHUSUS GOOGLE TTS)</label>
          <input value={voice} onChange={(e) => setVoice(e.target.value)} style={fieldStyle}/>
          {uploads.length > 0 && <div style={{ marginTop: 12 }}>{uploads.map((item, index) => <div key={item.file.name + index} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: 7, color: "#cbd3e5", fontSize: 12 }}><span>{item.kind.toUpperCase()} · {item.file.name}</span><button onClick={() => setUploads((current) => current.filter((_, i) => i !== index))} style={removeStyle}>Hapus</button></div>)}</div>}
          <button disabled={busy || !model || !prompt.trim() && !String(model.model_key).includes("lipsync")} onClick={generate} style={{ ...primaryStyle, opacity: busy || !model ? .55 : 1 }}>{busy ? "Mengirim ke PosBot..." : "Generate dengan PosBot · " + tokenCost + " token"}</button>
          <p style={{ ...muted, marginBottom: 0 }}>Admin KAZAMA tidak dipotong token pelanggan, tetapi saldo provider PosBot tetap terpakai. Pelanggan dikenakan token sesuai harga model di atas.</p>
        </div>

        <aside style={{ background: "#121725", border: "1px solid #293249", borderRadius: 16, padding: 20, alignSelf: "start" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Status & hasil</h2>
          {!job ? <p style={muted}>Hasil generate PosBot akan muncul di sini.</p> : <>
            <div style={{ color: "#bdb0ff", fontWeight: 700 }}>{job.model || model?.name}</div>
            <p style={muted}>ID: {job.job_id}</p>
            <div style={{ padding: 10, borderRadius: 9, background: "#0c111d", margin: "12px 0" }}>Status: <b>{job.status}</b>{job.progress !== null && job.progress !== undefined ? " · " + job.progress + "%" : ""}</div>
            {running && <p style={muted}>Sedang diproses. Status dicek otomatis setiap 6 detik.</p>}
            {job.result_url && <>{resultKind === "image" ? <img src={job.result_url} alt="Hasil PosBot" style={{ width: "100%", borderRadius: 10, objectFit: "contain" }}/> : resultKind === "audio" ? <audio src={job.result_url} controls style={{ width: "100%" }}/> : <video src={job.result_url} controls playsInline style={{ width: "100%", borderRadius: 10, background: "#000" }}/>}<a href={job.result_url} target="_blank" rel="noreferrer" style={{ ...primaryStyle, display: "block", textAlign: "center", textDecoration: "none" }}>Buka / Download hasil</a></>}
          </>}
          <div style={{ borderTop: "1px solid #293249", marginTop: 18, paddingTop: 14 }}>
            <b style={{ fontSize: 13 }}>Provider terpisah</b>
            <p style={muted}>PosBot memakai POSBOT_API_KEY dan saldo PosBot sendiri. NexaBot tetap menggunakan katalog, API key, saldo, dan alur generate yang sudah ada.</p>
            <b style={{ fontSize: 13 }}>Filter model</b>
            <p style={muted}>Semua model Omni Flash dari PosBot otomatis tidak ditampilkan dan tidak dapat dipanggil melalui route ini. Model lain tetap mengikuti katalog PosBot.</p>
          </div>
        </aside>
      </section>
      <div style={{ marginTop: 20, color: "#7e8aa4", fontSize: 11, textAlign: "center" }}>KAZAMA AI · POSBOT PROVIDER CONNECTOR</div>
    </div>
  </main>;
}
const labelStyle: React.CSSProperties = { display: "block", color: "#aeb8d0", fontSize: 10, letterSpacing: 1.1, fontWeight: 700, marginBottom: 7 };
const muted: React.CSSProperties = { color: "#8f9bb5", fontSize: 12, lineHeight: 1.55 };
const fieldStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "11px 12px", color: "#f5f6fa", background: "#0c111d", border: "1px solid #303a50", borderRadius: 9, marginBottom: 10, outline: "none" };
const primaryStyle: React.CSSProperties = { width: "100%", padding: "13px 15px", marginTop: 16, border: 0, borderRadius: 10, background: "linear-gradient(90deg,#7564e8,#9c72ef)", color: "white", fontWeight: 700, cursor: "pointer" };
const removeStyle: React.CSSProperties = { border: 0, background: "transparent", color: "#f3a0ad", cursor: "pointer" };
