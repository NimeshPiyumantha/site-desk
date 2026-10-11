import "../globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "SiteDesk – campaign website operations", robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-ink">{children}</body>
    </html>
  );
}
