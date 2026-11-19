import { redirect } from "next/navigation";

// Keep the legacy URL from opening a separate provider-specific generator.
export default function LegacyDoubaoPage() {
  redirect("/");
}
