/**
 * The field registry: one place that describes every editable field of the website template —
 * its human label, which page and section it appears on, whether it is translated, and whether
 * it is required before going live.
 *
 * The editor, the translation import/export, the change history ("what changed") and the
 * publish checks all read from this list. To add or rename a field, change it here.
 */
export type FieldType = "text" | "longtext" | "color" | "image" | "email" | "phone" | "toggle" | "code" | "price" | "url";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  localized?: boolean;
  required?: boolean;
  help?: string;
  /** Private client information: cleared when a website is copied for another campaign. */
  private?: boolean;
}

export interface ListDef {
  key: string; // e.g. "items"
  itemLabel: string; // "Offer"
  titleField: string; // field used to name an item in plain language
  fields: FieldDef[];
  min?: number;
  max?: number;
}

export interface SectionDef {
  id: string;
  label: string;
  page: "home" | "about" | "all";
  description: string;
  fields: FieldDef[];
  list?: ListDef;
}

export const PAGE_LABELS: Record<SectionDef["page"], string> = {
  home: "Home page",
  about: "About page",
  all: "Every page",
};

export const SECTIONS: SectionDef[] = [
  {
    id: "brand",
    label: "Brand & look",
    page: "all",
    description: "Business name, colours and logo used on every page.",
    fields: [
      { key: "name", label: "Business name", type: "text", required: true },
      { key: "primaryColor", label: "Main colour", type: "color", required: true, help: "Used for buttons and the call-to-action band." },
      { key: "accentColor", label: "Highlight colour", type: "color", required: true, help: "Used for the offer strip and small highlights." },
      { key: "logoUrl", label: "Logo image (optional)", type: "image", help: "If empty, the business name is shown as text." },
    ],
  },
  {
    id: "seo",
    label: "Search engines (Google)",
    page: "all",
    description: "How the website appears in Google results and browser tabs.",
    fields: [
      { key: "title", label: "Page title in Google", type: "text", localized: true, required: true, help: "Around 50–60 characters works best." },
      { key: "description", label: "Short description in Google", type: "longtext", localized: true, required: true, help: "Around 150 characters." },
    ],
  },
  {
    id: "nav",
    label: "Menu",
    page: "all",
    description: "The menu at the top and bottom of every page.",
    fields: [
      { key: "destinations", label: "Menu: Destinations", type: "text", localized: true, required: true },
      { key: "offers", label: "Menu: Offers", type: "text", localized: true, required: true },
      { key: "about", label: "Menu: About", type: "text", localized: true, required: true },
      { key: "contact", label: "Menu: Contact", type: "text", localized: true, required: true },
      { key: "planTrip", label: "Menu button", type: "text", localized: true, required: true },
    ],
  },
  {
    id: "hero",
    label: "Top banner",
    page: "home",
    description: "The large picture and headline visitors see first.",
    fields: [
      { key: "title", label: "Main headline", type: "text", localized: true, required: true },
      { key: "subtitle", label: "Text under the headline", type: "longtext", localized: true, required: true },
      { key: "image", label: "Banner picture", type: "image", required: true },
      { key: "primaryCta", label: "First button", type: "text", localized: true, required: true },
      { key: "secondaryCta", label: "Second button", type: "text", localized: true, required: true },
    ],
  },
  {
    id: "banner",
    label: "Offer strip",
    page: "home",
    description: "The thin strip under the top banner that promotes the current offer.",
    fields: [
      { key: "enabled", label: "Show the offer strip", type: "toggle" },
      { key: "text", label: "Strip text", type: "text", localized: true, required: true },
      { key: "linkText", label: "Strip link text", type: "text", localized: true, required: true },
    ],
  },
  {
    id: "categories",
    label: "Getaway types",
    page: "home",
    description: "The picture cards that help visitors choose a kind of trip.",
    fields: [{ key: "heading", label: "Section heading", type: "text", localized: true, required: true }],
    list: {
      key: "items",
      itemLabel: "Getaway type",
      titleField: "title",
      min: 1,
      max: 6,
      fields: [
        { key: "title", label: "Card title", type: "text", localized: true, required: true },
        { key: "text", label: "Card text", type: "text", localized: true, required: true },
        { key: "image", label: "Card picture", type: "image", required: true },
      ],
    },
  },
  {
    id: "offers",
    label: "Offers",
    page: "home",
    description: "Packages and prices. The same offer code on several websites lets you update them together.",
    fields: [
      { key: "heading", label: "Section heading", type: "text", localized: true, required: true },
      { key: "intro", label: "Section introduction", type: "longtext", localized: true, required: true },
      { key: "bookButton", label: "Offer button text", type: "text", localized: true, required: true },
    ],
    list: {
      key: "items",
      itemLabel: "Offer",
      titleField: "title",
      min: 0,
      max: 8,
      fields: [
        { key: "code", label: "Offer code", type: "code", required: true, help: "Use the same code on every website that runs this offer, e.g. FAM-BEACH." },
        { key: "title", label: "Offer name", type: "text", localized: true, required: true },
        { key: "description", label: "Offer description", type: "longtext", localized: true, required: true },
        { key: "price", label: "Price", type: "price", localized: true, required: true, help: "Write it as visitors should see it, e.g. LKR 45,000 per person." },
        { key: "image", label: "Offer picture", type: "image", required: true },
      ],
    },
  },
  {
    id: "cta",
    label: "Call-to-action band",
    page: "home",
    description: "The coloured band that invites visitors to get in touch.",
    fields: [
      { key: "heading", label: "Band heading", type: "text", localized: true, required: true },
      { key: "text", label: "Band text", type: "longtext", localized: true, required: true },
      { key: "button", label: "Band button", type: "text", localized: true, required: true },
    ],
  },
  {
    id: "about",
    label: "About page",
    page: "about",
    description: "A separate page that introduces the business.",
    fields: [
      { key: "title", label: "Page heading", type: "text", localized: true, required: true },
      { key: "intro", label: "Introduction", type: "longtext", localized: true, required: true },
      { key: "body", label: "Main text", type: "longtext", localized: true, required: true },
      { key: "image", label: "Page picture", type: "image", required: true },
    ],
  },
  {
    id: "contact",
    label: "Contact details & enquiry form",
    page: "home",
    description: "How visitors reach this client. Contact details are private to the client and are not copied to new campaigns.",
    fields: [
      { key: "heading", label: "Section heading", type: "text", localized: true, required: true },
      { key: "email", label: "Email address", type: "email", private: true },
      { key: "phone", label: "Phone number", type: "phone", private: true },
      { key: "whatsapp", label: "WhatsApp number (optional)", type: "phone", private: true },
      { key: "address", label: "Address", type: "longtext", localized: true, private: true },
      { key: "formIntro", label: "Form introduction", type: "text", localized: true, required: true },
      { key: "formName", label: "Form: name label", type: "text", localized: true, required: true },
      { key: "formEmail", label: "Form: email label", type: "text", localized: true, required: true },
      { key: "formMessage", label: "Form: message label", type: "text", localized: true, required: true },
      { key: "formSubmit", label: "Form: send button", type: "text", localized: true, required: true },
      { key: "formThanks", label: "Form: thank-you message", type: "text", localized: true, required: true },
    ],
  },
  {
    id: "footer",
    label: "Footer",
    page: "all",
    description: "The bottom of every page, including the client's social media links.",
    fields: [
      { key: "tagline", label: "Footer text", type: "text", localized: true, required: true },
      { key: "instagram", label: "Instagram link (optional)", type: "url", private: true, help: "Paste the full address, e.g. https://instagram.com/yourclient. Leave empty to hide the icon." },
      { key: "facebook", label: "Facebook link (optional)", type: "url", private: true, help: "Leave empty to hide the icon." },
      { key: "youtube", label: "YouTube link (optional)", type: "url", private: true, help: "Leave empty to hide the icon." },
    ],
  },
];

/** Settings that are versioned with the content but edited on the Settings / Languages screens. */
export const SETTINGS_FIELDS: FieldDef[] = [
  { key: "defaultLanguage", label: "Main language", type: "text" },
  { key: "gaId", label: "Google Analytics ID", type: "code", private: true },
  { key: "gtmId", label: "Google Tag Manager ID", type: "code", private: true },
];

export function sectionById(id: string): SectionDef | undefined {
  return SECTIONS.find((s) => s.id === id);
}
