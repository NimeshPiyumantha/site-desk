import BulkWizard from "@/components/admin/BulkWizard";
import { offerCatalog } from "@/lib/bulk";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import { bulkSites } from "@/server/services";
import * as repo from "@/server/repo";

export default async function BulkPage() {
  const u = await requireUser();
  const sites = await bulkSites(u.actor, u.workspaceId);
  const views = await Promise.all(sites.map(async (s) => {
    const row = (await repo.getSite(s.id))!;
    return {
      id: s.id,
      name: s.name,
      languages: s.content.settings.languages.map((l) => l.id),
      canPublish: can(u.actor, "site.publish", row.client_id),
      offers: s.content.offers.items.map((o) => ({ code: o.code, title: o.title[s.content.settings.defaultLanguage] ?? o.code, price: o.price, title_l: o.title, description: o.description })),
      contact: { email: s.content.contact.email, phone: s.content.contact.phone, whatsapp: s.content.contact.whatsapp },
    };
  }));
  const offers = offerCatalog(sites).map((o) => ({ code: o.code, title: o.title, siteIds: o.sites.map((x) => x.id) }));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Update several websites</h1>
        <p className="text-sm text-ink-soft">Change an offer or a contact detail on many websites and languages in one go. You will see exactly what changes before anything is saved. Works on the drafts of websites you have access to.</p>
      </div>
      <BulkWizard sites={views} offers={offers} />
    </div>
  );
}
