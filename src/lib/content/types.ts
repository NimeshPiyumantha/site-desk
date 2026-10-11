/**
 * The content of one campaign website.
 *
 * Every website uses the same template, so every website has the same shape.
 * Texts that visitors read are `Localized` (one value per language code).
 * Lists (getaway types, offers, languages) are arrays of objects with a stable `id`,
 * so a change can always be traced to the exact item it belongs to.
 */
export type LocaleCode = string;
export type Localized = Record<LocaleCode, string>;

export interface LanguageSetting {
  id: LocaleCode; // language code, e.g. "en", "ta", "si"
  public: boolean; // visible to visitors once published
}

export interface CategoryItem {
  id: string;
  title: Localized;
  text: Localized;
  image: string;
}

export interface OfferItem {
  id: string;
  /** Shared offer code. The same code on several websites means "the same offer". */
  code: string;
  title: Localized;
  description: Localized;
  price: Localized;
  image: string;
}

export interface SiteContent {
  settings: {
    defaultLanguage: LocaleCode;
    languages: LanguageSetting[];
    gaId: string;
    gtmId: string;
  };
  brand: { name: string; primaryColor: string; accentColor: string; logoUrl: string };
  seo: { title: Localized; description: Localized };
  nav: { destinations: Localized; offers: Localized; about: Localized; contact: Localized; planTrip: Localized };
  hero: { title: Localized; subtitle: Localized; image: string; primaryCta: Localized; secondaryCta: Localized };
  banner: { enabled: boolean; text: Localized; linkText: Localized };
  categories: { heading: Localized; items: CategoryItem[] };
  offers: { heading: Localized; intro: Localized; bookButton: Localized; items: OfferItem[] };
  cta: { heading: Localized; text: Localized; button: Localized };
  about: { title: Localized; intro: Localized; body: Localized; image: string };
  contact: {
    heading: Localized;
    email: string;
    phone: string;
    whatsapp: string;
    address: Localized;
    formIntro: Localized;
    formName: Localized;
    formEmail: Localized;
    formMessage: Localized;
    formSubmit: Localized;
    formThanks: Localized;
  };
  /** Social links are the same in every language, so they are plain strings, not `Localized`. */
  footer: { tagline: Localized; instagram: string; facebook: string; youtube: string };
}

/** A single edit sent from the editor (or a bulk update) to the server. */
export type EditOp =
  | { op: "set"; path: string; value: string | boolean }
  | { op: "addItem"; list: string; item: { id: string } & Record<string, unknown>; index?: number }
  | { op: "removeItem"; list: string; id: string }
  | { op: "moveItem"; list: string; id: string; toIndex: number };
