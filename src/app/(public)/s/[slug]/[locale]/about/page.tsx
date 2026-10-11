import { PublicPage, publicMetadata } from "../shared";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string; locale: string }> };

export async function generateMetadata({ params }: P) {
  const { slug, locale } = await params;
  return publicMetadata(slug, locale, "about");
}

export default async function Page({ params }: P) {
  const { slug, locale } = await params;
  return <PublicPage slug={slug} locale={locale} page="about" />;
}
