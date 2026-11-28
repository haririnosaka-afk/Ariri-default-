"use client";
// app/jimeng/page.tsx
// FILE BARU, additive saja. Halaman generate Seedance 2.5 Flash (Jimeng) 30 detik
// untuk KAZAMA AI, terpisah dari halaman Studio / NexaBot.
// Halaman ini TIDAK memotong Credit KAZAMA — Jimeng memakai kredit gratis
// akun Jimeng sendiri (pool JIMENG_SESSIONIDS di Vercel).
// Harus login dulu (middleware KAZAMA akan mengarahkan ke /login kalau belum).
// Live 30 detik BELUM terverifikasi: kalau submit ditolak "shark not pass",
// berarti jalur HTTP murni gagal di akun itu, dan halaman ini akan menampilkan
// errornya apa adanya, bukan pura-pura berhasil.

import { useState } from "react";

const MODELS = [
  { key: "dreamina_seedance_45_flash", label: "Seedance 2.5 Flash (Jimeng) — 30 detik" },
  { key: "dreamina_seedance_45_pro", label: "Seedance 2.5 (Jimeng) — 30 detik" },
];

export default function JimengPage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(MODELS[0].key);
  const [duration, setDuration] = useState("30");
  const [ratio, setRatio] = useState("16:9");
  const [resolution, setResolution] = useState("720p");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [historyId, setHistoryId] = useState("");
  const [account, setAccount] = useState("");

  async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function generate() {
    setBusy(true);
    setError("");
    setStatus("");
    setVideoUrl("");
    setHistoryId("");
    try {
      if (!prompt.trim()) throw new Error("Prompt wajib diisi.");
      setStatus("Mengirim ke Jimeng...");
      const r = await fetch("/api/jimeng", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model, duration: Number(duration), ratio, resolution }),
      });
      const d = await r.json();
      if (!r.ok || d.ok === false) throw new Error(d.error || "Submit gagal (" + r.status + ").");
      setHistoryId(String(d.historyId));
      setAccount(String(d.account || ""));
      // Polling status tiap 10 detik, maks 15 menit. 1x cek per request server.
      const deadline = Date.now() + 15 * 60 * 1000;
      while (Date.now() < deadline) {
        setStatus("Diproses Jimeng... (history " + d.historyId + ", akun " + d.account + ")");
        await sleep(10000);
        const s = await fetch(
          "/api/jimeng?resource=status&historyId=" + encodeURIComponent(String(d.historyId)) + "&account=" + encodeURIComponent(String(d.account)),
          { cache: "no-store" },
        );
        const sd = await s.json();
        if (!s.ok || sd.ok === false) throw new Error(sd.error || "Cek status gagal (" + s.status + ").");
        if (sd.done && sd.url) {
          setVideoUrl(String(sd.url));
          setStatus("Selesai.");
          return;
        }
      }
      throw new Error("Timeout 15 menit, task masih diproses. Simpan historyId ini dan cek lagi nanti: " + d.historyId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0b0d16", color: "#f5f4fb", fontFamily: "Arial, sans-serif", padding: "32px 20px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: "#b8a6ff", fontWeight: 800 }}>KAZAMA AI · JIMENG · FILE BARU</p>
        <h1 style={{ fontSize: 32, margin: "12px 0" }}>Seedance 2.5 Flash · 30 detik</h1>
        <p style={{ color: "#aab2c1", lineHeight: 1.7 }}>
          Model Jimeng, bukan NexaBot. Pakai kredit gratis pool Jimeng (JIMENG_SESSIONIDS di Vercel),
          jadi <b style={{ color: "#f5f4fb" }}>tidak memotong Credit KAZAMA</b>. Live 30 detik belum
          terverifikasi — kalau Jimeng menolak, errornya ditampilkan apa adanya.
        </p>
        <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
          <label>
            <span style={{ display: "block", fontSize: 12, marginBottom: 6 }}>MODEL</span>
            <select value={model} onChange={(e) => setModel(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 10, background: "#151b29", color: "#f5f4fb", border: "1px solid #3a4051" }}>
              {MODELS.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span style={{ display: "block", fontSize: 12, marginBottom: 6 }}>PROMPT</span>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} maxLength={2000} placeholder="Contoh: kota malam hujan, neon memantul di jalan basah, sinematik" style={{ width: "100%", padding: 12, borderRadius: 10, background: "#151b29", color: "#f5f4fb", border: "1px solid #3a4051" }} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <label>
              <span style={{ display: "block", fontSize: 12, marginBottom: 6 }}>DURASI</span>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 10, background: "#151b29", color: "#f5f4fb", border: "1px solid #3a4051" }}>
                <option value="10">10 detik</option>
                <option value="20">20 detik</option>
                <option value="30">30 detik</option>
              </select>
            </label>
            <label>
              <span style={{ display: "block", fontSize: 12, marginBottom: 6 }}>RASIO</span>
              <select value={ratio} onChange={(e) => setRatio(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 10, background: "#151b29", color: "#f5f4fb", border: "1px solid #3a4051" }}>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="1:1">1:1</option>
              </select>
            </label>
            <label>
              <span style={{ display: "block", fontSize: 12, marginBottom: 6 }}>RESOLUSI</span>
              <select value={resolution} onChange={(e) => setResolution(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 10, background: "#151b29", color: "#f5f4fb", border: "1px solid #3a4051" }}>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>
            </label>
          </div>
          <button onClick={generate} disabled={busy} style={{ padding: 14, borderRadius: 10, background: "#b8a6ff", color: "#171326", fontWeight: 800, border: "none", cursor: busy ? "wait" : "pointer" }}>
            {busy ? "Mengirim..." : "Generate Video (Jimeng)"}
          </button>
          {status && <p style={{ color: "#aab2c1" }}>{status}</p>}
          {error && <p style={{ color: "#ff9a9a", background: "#2a1215", padding: 12, borderRadius: 10 }}>{error}</p>}
          {historyId && <p style={{ color: "#aab2c1", fontSize: 12 }}>historyId: {historyId} · akun: {account}</p>}
          {videoUrl && (
            <div>
              <video src={videoUrl} controls playsInline style={{ width: "100%", borderRadius: 12 }} />
              <p><a href={videoUrl} target="_blank" rel="noreferrer" style={{ color: "#b8a6ff" }}>Download video</a></p>
            </div>
          )}
          <p style={{ color: "#828da0", fontSize: 12 }}>
            Kembali ke <a href="/studio" style={{ color: "#b8a6ff" }}>Studio KAZAMA</a>.
            Kalau halaman ini error “JIMENG_SESSIONIDS belum diisi”, isi env itu di Vercel
            (project kazama-ai → Settings → Environment Variables), lalu redeploy.
          </p>
        </div>
      </div>
    </main>
  );
}
