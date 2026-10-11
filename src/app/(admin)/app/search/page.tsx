import Link from "next/link";
import { languageName } from "@/lib/i18n/languages";
import { requireUser } from "@/server/auth";
import { searchContent } from "@/server/services";

/** Find any text across every website the person can see – useful once there are many sites. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const u = await requireUser();
  const q = (await searchParams).q?.trim() ?? "";
  const hits = q.length >= 2 ? await searchContent(u.actor, u.workspaceId, q) : [];
  const bySite = new Map<string, typeof hits>();
  for (const h of hits) bySite.set(h.siteId, [...(bySite.get(h.siteId) ?? []), h]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Find text on any website</h1>
        <p className="max-w-2xl text-sm text-ink-soft">
          Searches the current draft of every website you have access to, in every language – for example an old phone number, a price or a phrase a client wants changed.
        </p>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4" action="/app/search">
        <div className="min-w-[260px] flex-1">
          <label htmlFor="q" className="mb-1 block text-sm font-medium">Text to look for</label>
          <input id="q" name="q" defaultValue={q} className="input" placeholder="e.g. LKR 45,000 or hello@" autoFocus />
        </div>
        <button className="btn-primary">Search</button>
      </form>

      {q.length >= 2 && (
        <p className="text-sm text-ink-soft" data-testid="search-summary">
          {hits.length === 0
            ? `No website contains “${q}”.`
            : `Found “${q}” in ${hits.length} place${hits.length === 1 ? "" : "s"} on ${bySite.size} website${bySite.size === 1 ? "" : "s"}.`}
        </p>
      )}

      {[...bySite.entries()].map(([siteId, list]) => (
        <section key={siteId} className="card" data-testid={`search-site-${siteId}`}>
          <header className="border-b p-3">
            <Link href={`/app/sites/${siteId}`} className="font-medium hover:underline">{list[0].siteName}</Link>
            <span className="ml-2 text-xs text-ink-soft">{list[0].clientName}</span>
          </header>
          <ul className="divide-y text-sm">
            {list.map((h, i) => (
              <li key={`${h.label}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-3">
                <Link href={h.link} className="font-medium text-brand hover:underline">{h.label}</Link>
                {h.locale && <span className="pill bg-gray-100">{languageName(h.locale)}</span>}
                <span className="w-full text-ink-soft">{h.snippet}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
