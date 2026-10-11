import "../../../../globals.css";
import Script from "next/script";
import { languageInfo } from "@/lib/i18n/languages";
import { getPublicPage } from "@/server/public-data";

export const dynamic = "force-dynamic";

/** Root layout for public websites: correct <html lang>, plus Google Analytics / Tag Manager when configured. */
export default async function PublicLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params;
  const data = getPublicPage(slug, locale);
  const ga = data?.localeOk ? data.content.settings.gaId : "";
  const gtm = data?.localeOk ? data.content.settings.gtmId : "";
  return (
    <html lang={locale} dir={languageInfo(locale).dir}>
      <body>
        {gtm && (
          <>
            <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}</Script>
            <noscript><iframe src={`https://www.googletagmanager.com/ns.html?id=${gtm}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} /></noscript>
          </>
        )}
        {ga && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');`}</Script>
          </>
        )}
        {children}
      </body>
    </html>
  );
}
