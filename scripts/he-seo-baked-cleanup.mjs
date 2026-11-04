#!/usr/bin/env node
/* One-off cleanup (2026-10-17): Hebrew SEO meta with figures baked in.
 *
 * The admin editor pre-filled empty SEO fields with the auto text and "Save
 * overrides" stored it, so published developments carried a frozen
 * "N יחידות זמינות החל מ-€X" in seo.descHE (fixed in the editor and in
 * saveOverride — see isAutoSeoText in src/lib/developmentSeo.ts). The HE
 * translation queue skips any row whose titleHE/descHE is filled, so these
 * never got a real translation.
 *
 * Target: published developments whose descHE holds a euro figure or the auto
 * template's unit-count phrase. Deliberately NOT "any digit": translated copy
 * legitimately says "3 חדרי שינה" or "רבעון 2 2027".
 *
 * Action (--apply only): remove titleHE + descHE from seo (both — the queue
 * skips when either is set, and the title is the auto template too), write
 * one admin_audit_logs row holding the old values, and add a PENDING
 * development-seo-he queue row unless one is already pending. The he-translate
 * cron drains the queue. Until then the page renders the live auto text.
 *
 *   node scripts/he-seo-baked-cleanup.mjs            # dry run, read-only
 *   node scripts/he-seo-baked-cleanup.mjs --apply    # writes
 *
 * Needs DATABASE_URL — in this repo .env.local points at PRODUCTION. */
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

const TARGET_SQL = `
  SELECT d.id, d."publicName" AS name, o.seo->>'titleHE' AS "titleHE", o.seo->>'descHE' AS "descHE"
  FROM developments d JOIN development_overrides o ON o."developmentId" = d.id
  WHERE d."publishStatus" = 'published'
    AND (o.seo->>'descHE' ~ '€ ?[0-9]|[0-9] ?€' OR o.seo->>'descHE' ~ '[0-9]+ יחידות זמינות|יחידה אחת זמינה')
  ORDER BY d."publicName"`;

async function main() {
  await prisma.$transaction(async (tx) => {
    if (!APPLY) await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const rows = await tx.$queryRawUnsafe(TARGET_SQL);
    const pending = new Set(
      (await tx.aiGenerationQueue.findMany({
        where: { status: "PENDING", locale: "he", entityType: "development-seo-he", entityId: { in: rows.map((r) => r.id) } },
        select: { entityId: true },
      })).map((r) => r.entityId),
    );
    for (const r of rows) console.log(`${r.name.padEnd(40)} ${r.descHE}`);
    console.log(`\n${rows.length} development(s) targeted; ${rows.length - pending.size} queue row(s) to add, ${pending.size} already pending.`);
    if (!APPLY) { console.log("Dry run — nothing written. Re-run with --apply."); return; }

    for (const r of rows) {
      await tx.$executeRaw`UPDATE development_overrides SET seo = seo - 'titleHE' - 'descHE', "updatedAt" = now() WHERE "developmentId" = ${r.id}`;
      if (!pending.has(r.id)) {
        await tx.aiGenerationQueue.create({ data: { entityType: "development-seo-he", entityId: r.id, locale: "he", status: "PENDING" } });
      }
    }
    await tx.adminAuditLog.create({
      data: {
        actorName: "script:he-seo-baked-cleanup",
        action: "he_seo_baked_figures_cleared",
        targetType: "Development",
        targetId: "batch",
        detail: { count: rows.length, rows: rows.map((r) => ({ id: r.id, name: r.name, titleHE: r.titleHE, descHE: r.descHE })) },
      },
    });
    console.log(`Applied: cleared titleHE/descHE on ${rows.length} row(s), queued ${rows.length - pending.size}.`);
  }, { timeout: 60_000 });
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
