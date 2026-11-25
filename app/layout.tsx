import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "KAZAMA AI — Generator Video, Gambar & Kreativitas AI",
  description: "Studio kreatif AI untuk membuat video, gambar, musik, dan suara dalam satu platform. Pilih model, unggah referensi, dan mulai berkarya dengan KAZAMA AI.",
  applicationName: "KAZAMA AI",
  keywords: ["KAZAMA AI", "AI video generator", "AI image generator", "generator video AI Indonesia", "studio kreatif AI"],
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="id"><body>{children}</body></html>;
}
