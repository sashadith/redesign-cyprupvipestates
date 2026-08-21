import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { refToLocalUrl } from "@/lib/sanityRefs";
import { CORPORATE_SLUGS, type CorporateLocale } from "@/lib/corporatePageSlugs";

/* The team stays database-backed (people join and leave — that must not need
   a deploy), read out of the same singlepages row the old block-rendered page
   used, so the admin's existing editing workflow keeps working unchanged. */

export type ContactMember = {
  name: string;
  position: string;
  languages: string[];
  photo: string | null;
  alt: string;
};

export type ContactsPageData = {
  team: ContactMember[];
  /** The page's own hero photo, from the singlepage row's previewImage. */
  heroImage: string | null;
  heroAlt: string;
};

export const getContactsPageData = cache(async (lang: string): Promise<ContactsPageData> => {
  const l = (["en", "de", "pl", "ru"].includes(lang) ? lang : "en") as CorporateLocale;
  const row = await prisma.singlepage.findUnique({
    where: { language_slug: { language: l as any, slug: CORPORATE_SLUGS.contacts[l] } },
    select: { contentBlocks: true, previewImage: true },
  });

  const blocks = Array.isArray(row?.contentBlocks) ? (row!.contentBlocks as any[]) : [];
  const teamBlock = blocks.find((b) => b?._type === "teamBlock");
  const members = Array.isArray(teamBlock?.members) ? teamBlock.members : [];

  const team: ContactMember[] = members.map((m: any) => ({
    name: m?.name ?? "",
    position: m?.position ?? "",
    // "deutsch, english, русский" → ["deutsch", "english", "русский"]
    languages: String(m?.description ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
    photo: refToLocalUrl(m?.image?.asset?._ref),
    alt: m?.image?.alt ?? m?.name ?? "",
  }));

  const preview = row?.previewImage as any;
  return {
    team,
    heroImage: refToLocalUrl(preview?.asset?._ref),
    heroAlt: preview?.alt ?? "",
  };
});
