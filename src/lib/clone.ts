/**
 * Copying a website for a new campaign, and moving websites between workspaces.
 * Private client information never travels with a copy.
 */
import { z } from "zod";
import { clone } from "./content/paths";
import type { SiteContent } from "./content/types";

/** Everything here is private to the original client and is cleared on a copy. */
export const PRIVATE_ITEMS = [
  "Contact email, phone, WhatsApp and address",
  "Social media links in the footer",
  "Google Analytics and Tag Manager IDs",
  "Enquiries received from visitors",
  "Internal notes",
  "Team access, version history and backups",
];

export function prepareCopy(source: SiteContent, newName: string): SiteContent {
  const c = clone(source);
  c.brand.name = newName;
  c.contact.email = "";
  c.contact.phone = "";
  c.contact.whatsapp = "";
  c.contact.address = Object.fromEntries(Object.keys(c.contact.address).map((k) => [k, ""]));
  c.settings.gaId = "";
  c.settings.gtmId = "";
  c.footer.instagram = "";
  c.footer.facebook = "";
  c.footer.youtube = "";
  return c;
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 48) || "website"
  );
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Checklist shown after copying, so nothing from the old client is launched by mistake. */
export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  /** Manual items are ticked by a person; automatic ones are worked out from the content. */
  manual: boolean;
  link: string;
}

export function copyChecklist(content: SiteContent, ticked: string[], siteId: string): ChecklistItem[] {
  const base = `/app/sites/${siteId}`;
  return [
    { id: "brand", label: "Change the business name, colours and logo", done: ticked.includes("brand"), manual: true, link: `${base}/edit?section=brand` },
    { id: "images", label: "Replace the pictures", done: ticked.includes("images"), manual: true, link: `${base}/edit?section=hero` },
    { id: "texts", label: "Update the texts and offers for this client", done: ticked.includes("texts"), manual: true, link: `${base}/edit?section=offers` },
    { id: "contact", label: "Add this client’s contact details", done: Boolean(content.contact.email || content.contact.phone), manual: false, link: `${base}/edit?section=contact` },
    { id: "analytics", label: "Add this client’s Google Analytics / Tag Manager IDs (optional)", done: Boolean(content.settings.gaId || content.settings.gtmId) || ticked.includes("analytics"), manual: true, link: `${base}/settings` },
    { id: "preview", label: "Check the preview in every language", done: ticked.includes("preview"), manual: true, link: `${base}` },
  ];
}

// ---------- Transfer packages ----------

export const PACKAGE_FORMAT = "sitedesk-website-package";

export interface SitePackage {
  format: typeof PACKAGE_FORMAT;
  version: 1;
  exportedAt: string;
  site: { name: string; slug: string };
  draft: SiteContent;
  live: SiteContent | null;
  includes: { contactDetails: boolean; analyticsIds: boolean };
  /**
   * Uploaded pictures the content refers to, as file name → base64. Without them a package only
   * carries `/media/<id>` references and the website arrives with its pictures broken. Optional,
   * so packages written before this existed still import.
   */
  files?: Record<string, string>;
}

export function buildPackage(
  site: { name: string; slug: string },
  draft: SiteContent,
  live: SiteContent | null,
  opts: { includeContact: boolean; includeAnalytics: boolean },
  files: Record<string, string> = {},
): SitePackage {
  const scrub = (c: SiteContent): SiteContent => {
    let out = clone(c);
    if (!opts.includeContact) {
      out.contact.email = "";
      out.contact.phone = "";
      out.contact.whatsapp = "";
      out.contact.address = Object.fromEntries(Object.keys(out.contact.address).map((k) => [k, ""]));
    }
    if (!opts.includeAnalytics) {
      out.settings.gaId = "";
      out.settings.gtmId = "";
    }
    return out;
  };
  return {
    format: PACKAGE_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    site,
    draft: scrub(draft),
    live: live ? scrub(live) : null,
    includes: { contactDetails: opts.includeContact, analyticsIds: opts.includeAnalytics },
    ...(Object.keys(files).length ? { files } : {}),
  };
}

const localized = z.record(z.string());
const contentSchema = z
  .object({
    settings: z.object({ defaultLanguage: z.string(), languages: z.array(z.object({ id: z.string(), public: z.boolean() })).min(1), gaId: z.string(), gtmId: z.string() }),
    brand: z.object({ name: z.string(), primaryColor: z.string(), accentColor: z.string(), logoUrl: z.string() }),
    seo: z.object({ title: localized, description: localized }),
    hero: z.object({ title: localized, subtitle: localized, image: z.string() }).passthrough(),
    offers: z.object({ items: z.array(z.object({ id: z.string(), code: z.string(), price: localized }).passthrough()) }).passthrough(),
    contact: z.object({ email: z.string(), phone: z.string() }).passthrough(),
  })
  .passthrough();

const packageSchema = z.object({
  format: z.literal(PACKAGE_FORMAT),
  version: z.literal(1),
  exportedAt: z.string(),
  site: z.object({ name: z.string().min(1), slug: z.string() }),
  draft: contentSchema,
  live: contentSchema.nullable(),
  includes: z.object({ contactDetails: z.boolean(), analyticsIds: z.boolean() }),
  // Picture names are checked again before anything is written to disk; see writePackageFiles.
  files: z.record(z.string()).optional(),
});

export function parsePackage(text: string): { ok: true; pkg: SitePackage } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not a SiteDesk website package (it could not be read)." };
  }
  const res = packageSchema.safeParse(data);
  if (!res.success) {
    const first = res.error.issues[0];
    return { ok: false, error: `This file is not a valid SiteDesk website package (${first.path.join(".") || "file"}: ${first.message}).` };
  }
  return { ok: true, pkg: res.data as unknown as SitePackage };
}
