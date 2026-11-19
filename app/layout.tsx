import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "KAZAMA AI — Video Studio", description: "Create cinematic AI videos with the world's leading models." };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="id"><body>{children}</body></html>; }
