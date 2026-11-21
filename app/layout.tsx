import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "KAZAMA AI — NexaBot Creative Studio",
  description: "Create Omni Flash videos, AI images, music, speech, and custom voices with NexaBot.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="id"><body>{children}</body></html>;
}
