import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.AGNES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Agnes belum dikonfigurasi. Tambahkan AGNES_API_KEY di Environment Variables Vercel." },
      { status: 503 }
    );
  }

  let body: { prompt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Data prompt tidak valid." }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "Prompt wajib diisi." }, { status: 400 });
  }
  if (prompt.length > 7000) {
    return NextResponse.json({ error: "Prompt maksimal 7.000 karakter." }, { status: 400 });
  }

  try {
    const response = await fetch("https://apihub.agnes-ai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "agnes-2.5-pro",
        temperature: 0.3,
        max_tokens: 2000,
        messages: [
          {
            role: "system",
            content:
              "You are an expert video-generation prompt editor. Improve clarity, structure, action continuity, camera direction, and visual consistency while preserving the user's original intent, characters, events, constraints, and language. Do not invent new characters, actions, locations, dialogue, or visual details. Preserve reference tokens such as @image1, @image2, and @image3 exactly. Do not add explanations, headings about your process, or markdown fences. Return only the improved video prompt.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(55000),
    });

    const raw = await response.text();
    let data: any;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      return NextResponse.json(
        { error: "Respons Agnes bukan JSON yang valid." },
        { status: 502 }
      );
    }

    if (!response.ok) {
      const detail = data?.error?.message || data?.message || data?.error || "Permintaan Agnes gagal.";
      return NextResponse.json({ error: `Agnes API (${response.status}): ${String(detail).slice(0, 400)}` }, { status: response.status >= 400 && response.status < 500 ? response.status : 502 });
    }

    const improvedPrompt = data?.choices?.[0]?.message?.content;
    if (typeof improvedPrompt !== "string" || !improvedPrompt.trim()) {
      return NextResponse.json({ error: "Agnes tidak mengembalikan teks prompt." }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      model: "agnes-2.5-pro",
      improvedPrompt: improvedPrompt.trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Koneksi Agnes gagal: ${message}` }, { status: 502 });
  }
}
