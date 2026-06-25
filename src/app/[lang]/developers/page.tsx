import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Header from "@/app/components/Header/Header";
import HeaderWrapper from "@/app/components/HeaderWrapper/HeaderWrapper";
import Footer from "@/app/components/Footer/Footer";
import { i18n } from "@/i18n.config";
import { localizedHref } from "@/lib/locale";
import { abs } from "@/lib/seo";
import { urlFor } from "@/sanity/sanity.client";
import { getAllDevelopersByLang } from "@/sanity/sanity.utils";

export const revalidate = 3600;

const copy = (lang: string) =>
  lang === "de"
    ? { title: "Bauträger auf Zypern", sub: "Wir arbeiten mit den besten Bauträgern Zyperns zusammen." }
    : lang === "ru"
      ? { title: "Застройщики на Кипре", sub: "Мы работаем с лучшими застройщиками Кипра." }
      : lang === "pl"
        ? { title: "Deweloperzy na Cyprze", sub: "Współpracujemy z najlepszymi deweloperami na Cyprze." }
        : { title: "Developers in Cyprus", sub: "We work with the best property developers in Cyprus." };

export async function generateMetadata({ params }: { params: { lang: string } }): Promise<Metadata> {
  const t = copy(params.lang);
  const languages: Record<string, string> = {};
  for (const l of i18n.languages) languages[l.id] = abs(localizedHref(l.id, "developers"));
  return {
    title: t.title,
    description: t.sub,
    alternates: { canonical: abs(localizedHref(params.lang, "developers")), languages },
  };
}

export default async function DevelopersIndex({ params }: { params: { lang: string } }) {
  const { lang } = params;
  const developers = (await getAllDevelopersByLang(lang)) as any[];
  const translations = i18n.languages.map((l) => ({ language: l.id, path: localizedHref(l.id, "developers") }));
  const t = copy(lang);

  return (
    <>
      <HeaderWrapper>
        <Header params={params} translations={translations} />
      </HeaderWrapper>
      <main className="container" style={{ paddingTop: 140, paddingBottom: 64 }}>
        <h1 className="h2-white" style={{ marginBottom: 8 }}>{t.title}</h1>
        <p style={{ marginBottom: 32, color: "#526264" }}>{t.sub}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20 }}>
          {developers.map((d) => {
            const slug = d.slugStr as string | undefined;
            if (!slug) return null;
            const logo = d.logo ? urlFor(d.logo).width(240).url() : null;
            return (
              <Link
                key={d._id}
                href={localizedHref(lang, ["developers", slug])}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, border: "1px solid #ecefee", borderRadius: 8, textDecoration: "none", color: "#0d3f43", minHeight: 160 }}
              >
                {logo ? (
                  <Image src={logo} alt={d.title} width={160} height={90} style={{ objectFit: "contain", height: 90, width: "auto" }} />
                ) : null}
                <span style={{ fontSize: 14, textAlign: "center", fontWeight: 500 }}>{d.title}</span>
              </Link>
            );
          })}
        </div>
      </main>
      <Footer params={params} />
    </>
  );
}
