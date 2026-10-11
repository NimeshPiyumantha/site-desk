/**
 * Renders a client website from its content. Used for the live public pages AND for the private
 * preview, so what the team checks is exactly what visitors will see.
 *
 * Every colour here comes either from the client's own brand (--brand / --accent, set per website)
 * or from a small neutral palette defined on the root element below. The team app's palette is
 * deliberately NOT used: this is the client's website, not our tool.
 *
 * Logical spacing utilities (ms-/me-/ps-/pe-, text-start/end) are used throughout so right-to-left
 * languages such as Arabic lay out correctly; `Arrow` flips itself to match.
 */
import type { Localized, SiteContent } from "@/lib/content/types";
import { languageInfo } from "@/lib/i18n/languages";
import EnquiryForm from "./EnquiryForm";

export interface RenderProps {
  content: SiteContent;
  locale: string;
  page: "home" | "about";
  /** e.g. "/s/summer-escape-galle" or "/app/preview/site_x" */
  base: string;
  slug: string;
  preview?: boolean;
  /** Languages shown in the switcher. */
  languages: string[];
}

/** A direction-aware arrow: points right in English, left in Arabic. */
function Arrow({ rtl }: { rtl?: boolean }) {
  return <span aria-hidden className="inline-block transition-transform duration-200 group-hover:translate-x-0.5" style={rtl ? { transform: "scaleX(-1)" } : undefined}>→</span>;
}

export default function SiteRenderer({ content, locale, page, base, slug, preview, languages }: RenderProps) {
  const main = content.settings.defaultLanguage;
  const t = (v: Localized | undefined) => {
    const text = v?.[locale] ?? "";
    if (text || !preview || locale === main) return text;
    return (
      <mark className="rounded bg-amber-200 px-1 text-amber-900" title="Missing translation – the main-language text is shown">
        ⚠ {v?.[main] ?? ""}
      </mark>
    );
  };
  const href = (loc: string, p: "home" | "about" = page) => `${base}/${loc}${p === "about" ? "/about" : ""}`;
  const home = href(locale, "home");
  const dir = languageInfo(locale).dir;
  const rtl = dir === "rtl";
  const c = content;

  return (
    <div
      lang={locale}
      dir={dir}
      className="min-h-screen scroll-smooth bg-[var(--paper)] text-[var(--ink)] [--ink:#16212c] [--line:rgb(22_33_44/0.09)] [--muted:#5a6978] [--paper:#ffffff] [--sand:#faf8f4] [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-[var(--brand)]"
      style={{ ["--brand" as string]: c.brand.primaryColor, ["--accent" as string]: c.brand.accentColor }}
    >
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--paper)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5">
          <a href={home} className="font-serif text-[1.6rem] leading-none tracking-tight">
            {c.brand.logoUrl ? <img src={c.brand.logoUrl} alt={c.brand.name} className="h-9 w-auto" /> : c.brand.name}
          </a>
          <nav className="order-3 flex w-full gap-6 overflow-x-auto text-sm sm:order-none sm:w-auto sm:flex-1 sm:justify-center">
            {[
              { href: `${home}#destinations`, label: c.nav.destinations },
              { href: `${home}#offers`, label: c.nav.offers },
              { href: href(locale, "about"), label: c.nav.about },
              { href: `${home}#contact`, label: c.nav.contact },
            ].map((l, i) => (
              <a
                key={i}
                href={l.href}
                className="relative whitespace-nowrap py-1 text-[var(--muted)] transition-colors hover:text-[var(--ink)] after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:scale-x-0 after:bg-[var(--brand)] after:transition-transform hover:after:scale-x-100"
              >
                {t(l.label)}
              </a>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-3">
            {languages.length > 1 && (
              <div className="flex overflow-hidden rounded-full border border-[var(--line)] p-0.5 text-xs" aria-label="Language">
                {languages.map((l) => (
                  <a
                    key={l}
                    href={href(l)}
                    hrefLang={l}
                    className={`rounded-full px-2.5 py-1 transition-colors ${l === locale ? "bg-[var(--brand)] font-medium text-white" : "text-[var(--muted)] hover:bg-black/5"}`}
                    aria-current={l === locale ? "true" : undefined}
                  >
                    {languageInfo(l).nativeName}
                  </a>
                ))}
              </div>
            )}
            <a href={`${home}#contact`} className="group hidden items-center gap-1.5 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-shadow hover:shadow-md sm:inline-flex">
              {t(c.nav.planTrip)} <Arrow rtl={rtl} />
            </a>
          </div>
        </div>
      </header>

      {page === "home" ? (
        <main>
          <section className="relative isolate overflow-hidden">
            <img src={c.hero.image} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
            {/* Two layers: a wash for mood, and a stronger side fade so the headline stays readable on any picture. */}
            {/*
              Two decorative fades (no text, so a duplicate element costs nothing):
              on a phone the text sits above the picture, so the wash runs top-to-bottom and the
              picture stays visible; on a wider screen the text sits beside it, so it runs sideways —
              from whichever side the text is on, which also handles right-to-left languages.
            */}
            <div className="absolute inset-0 -z-10 sm:hidden" aria-hidden style={{ backgroundImage: "linear-gradient(to bottom, rgb(255 255 255 / 0.92) 0%, rgb(255 255 255 / 0.75) 55%, rgb(255 255 255 / 0.35) 100%)" }} />
            <div className="absolute inset-0 -z-10 hidden sm:block" aria-hidden style={{ backgroundImage: `linear-gradient(to ${rtl ? "left" : "right"}, #fff 0%, rgb(255 255 255 / 0.8) 45%, transparent 100%)` }} />
            <div className="mx-auto max-w-6xl px-5 py-24 sm:py-32">
              <h1 className="max-w-2xl font-serif text-[clamp(2.4rem,6vw,4rem)] font-normal leading-[1.05] tracking-[-0.02em]">{t(c.hero.title)}</h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-[var(--muted)]">{t(c.hero.subtitle)}</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a href="#destinations" className="group inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-6 py-3.5 text-sm font-medium text-white shadow-md transition-transform hover:-translate-y-0.5">
                  {t(c.hero.primaryCta)} <Arrow rtl={rtl} />
                </a>
                <a href="#offers" className="inline-flex items-center rounded-full border border-[var(--brand)]/30 bg-white/80 px-6 py-3.5 text-sm font-medium text-[var(--brand)] backdrop-blur transition-colors hover:bg-white">
                  {t(c.hero.secondaryCta)}
                </a>
              </div>
            </div>
          </section>

          {c.banner.enabled && (
            <div className="bg-[var(--accent)]">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                <span aria-hidden>☀</span>
                <span className="font-medium">{t(c.banner.text)}</span>
                <span className="hidden text-black/20 sm:inline">|</span>
                <a href="#offers" className="group inline-flex items-center gap-1 font-medium text-[var(--brand)] underline-offset-4 hover:underline">
                  {t(c.banner.linkText)} <Arrow rtl={rtl} />
                </a>
              </div>
            </div>
          )}

          <section id="destinations" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
            <h2 className="text-center font-serif text-[clamp(1.8rem,3.5vw,2.4rem)] tracking-[-0.01em]">{t(c.categories.heading)}</h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {c.categories.items.map((item) => (
                <article key={item.id} className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_1px_2px_rgb(22_33_44/0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgb(22_33_44/0.10)]">
                  <div className="overflow-hidden">
                    <img src={item.image} alt="" className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                  </div>
                  <div className="flex items-center gap-3 p-5">
                    <div className="flex-1">
                      <h3 className="font-serif text-xl">{t(item.title)}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{t(item.text)}</p>
                    </div>
                    <span className="text-xl text-[var(--brand)]"><Arrow rtl={rtl} /></span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {c.offers.items.length > 0 && (
            <section id="offers" className="scroll-mt-24 bg-[var(--sand)]">
              <div className="mx-auto max-w-6xl px-5 py-20">
                <h2 className="text-center font-serif text-[clamp(1.8rem,3.5vw,2.4rem)] tracking-[-0.01em]">{t(c.offers.heading)}</h2>
                <p className="mx-auto mt-4 max-w-2xl text-center leading-relaxed text-[var(--muted)]">{t(c.offers.intro)}</p>
                <div className="mt-12 grid gap-6 md:grid-cols-2">
                  {c.offers.items.map((o) => (
                    <article
                      key={o.id}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_1px_2px_rgb(22_33_44/0.04)] transition-all duration-300 hover:shadow-[0_12px_28px_rgb(22_33_44/0.10)] sm:flex-row"
                      data-offer={o.code}
                    >
                      <div className="overflow-hidden sm:w-48 sm:shrink-0">
                        <img src={o.image} alt="" className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] sm:h-full" />
                      </div>
                      <div className="flex flex-1 flex-col p-6">
                        <h3 className="font-serif text-xl leading-snug">{t(o.title)}</h3>
                        <p className="mt-2.5 flex-1 text-sm leading-relaxed text-[var(--muted)]">{t(o.description)}</p>
                        <p className="mt-5 text-[1.35rem] font-semibold leading-none tracking-[-0.01em] text-[var(--brand)]" data-testid="offer-price">{t(o.price)}</p>
                        <a href="#contact" className="mt-4 self-start rounded-full border border-[var(--brand)]/30 px-4 py-2 text-sm font-medium text-[var(--brand)] transition-colors hover:bg-[var(--brand)] hover:text-white">
                          {t(c.offers.bookButton)}
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section className="relative isolate overflow-hidden bg-[var(--brand)] text-white">
            <div className="absolute inset-0 -z-10 opacity-[0.07]" aria-hidden style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "22px 22px" }} />
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-16 md:flex-row md:items-center">
              <h2 className="flex-1 font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight">{t(c.cta.heading)}</h2>
              <p className="flex-1 leading-relaxed text-white/85">{t(c.cta.text)}</p>
              <a href="#contact" className="group inline-flex items-center gap-2 self-start rounded-full bg-white px-6 py-3.5 text-sm font-medium text-[var(--brand)] shadow-md transition-transform hover:-translate-y-0.5 md:self-auto">
                {t(c.cta.button)} <Arrow rtl={rtl} />
              </a>
            </div>
          </section>

          <section id="contact" className="mx-auto grid max-w-6xl scroll-mt-24 gap-12 px-5 py-20 md:grid-cols-2">
            <div>
              <h2 className="font-serif text-[clamp(1.8rem,3.5vw,2.4rem)] tracking-[-0.01em]">{t(c.contact.heading)}</h2>
              <p className="mt-4 leading-relaxed text-[var(--muted)]">{t(c.contact.formIntro)}</p>
              <ul className="mt-8 space-y-3.5 text-sm">
                {c.contact.email && <ContactRow icon="✉"><a className="underline underline-offset-4 hover:text-[var(--brand)]" href={`mailto:${c.contact.email}`}>{c.contact.email}</a></ContactRow>}
                {c.contact.phone && <ContactRow icon="☎"><a className="underline underline-offset-4 hover:text-[var(--brand)]" href={`tel:${c.contact.phone.replace(/\s/g, "")}`}>{c.contact.phone}</a></ContactRow>}
                {c.contact.whatsapp && (
                  <ContactRow icon="💬">
                    WhatsApp <a className="underline underline-offset-4 hover:text-[var(--brand)]" href={`https://wa.me/${c.contact.whatsapp.replace(/\D/g, "")}`}>{c.contact.whatsapp}</a>
                  </ContactRow>
                )}
                {(c.contact.address[locale] || c.contact.address[main]) && <ContactRow icon="📍">{t(c.contact.address)}</ContactRow>}
              </ul>
            </div>
            <EnquiryForm
              slug={slug}
              locale={locale}
              preview={Boolean(preview)}
              labels={{
                name: String(c.contact.formName[locale] || c.contact.formName[main] || ""),
                email: String(c.contact.formEmail[locale] || c.contact.formEmail[main] || ""),
                message: String(c.contact.formMessage[locale] || c.contact.formMessage[main] || ""),
                submit: String(c.contact.formSubmit[locale] || c.contact.formSubmit[main] || ""),
                thanks: String(c.contact.formThanks[locale] || c.contact.formThanks[main] || ""),
              }}
            />
          </section>
        </main>
      ) : (
        <main className="mx-auto max-w-3xl px-5 py-20">
          <h1 className="font-serif text-[clamp(2.2rem,5vw,3.2rem)] leading-[1.1] tracking-[-0.02em]">{t(c.about.title)}</h1>
          <p className="mt-6 text-xl leading-relaxed text-[var(--muted)]">{t(c.about.intro)}</p>
          <img src={c.about.image} alt="" className="mt-12 aspect-[16/8] w-full rounded-2xl object-cover shadow-[0_8px_28px_rgb(22_33_44/0.10)]" />
          <p className="mt-12 text-lg leading-[1.75]">{t(c.about.body)}</p>
          <a href={`${home}#contact`} className="group mt-12 inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-6 py-3.5 text-sm font-medium text-white shadow-md transition-transform hover:-translate-y-0.5">
            {t(c.cta.button)} <Arrow rtl={rtl} />
          </a>
        </main>
      )}

      <footer className="border-t border-[var(--line)] bg-[var(--sand)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-4 px-5 py-10 text-sm">
          <span className="font-serif text-xl">{c.brand.name}</span>
          <nav className="flex flex-wrap gap-6">
            <a className="text-[var(--muted)] transition-colors hover:text-[var(--ink)]" href={`${home}#destinations`}>{t(c.nav.destinations)}</a>
            <a className="text-[var(--muted)] transition-colors hover:text-[var(--ink)]" href={`${home}#offers`}>{t(c.nav.offers)}</a>
            <a className="text-[var(--muted)] transition-colors hover:text-[var(--ink)]" href={href(locale, "about")}>{t(c.nav.about)}</a>
            <a className="text-[var(--muted)] transition-colors hover:text-[var(--ink)]" href={`${home}#contact`}>{t(c.nav.contact)}</a>
          </nav>
          <span className="ms-auto text-[var(--muted)]">{t(c.footer.tagline)}</span>
          <SocialLinks footer={c.footer} />
        </div>
      </footer>
    </div>
  );
}

/** One line of contact details, with the icon in a soft circle. */
function ContactRow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--sand)] text-xs" aria-hidden>{icon}</span>
      <span>{children}</span>
    </li>
  );
}

/**
 * Social media icons in the footer. Each link is only shown when the team has filled it in,
 * so a client without (say) YouTube simply has no YouTube icon. Icons are inline SVG –
 * no external requests, and they work offline.
 */
const SOCIAL_PATHS: Record<string, string> = {
  instagram:
    "M12 2.2c3.2 0 3.6 0 4.9.07 1.2.05 1.8.25 2.2.42.6.22 1 .48 1.4.9.43.42.7.82.92 1.4.17.4.37 1 .42 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.05 1.2-.25 1.8-.42 2.2-.22.6-.49 1-.91 1.4-.42.43-.82.7-1.4.92-.4.17-1 .37-2.2.42-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.05-1.8-.25-2.2-.42-.6-.22-1-.49-1.4-.91-.43-.42-.7-.82-.92-1.4-.17-.4-.37-1-.42-2.2C2.21 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.05-1.2.25-1.8.42-2.2.22-.6.49-1 .91-1.4.42-.43.82-.7 1.4-.92.4-.17 1-.37 2.2-.42C8.4 2.21 8.8 2.2 12 2.2Zm0 3.3a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 10.7a4.2 4.2 0 1 1 0-8.4 4.2 4.2 0 0 1 0 8.4Zm6.8-10.9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z",
  facebook: "M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z",
  youtube:
    "M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.8-1.8C19.3 5 12 5 12 5s-7.3 0-8.8.5a2.5 2.5 0 0 0-1.8 1.8C1 8.8 1 12 1 12s0 3.2.4 4.7c.2.9.9 1.6 1.8 1.8 1.5.5 8.8.5 8.8.5s7.3 0 8.8-.5a2.5 2.5 0 0 0 1.8-1.8C23 15.2 23 12 23 12ZM9.8 15.3V8.7l6 3.3-6 3.3Z",
};

function SocialLinks({ footer }: { footer: { instagram: string; facebook: string; youtube: string } }) {
  const links = (["instagram", "facebook", "youtube"] as const)
    .map((k) => ({ k, url: (footer[k] ?? "").trim() }))
    .filter((x) => x.url);
  if (!links.length) return null;
  return (
    <div className="flex items-center gap-3.5">
      {links.map(({ k, url }) => (
        <a key={k} href={url} target="_blank" rel="noopener noreferrer me" aria-label={k[0].toUpperCase() + k.slice(1)} className="text-[var(--muted)] transition-colors hover:text-[var(--brand)]">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">
            <path d={SOCIAL_PATHS[k]} />
          </svg>
        </a>
      ))}
    </div>
  );
}
