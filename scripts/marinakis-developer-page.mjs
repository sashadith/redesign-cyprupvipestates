#!/usr/bin/env node
/* Marinakis Developers — the public developer landing page (2026-10-29).
 *
 *   node --import tsx --env-file=.env.local scripts/marinakis-developer-page.mjs scripts/data/marinakis/developer-page-2026-10-29.json          # dry run
 *   node --import tsx --env-file=.env.local scripts/marinakis-developer-page.mjs scripts/data/marinakis/developer-page-2026-10-29.json --apply  # write
 *
 * Writes one Developer row per language (en/de/pl/ru) sharing a translationGroupId, and
 * points the DeveloperAccount at that group so the page lists this developer's published
 * Developments. Three things here are easy to get wrong:
 *
 *  1. The catalog on the page is NOT joined by name or slug. getDeveloperCatalogByLang
 *     (src/sanity/sanity.utils.ts) reads DeveloperAccount.developerTranslationGroupId and
 *     refuses to show anything if two accounts claim the same group — so that field is
 *     what makes the project grid non-empty, and it must be set exactly once.
 *  2. `seo` must not be null. The page's generateMetadata does `data?.seo.metaTitle`,
 *     with the optional chain on `data`, not on `seo` — a null seo throws and the page
 *     500s. The values in the data file are deliberate placeholders for the operator to
 *     replace; they are NOT an attempt at the SEO work itself.
 *  3. HE is not written. Hebrew is only ever added on an explicit request.
 *  4. A NEW page is created OFFLINE (deactivatedAt set): /developers/<slug> 308s to the
 *     developers index and stays out of the index, sitemap and hreflang until someone
 *     clears it. Without that, these rows would put a public page live the moment they
 *     are written — with an empty project grid, because the developments are drafts.
 *     Pass --live to create it visible, or to bring an already-created page online: that
 *     flag is the explicit instruction, and it reactivates the WHOLE translation group
 *     through the same reactivateDeveloperGroup() the admin button calls, because a page
 *     live in DE and offline in EN would leave hreflang pointing into a redirect.
 *     WITHOUT --live an existing page keeps whatever state it is in, so re-running this
 *     to fix a typo in the copy can neither take a live page down nor republish one
 *     somebody deactivated on purpose.
 *
 *     What this does NOT do, and the admin's own Reactivate button does: revalidate the
 *     Next cache and ping IndexNow. The nightly IndexNow sweep covers the second. If the
 *     page still answers with the offline redirect afterwards, it is that cache — click
 *     Reactivate in the admin, which is the path that clears it.
 *
 * The grid stays empty until the developments are published — they are created as drafts
 * by marinakis-sync.mjs. The page itself is live from the moment these rows exist, so
 * publish it when the operator is ready for it, not before.
 *
 * Re-running is safe: rows are matched by (language, slug) and updated in place, and an
 * existing translationGroupId is kept so the account link never has to move. */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.ts";
import { htmlToPortableText } from "../src/lib/portableText/htmlToPt.mjs";
import { reactivateDeveloperGroup } from "../src/lib/developerLifecycle.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
const LIVE = process.argv.includes("--live");
if (!file) { console.error("usage: marinakis-developer-page.mjs <data.json> [--apply] [--live]"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const LANGS = ["en", "de", "pl", "ru"];

try {
  const existing = await prisma.developer.findMany({ where: { slug: data.slug } });
  const clash = await prisma.developer.findMany({ where: { slug: data.slug, NOT: { title: data.title } }, select: { language: true, title: true } });
  if (clash.length) { console.error(`slug ${data.slug} is already used by: ${clash.map((c) => `${c.language}/${c.title}`).join(", ")}`); process.exit(2); }

  const groupId = existing.find((r) => r.translationGroupId)?.translationGroupId ?? randomUUID();
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${file}`);
  console.log(`/developers/${data.slug} — ${existing.length} of ${LANGS.length} language row(s) exist; translationGroupId ${groupId}`);

  for (const lang of LANGS) {
    const l = data.languages[lang];
    const blocks = htmlToPortableText(l.html);
    const h2 = blocks.filter((b) => b.style === "h2").length;
    const row = existing.find((r) => r.language === lang);
    const state = row ? (row.deactivatedAt ? "offline, unchanged" : "live, unchanged") : LIVE ? "LIVE" : "offline";
    console.log(`  ${lang}: ${row ? "update" : "create"} (${state}) — ${blocks.length} blocks, ${h2} headings, excerpt ${l.excerpt.length} chars`);
    if (!APPLY) continue;
    const fields = {
      translationGroupId: groupId, language: lang, slug: data.slug,
      title: data.title, titleFull: l.titleFull, excerpt: l.excerpt,
      logo: data.logo, description: blocks, seo: l.seo,
    };
    // deactivatedAt is deliberately absent from `fields`: an update must never move a
    // page between live and offline as a side effect of a copy change.
    if (row) await prisma.developer.update({ where: { id: row.id }, data: fields });
    else await prisma.developer.create({ data: { sanityId: `local-${randomUUID()}`, deactivatedAt: LIVE ? null : new Date(), ...fields } });
  }

  // --live on rows that already exist: reactivate the whole group, the same DB write the
  // admin's Reactivate button makes. Done after the content writes so a page never goes
  // live carrying the previous copy.
  if (APPLY && LIVE) {
    const stale = await prisma.developer.findMany({ where: { slug: data.slug, deactivatedAt: { not: null } }, select: { id: true, language: true } });
    if (stale.length) {
      const r = await reactivateDeveloperGroup(prisma, stale[0].id);
      console.log(`\n  LIVE: reactivated ${r.rows.map((x) => x.language).sort().join("/")} — /developers/${data.slug} is public`);
      console.log("  (the admin's own button also revalidates the Next cache and pings IndexNow; if the page still redirects, click Reactivate there)");
    }
  }

  const acct = await prisma.developerAccount.findUnique({ where: { slug: data.accountSlug }, select: { id: true, name: true, developerTranslationGroupId: true } });
  if (!acct) {
    console.log(`\naccount ${data.accountSlug} does not exist yet — run marinakis-sync.mjs --apply first, then this script again to link it.`);
  } else if (acct.developerTranslationGroupId === groupId) {
    console.log(`\naccount ${data.accountSlug} already points at this page`);
  } else {
    const other = await prisma.developerAccount.findMany({ where: { developerTranslationGroupId: groupId, NOT: { id: acct.id } }, select: { slug: true } });
    if (other.length) { console.error(`\nrefusing to link: ${other.map((o) => o.slug).join(", ")} already claim this translationGroupId — the catalog would be ambiguous and would render empty.`); process.exitCode = 2; }
    else {
      console.log(`\naccount ${data.accountSlug}: developerTranslationGroupId ${acct.developerTranslationGroupId ?? "null"} → ${groupId} — ${APPLY ? "linked" : "would be linked"}`);
      if (APPLY) await prisma.developerAccount.update({ where: { id: acct.id }, data: { developerTranslationGroupId: groupId } });
    }
  }
  console.log(`\nlogo file: ${data.logoFile} — rsync it to the server's shared uploads before the page goes live.`);
} finally {
  await prisma.$disconnect();
}
