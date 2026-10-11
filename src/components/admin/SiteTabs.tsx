"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteTabs({ siteId, pendingCount }: { siteId: string; pendingCount: number }) {
  const pathname = usePathname();
  const base = `/app/sites/${siteId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/edit`, label: "Edit content" },
    { href: `${base}/languages`, label: "Languages" },
    { href: `${base}/publish`, label: `Review & publish${pendingCount ? ` (${pendingCount})` : ""}` },
    { href: `${base}/history`, label: "History" },
    { href: `${base}/backups`, label: "Backups" },
    { href: `${base}/settings`, label: "Settings" },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b text-sm" aria-label="Website sections">
      {tabs.map((t) => {
        const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 ${active ? "border-brand font-medium text-brand" : "border-transparent text-ink-soft hover:text-ink"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
