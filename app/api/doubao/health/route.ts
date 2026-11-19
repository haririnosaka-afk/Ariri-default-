import { NextResponse } from "next/server";
import { safeDoubaoPoolStatus } from "@/lib/doubao-pool";
export const dynamic = "force-dynamic";
export async function GET() {
  const status = safeDoubaoPoolStatus();
  return NextResponse.json({ ...status, accessCodeRequired: true, mode: "authorized_api_key_pool", note: status.configured ? "API Key tersedia di server. Koneksi akun diuji saat request pertama." : "Tambahkan DOUBAO_ARK_API_KEYS di Vercel Environment Variables." });
}
