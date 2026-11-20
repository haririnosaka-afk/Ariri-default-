import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

async function readBody(response: Response) {
  const raw = await response.text();
  try { return { data: raw ? JSON.parse(raw) : {}, raw }; }
  catch { return { data: null, raw }; }
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}

export async function POST(req: NextRequest) {
  const key = process.env.RELAYROUTER_API_KEY;
  if (!key) return NextResponse.json({ error: "RELAYROUTER_API_KEY belum dipasang di Vercel." }, { status: 503 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "File gambar tidak ditemukan." }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Foto setelah kompresi harus di bawah 4 MB." }, { status: 413 });

    // The browser converts every reference to JPEG. Rebuild the upload with a
    // matching MIME type and filename so the image host never sees .png.jpg
    // or a mismatched extension/content-type pair.
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isJpeg(bytes)) {
      return NextResponse.json({ error: "Foto belum menjadi JPEG yang valid. Hapus foto tersebut lalu unggah ulang." }, { status: 415 });
    }

    const upstream = new FormData();
    upstream.append("file", new Blob([bytes], { type: "image/jpeg" }), "kazama-reference.jpg");

    const response = await fetch("https://imageproxy.api-relay.app/api/upload", {
      method: "POST",
      headers: { Authorization: "Bearer " + key },
      body: upstream,
      signal: AbortSignal.timeout(55000)
    });
    const { data, raw } = await readBody(response);

    if (!response.ok) {
      const message = data?.message || data?.error || data?.msg || raw.slice(0, 500) || "Upload gambar ditolak layanan gambar RelayRouter.";
      console.error("[KAZAMA upload] upstream error", response.status, message);
      return NextResponse.json({ error: "Upload foto gagal (" + response.status + "): " + String(message) }, { status: 502 });
    }
    if (!data) {
      console.error("[KAZAMA upload] non-JSON response", response.status, raw.slice(0, 300));
      return NextResponse.json({ error: "Layanan upload RelayRouter mengirim respons yang bukan JSON." }, { status: 502 });
    }

    const url = data.url || data.data?.url || data.data?.[0]?.url || data.result?.url || data.image_url;
    if (typeof url !== "string" || !/^https:\/\//i.test(url)) {
      console.error("[KAZAMA upload] missing image URL", JSON.stringify(data).slice(0, 500));
      return NextResponse.json({ error: "Upload selesai tetapi URL gambar publik tidak diterima." }, { status: 502 });
    }

    // Verify the returned public URL is fetchable as an actual image before
    // spending a generation request. This catches expired/private/broken URLs.
    const check = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-31", Accept: "image/*" },
      signal: AbortSignal.timeout(12000),
      cache: "no-store"
    });
    const contentType = check.headers.get("content-type") || "";
    if (!check.ok || !contentType.toLowerCase().startsWith("image/")) {
      await check.body?.cancel();
      return NextResponse.json({
        error: "URL foto dari layanan upload tidak bisa dibaca publik (HTTP " + check.status + ", " + (contentType || "tanpa content-type gambar") + "). Coba unggah ulang."
      }, { status: 502 });
    }
    await check.body?.cancel();

    return NextResponse.json({ url, mimeType: "image/jpeg", verified: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[KAZAMA upload] request failed", message);
    return NextResponse.json({ error: "Koneksi upload foto gagal: " + message }, { status: 502 });
  }
}
