/** Demo data: two workspaces, four clients, nine websites, four team members, realistic history. */
import { txStore, type SqlDriver } from "./sql";
import { diffContent, summarizeChanges, summaryLine } from "@/lib/content/diff";
import { clone } from "@/lib/content/paths";
import type { SiteContent } from "@/lib/content/types";
import { hashPassword } from "./password";
import { hillCountryContent, summerEscapeContent, surfCampContent } from "./seed-content";

export const DEMO_PASSWORD = "demo1234";

export const DEMO_USERS = [
  { id: "u_amara", name: "Amara Perera", email: "amara@sitedesk.demo", title: "Operations Manager", admin: true },
  { id: "u_nuwan", name: "Nuwan Silva", email: "nuwan@sitedesk.demo", title: "Content Editor", admin: false },
  { id: "u_priya", name: "Priya Raj", email: "priya@sitedesk.demo", title: "Campaign Reviewer", admin: false },
  { id: "u_dilan", name: "Dilan Fernando", email: "dilan@sitedesk.demo", title: "Content Editor (Surf client)", admin: false },
];

const daysAgo = (d: number, h = 10) => {
  const t = new Date(Date.now() - d * 86400_000);
  t.setHours(h, 15, 0, 0);
  return t.toISOString();
};

export async function seedDemo(driver: SqlDriver) {
  // Inside the transaction the queries have to go to the connection holding it, not to the pool.
  const run = (sql: string, ...args: unknown[]) => (txStore.getStore() ?? driver).run(sql, args);
  await driver.transaction(async () => {
    await run("INSERT INTO workspaces (id, name) VALUES ('ws_main', 'Colombo Studio'), ('ws_partner', 'Partner Agency – Kandy')");
    await run("INSERT INTO clients (id, workspace_id, name, created_at) VALUES ('cl_summer', 'ws_main', 'Summer Escape Travel', ?), ('cl_tea', 'ws_main', 'Ceylon Tea Trails', ?), ('cl_surf', 'ws_main', 'Arugam Bay Surf Camp', ?), ('cl_partner', 'ws_partner', 'Partner Agency Clients', ?)", daysAgo(90), daysAgo(80), daysAgo(70), daysAgo(60));
    for (const u of DEMO_USERS) await run("INSERT INTO users (id, name, email, title, password_hash, is_admin) VALUES (?, ?, ?, ?, ?, ?)", u.id, u.name, u.email, u.title, hashPassword(DEMO_PASSWORD), u.admin ? 1 : 0);
    const member = (u: string, c: string, r: string) => run("INSERT INTO memberships (user_id, client_id, role) VALUES (?, ?, ?)", u, c, r);
    await member("u_nuwan", "cl_summer", "editor");
    await member("u_nuwan", "cl_tea", "editor");
    await member("u_priya", "cl_summer", "publisher");
    await member("u_priya", "cl_tea", "publisher");
    await member("u_dilan", "cl_surf", "editor");

    let rel = 0;
    const createSite = async (id: string, clientId: string, name: string, slug: string, history: Array<{ content: SiteContent; by: string; days: number; note?: string }>, draft?: { content: SiteContent; by: string; summary: string }) => {
      await run("INSERT INTO sites (id, client_id, name, slug, created_at, created_by, draft_revision) VALUES (?, ?, ?, ?, ?, 'u_amara', 1)", id, clientId, name, slug, daysAgo(history[0]?.days ?? 1, 8));
      let prev: SiteContent | null = null;
      let rev = 0;
      let liveId: string | null = null;
      for (const [i, h] of history.entries()) {
        rev++;
        const changes = prev ? summarizeChanges(diffContent(prev, h.content), prev, h.content) : [];
        const summary = prev ? summaryLine(changes) : "First launch";
        await run("INSERT INTO draft_revisions (site_id, revision, snapshot, author_id, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)", id, rev, JSON.stringify(h.content), h.by, summary, daysAgo(h.days, 9));
        liveId = `rel_seed_${++rel}`;
        await run(
          "INSERT INTO releases (id, site_id, number, status, snapshot, changes, summary, note, source, author_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'publish', ?, ?)",
          liveId, id, i + 1, i === history.length - 1 ? "live" : "previous", JSON.stringify(h.content), JSON.stringify(changes), summary, h.note ?? "", h.by === "u_nuwan" ? "u_priya" : h.by, daysAgo(h.days),
        );
        await run("INSERT INTO audit_log (at, user_id, client_id, site_id, action, detail) VALUES (?, ?, ?, ?, 'launch.success', ?)", daysAgo(h.days), h.by === "u_nuwan" ? "u_priya" : h.by, clientId, id, `Version ${i + 1} is live: ${summary}`);
        prev = h.content;
      }
      if (draft) {
        rev++;
        await run("INSERT INTO draft_revisions (site_id, revision, snapshot, author_id, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)", id, rev, JSON.stringify(draft.content), draft.by, draft.summary, daysAgo(0, 8));
        await run("INSERT INTO audit_log (at, user_id, client_id, site_id, action, detail) VALUES (?, ?, ?, ?, 'draft.save', ?)", daysAgo(0, 8), draft.by, clientId, id, draft.summary);
      }
      await run("UPDATE sites SET draft_revision = ?, live_release_id = ? WHERE id = ?", rev, liveId, id);
    };

    const contact = (city: string, phone: string, street: string, wa = "") => ({ email: `${city.toLowerCase()}@summerescape.example`, phone, whatsapp: wa, street });

    // Summer Escape Travel – six regional campaign websites sharing offer FAM-BEACH.
    const colombo = summerEscapeContent("Colombo", ["en", "ta"], ["en", "ta"], contact("Colombo", "+94 11 245 6789", "42 Galle Road", "+94 77 245 6789"));
    await createSite("site_colombo", "cl_summer", "Summer Escape – Colombo", "summer-escape-colombo", [{ content: colombo, by: "u_amara", days: 40 }]);

    // Galle has the richest history: launch → Sinhala added → banner change, plus a pending edit awaiting review.
    const g3 = summerEscapeContent("Galle", ["en", "ta", "si"], ["en", "ta", "si"], contact("Galle", "+94 91 222 3344", "12 Church Street, Galle Fort", "+94 76 222 3344"));
    const g1 = clone(g3);
    g1.settings.languages = [{ id: "en", public: true }, { id: "ta", public: true }];
    for (const s of [g1.banner.text, g1.banner.linkText]) delete s.si;
    g1.banner.text = { en: "Early summer offer: Save up to 15% on selected stays", ta: "முன் கோடைச் சலுகை: தேர்ந்தெடுக்கப்பட்ட தங்குமிடங்களில் 15% வரை சேமியுங்கள்" };
    const g2 = clone(g3);
    g2.banner.text = { en: "Early summer offer: Save up to 15% on selected stays", ta: "முன் கோடைச் சலுகை: தேர்ந்தெடுக்கப்பட்ட தங்குமிடங்களில் 15% வரை சேமியுங்கள்", si: "පෙර ගිම්හාන දීමනාව: තෝරාගත් නවාතැන් සඳහා 15% දක්වා ඉතිරි කරගන්න" };
    const gDraft = clone(g3);
    gDraft.offers.items[1].description = { ...gDraft.offers.items[1].description, en: "2 nights in a boutique villa inside Galle Fort, with dinner by the pool and a sunset rampart walk." };
    await createSite(
      "site_galle", "cl_summer", "Summer Escape – Galle", "summer-escape-galle",
      [
        { content: g1, by: "u_amara", days: 45, note: "Campaign launch" },
        { content: g2, by: "u_priya", days: 21, note: "Client sent Sinhala translations" },
        { content: g3, by: "u_priya", days: 6, note: "Main summer offer started" },
      ],
      { content: gDraft, by: "u_nuwan", summary: "Offers › Couples’ Hideaway › Offer description (English): 2 nights in a boutique villa with dinner by the pool. → 2 nights in a boutique villa inside Galle Fort…" },
    );
    await run("UPDATE sites SET review_state = 'ready', review_requested_by = 'u_nuwan', review_requested_at = ?, review_note = 'Client asked to mention the Fort in the couples offer.' WHERE id = 'site_galle'", daysAgo(0, 8));
    await run("INSERT INTO audit_log (at, user_id, client_id, site_id, action, detail) VALUES (?, 'u_nuwan', 'cl_summer', 'site_galle', 'review.request', 'Sent for review: “Client asked to mention the Fort in the couples offer.”')", daysAgo(0, 8));
    await run("INSERT INTO backups (id, site_id, label, kind, draft_snapshot, live_snapshot, live_release_number, created_by, created_at) VALUES ('bk_seed_galle', 'site_galle', 'Before the main summer campaign', 'manual', ?, ?, 2, 'u_priya', ?)", JSON.stringify(g2), JSON.stringify(g2), daysAgo(7));

    await createSite("site_kandy", "cl_summer", "Summer Escape – Kandy", "summer-escape-kandy", [{ content: summerEscapeContent("Kandy", ["en", "ta"], ["en", "ta"], contact("Kandy", "+94 81 223 4455", "8 Temple Street")), by: "u_amara", days: 38 }]);
    await createSite("site_jaffna", "cl_summer", "Summer Escape – Jaffna", "summer-escape-jaffna", [{ content: summerEscapeContent("Jaffna", ["en", "ta"], ["en", "ta"], contact("Jaffna", "+94 21 222 7788", "21 Hospital Road")), by: "u_amara", days: 30 }]);
    await createSite("site_trinco", "cl_summer", "Summer Escape – Trincomalee", "summer-escape-trincomalee", [{ content: summerEscapeContent("Trincomalee", ["en", "ta"], ["en", "ta"], contact("Trincomalee", "+94 26 222 1100", "5 Dockyard Road")), by: "u_amara", days: 28 }]);
    await createSite("site_ella", "cl_summer", "Summer Escape – Ella", "summer-escape-ella", [{ content: summerEscapeContent("Ella", ["en", "si"], ["en", "si"], contact("Ella", "+94 57 222 9090", "3 Passara Road")), by: "u_amara", days: 25 }]);

    // Ceylon Tea Trails – English only (used to demonstrate copying + adding Tamil and Sinhala).
    await createSite("site_hill", "cl_tea", "Hill Country Tea Tours", "hill-country-tea-tours", [{ content: hillCountryContent(), by: "u_amara", days: 20 }]);

    // A client only Dilan (and admins) can see.
    await createSite("site_surf", "cl_surf", "Arugam Bay Surf Camp", "arugam-bay-surf-camp", [{ content: surfCampContent(), by: "u_amara", days: 15 }]);

    const lead = (site: string, name: string, email: string, msg: string, locale: string, d: number) => run("INSERT INTO leads (id, site_id, name, email, message, locale, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", `ld_${Math.random().toString(36).slice(2, 9)}`, site, name, email, msg, locale, daysAgo(d, 14));
    await lead("site_galle", "Kavindi Jayasuriya", "kavindi.j@mail.example", "Is the Family Beach Package available for the first week of December?", "en", 2);
    await lead("site_galle", "Senthil Kumar", "senthil.k@mail.example", "டிசம்பர் 20 முதல் 4 பேருக்கு தங்குமிடம் கிடைக்குமா?", "ta", 1);
    await lead("site_hill", "Emma Clarke", "emma.clarke@mail.example", "We are 4 adults, interested in the Tea Trail Weekend in January.", "en", 3);
  });
}
