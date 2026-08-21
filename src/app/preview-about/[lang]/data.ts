import { prisma } from "@/lib/prisma";
import { cache } from "react";
import { refToLocalUrl } from "@/lib/sanityRefs";
import { CORPORATE_SLUGS, type CorporateLocale } from "@/lib/corporatePageSlugs";

/* Data the About page still reads from the DB rather than from copy.ts.

   The 2026-08-21 content decision was deliberately hybrid: section prose lives
   in copy.ts (versioned, reviewed, four locales in one place), but the TEAM
   and the CLIENT REVIEWS stay database-backed — people join and leave, and
   reviews accumulate, and neither should need a deploy. Both are read out of
   the same singlepages row the old block-rendered page used, so the admin's
   existing editing workflow keeps working unchanged. */

export type TeamMember = {
  name: string;
  position: string;
  /** The stored `description` field is a comma-separated list of spoken languages. */
  languages: string[];
  photo: string | null;
  alt: string;
};

export type Review = {
  name: string;
  text: string;
  photo: string | null;
};

const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/** Portable-text block array → plain string. */
const plain = (v: unknown): string =>
  asArray(v)
    .map((b) => asArray(b?.children).map((c: any) => c?.text ?? "").join(""))
    .filter((s) => s.trim())
    .join(" ");

export const getAboutPageData = cache(async (lang: string) => {
  const l = (["en", "de", "pl", "ru"].includes(lang) ? lang : "en") as CorporateLocale;
  const row = await prisma.singlepage.findUnique({
    where: { language_slug: { language: l as any, slug: CORPORATE_SLUGS.about[l] } },
    select: { contentBlocks: true, previewImage: true },
  });

  const blocks = asArray(row?.contentBlocks);

  const teamBlock = blocks.find((b) => b?._type === "teamBlock");
  const team: TeamMember[] = asArray(teamBlock?.members).map((m: any) => ({
    name: m?.name ?? "",
    position: m?.position ?? "",
    // "deutsch, english, русский" → ["deutsch", "english", "русский"]
    languages: String(m?.description ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    photo: refToLocalUrl(m?.image?.asset?._ref),
    alt: m?.image?.alt ?? m?.name ?? "",
  }));

  const reviewsBlock = blocks.find((b) => b?._type === "reviewsFullBlock");
  const reviews: Review[] = asArray(reviewsBlock?.reviews).map((r: any) => ({
    name: r?.name ?? "",
    text: plain(r?.text),
    photo: refToLocalUrl(r?.image?.asset?._ref),
  }));

  // The old page's hero was an imageFullBlock; reuse its photo so the redesign
  // keeps the same team image rather than introducing a new asset.
  const heroBlock = blocks.find((b) => b?._type === "imageFullBlock");
  const heroImage = refToLocalUrl(heroBlock?.imageMain?.picture?.asset?._ref);
  const heroAlt = heroBlock?.imageMain?.picture?.alt ?? "";

  return { team, reviews, heroImage, heroAlt };
});
