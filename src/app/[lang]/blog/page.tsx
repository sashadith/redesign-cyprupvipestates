// Live blog listing — page 1 (/[lang]/blog). Design/functionality ported from
// /preview-insights; SEO (canonical + hreflang) and real data preserved.
import React from "react";
import { Metadata } from "next";
import { staticAlternates, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { getBlogPageByLang } from "@/sanity/sanity.utils";
import BlogInsights from "./BlogInsights";

type Props = { params: { lang: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getBlogPageByLang(params.lang);
  const { canonical, languages } = staticAlternates(params.lang, "blog");
  return {
    title: data?.metaTitle,
    description: data?.metaDescription,
    alternates: { canonical, languages },
    openGraph: {
      title: data?.metaTitle,
      description: data?.metaDescription,
      url: canonical,
      siteName: "Cyprus VIP Estates",
      locale: params.lang,
      type: "website",
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

const PageBlog = async ({ params }: Props) => <BlogInsights lang={params.lang} page={1} />;

export default PageBlog;
