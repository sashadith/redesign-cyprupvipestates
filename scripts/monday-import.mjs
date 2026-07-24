#!/usr/bin/env node
// KEPT AS REFERENCE ONLY — this ran once, on 2026-07-24, and imported the
// 140 leads that now make up the bulk of the CRM's LOST/CONTACTED/CLOSED
// backlog. Do not run it again: the monday.com subscription this board
// lived on has since been cancelled and the API token used here was
// revoked. Re-running would need a fresh board + a fresh token, plus a
// re-check of the status mapping and dedup rules below against whatever
// that new board looks like.
//
// One-time import of the monday.com board "Leads Website" (id 1761987486) into
// Lead / LeadInteraction / LeadActivity. See docs/SITE-CHANGELOG.md for the
// full spec this was built against (status mapping, dedup rules, special
// cases). Never hardcode the API token here — it's read from
// MONDAY_TOKEN_FILE (a path) or MONDAY_API_TOKEN (an env var), both supplied
// at run time, never committed.
//
// Usage:
//   node monday-import.mjs --dry-run             (default — no DB writes, writes a JSON+text report)
//   node monday-import.mjs --execute              (performs the real import)
//
// Run from a directory that has @prisma/client + a working DATABASE_URL
// (i.e. inside the deployed app tree, not this repo checkout — this script
// only needs Prisma's generated client, not a build).

import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

const BOARD_ID = 1761987486;
const EXCLUDE_GROUP_TITLE = "Demetris Clients";
const IMPORT_MARKER_PREFIX = "_";

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const REPORT_PATH = args.includes("--report") ? args[args.indexOf("--report") + 1] : "./monday-import-report.json";

const TOKEN = process.env.MONDAY_API_TOKEN
  || (process.env.MONDAY_TOKEN_FILE ? fs.readFileSync(process.env.MONDAY_TOKEN_FILE, "utf8").trim() : null);
if (!TOKEN) {
  console.error("Missing monday API token: set MONDAY_API_TOKEN or MONDAY_TOKEN_FILE.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function mondayQuery(query, variables = {}) {
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: TOKEN, "API-Version": "2024-10" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(`monday API error: ${JSON.stringify(json.errors)}`);
  return json.data;
}

async function fetchAllItems() {
  let items = [];
  let cursor = null;
  do {
    const data = await mondayQuery(
      `query($boardId: [ID!], $cursor: String) {
        boards(ids: $boardId) {
          items_page(limit: 100, cursor: $cursor) {
            cursor
            items {
              id name created_at
              group { title }
              column_values {
                id text
              }
            }
          }
        }
      }`,
      { boardId: [String(BOARD_ID)], cursor },
    );
    const page = data.boards[0].items_page;
    items = items.concat(page.items);
    cursor = page.cursor;
  } while (cursor);
  return items;
}

async function fetchUpdatesForItems(itemIds) {
  const map = new Map();
  const batchSize = 20;
  for (let i = 0; i < itemIds.length; i += batchSize) {
    const batch = itemIds.slice(i, i + batchSize);
    const data = await mondayQuery(
      `query($ids: [ID!]) {
        items(ids: $ids) {
          id
          updates(limit: 100) { id text_body created_at creator { name } }
        }
      }`,
      { ids: batch },
    );
    for (const it of data.items) map.set(it.id, it.updates || []);
  }
  return map;
}

// ─── column ids (from get_board_info, board 1761987486) ──────────────────
const COL = {
  status: "status",
  budget: "numeric_mkts3n1n",
  date: "date_mkt0wz3n",
  time: "text_mkt0gyvy",
  recall: "date_mkye5bbp",
  phone: "text_mkkwm0b4",
  prefContact: "text_mkx4pb8s",
  email: "text_mkkwekh3",
  requestSource: "text_mkkwk9kt",
  message: "text_mkq6spmc",
};

function cv(item, colId) {
  const c = item.column_values.find((c) => c.id === colId);
  return c && c.text ? c.text : null;
}

const STATUS_MAP = {
  Stuck: "LOST",
  Closed: "CLOSED",
  "Working on it": "CONTACTED",
  "Keep contact": "CONTACTED",
};

// name-suffix patterns that need stripping before firstName/lastName split
const SUFFIX_PATTERNS = [
  { re: /\s+over\s+whatsapp\s*$/i, label: "over WhatsApp", channel: "WHATSAPP" },
  { re: /\s+via\s+insta(gram)?\s*$/i, label: "via Insta", channel: null },
  { re: /\s+over\s+insta(gram)?\s*$/i, label: "over Insta", channel: null },
  { re: /\s+via\s+tiktok\s*$/i, label: "via TikTok", channel: null },
];

function stripNameSuffix(rawName) {
  for (const p of SUFFIX_PATTERNS) {
    if (p.re.test(rawName)) {
      return { cleanName: rawName.replace(p.re, "").trim(), suffixLabel: p.label, suffixChannel: p.channel };
    }
  }
  return { cleanName: rawName, suffixLabel: null, suffixChannel: null };
}

function splitName(cleanName) {
  // "Unknown - Switzerland (+41783220101)" style anonymous leads — keep just
  // the country as the "last name" instead of dragging the redundant phone
  // (already stored in the phone column) into the name field.
  const unknownMatch = cleanName.match(/^Unknown\s*-\s*([A-Za-zÀ-ÿ ]+?)\s*\(/);
  if (unknownMatch) return { firstName: "Unknown", lastName: unknownMatch[1].trim(), wasUnknownPattern: true };
  const parts = cleanName.trim().split(/\s+/);
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ") || "";
  return { firstName, lastName, wasUnknownPattern: false };
}

function normalizePhoneDigits(phone) {
  if (!phone) return null;
  return phone.replace(/[^\d]/g, "");
}

function phoneValidity(phone) {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return { valid: false, reason: "empty" };
  if (digits.length < 8 || digits.length > 13) return { valid: false, reason: `digit count ${digits.length} outside 8-13` };
  return { valid: true };
}

function prefContactToChannel(text) {
  if (!text) return null;
  const t = text.trim().toLowerCase();
  if (t === "whatsapp") return "WHATSAPP";
  if (t === "email") return "EMAIL";
  if (t === "phone call") return "PHONE";
  return null;
}

function parseMondayDate(dateStr, timeStr) {
  if (!dateStr) return null;
  const time = timeStr && /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : "12:00";
  return new Date(`${dateStr}T${time}:00.000Z`);
}

async function main() {
  console.log(`→ fetching board ${BOARD_ID} items...`);
  const allItems = await fetchAllItems();
  console.log(`  ${allItems.length} total items fetched`);

  const excluded = allItems.filter((i) => i.group.title === EXCLUDE_GROUP_TITLE);
  const candidates = allItems.filter((i) => i.group.title !== EXCLUDE_GROUP_TITLE);
  console.log(`  excluded (${EXCLUDE_GROUP_TITLE}): ${excluded.length}`);
  console.log(`  candidates: ${candidates.length}`);

  console.log(`→ fetching updates for ${candidates.length} items...`);
  const updatesByItem = await fetchUpdatesForItems(candidates.map((i) => i.id));
  const totalUpdates = [...updatesByItem.values()].reduce((s, u) => s + u.length, 0);
  console.log(`  ${totalUpdates} updates fetched`);

  // existing leads for dedup (phone-primary)
  const existingLeads = await prisma.lead.findMany({
    where: { deletedAt: null },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, status: true, notes: true, budgetMin: true, budgetMax: true, message: true, pageSource: true, preferredChannel: true, nextFollowUpAt: true },
  });
  const existingByPhone = new Map();
  for (const l of existingLeads) {
    const digits = normalizePhoneDigits(l.phone);
    if (digits) existingByPhone.set(digits, l);
  }

  // build mapped candidates
  const mapped = [];
  const specialCases = [];
  const noRecallCandidates = []; // for staggering

  for (const item of candidates) {
    const rawName = item.name.trim();
    const { cleanName, suffixLabel, suffixChannel } = stripNameSuffix(rawName);
    if (suffixLabel) specialCases.push({ type: "name-suffix", item: rawName, detail: suffixLabel });
    const { firstName, lastName, wasUnknownPattern } = splitName(cleanName);
    if (!lastName) specialCases.push({ type: "single-word-name", item: cleanName });
    if (wasUnknownPattern) specialCases.push({ type: "anonymous-lead", item: rawName, detail: `imported as "${IMPORT_MARKER_PREFIX}${firstName} ${lastName}", phone kept in phone field` });

    const status = cv(item, COL.status);
    const mappedStatus = STATUS_MAP[status] ?? null;
    if (!mappedStatus) specialCases.push({ type: "unmapped-status", item: rawName, detail: status });

    const rawPhone = cv(item, COL.phone);
    const phoneCheck = phoneValidity(rawPhone);
    if (rawPhone && !phoneCheck.valid) specialCases.push({ type: "invalid-phone", item: rawName, detail: `${rawPhone} (${phoneCheck.reason})` });

    const email = cv(item, COL.email);
    const budgetRaw = cv(item, COL.budget);
    const budget = budgetRaw ? parseInt(budgetRaw.replace(/[^\d]/g, ""), 10) : null;
    const dateStr = cv(item, COL.date);
    const timeStr = cv(item, COL.time);
    const recallStr = cv(item, COL.recall);
    const prefContactRaw = cv(item, COL.prefContact);
    const requestSource = cv(item, COL.requestSource);
    const message = cv(item, COL.message);

    const createdAt = parseMondayDate(dateStr, timeStr) ?? new Date(item.created_at);
    const preferredChannel = prefContactToChannel(prefContactRaw) ?? suffixChannel ?? null;
    const nextFollowUpAt = recallStr ? new Date(`${recallStr}T09:00:00.000Z`) : null;

    const notesParts = [];
    if (message) notesParts.push(message);
    if (suffixLabel) notesParts.push(`monday name suffix: "${suffixLabel}"`);
    if (rawPhone && !phoneCheck.valid) notesParts.push(`⚠ invalid phone from monday: "${rawPhone}" (${phoneCheck.reason}) — excluded from dedup, not used as contact number`);
    if (!recallStr) notesParts.push("no monday Recall date — follow-up date staggered by import script");
    notesParts.push(`Imported from monday.com board "Leads Website" (item #${item.id}, original status: "${status}")`);

    const digits = phoneCheck.valid ? normalizePhoneDigits(rawPhone) : null;
    const existingMatch = digits ? existingByPhone.get(digits) : null;

    const updates = (updatesByItem.get(item.id) || []).map((u) => ({
      body: u.text_body,
      occurredAt: u.created_at,
      createdByName: u.creator?.name ?? null,
      mondayUpdateId: u.id,
    }));

    const candidate = {
      mondayItemId: item.id,
      rawName,
      firstName: `${IMPORT_MARKER_PREFIX}${firstName}`,
      lastName,
      status: mappedStatus,
      originalStatus: status,
      phone: rawPhone,
      phoneValid: phoneCheck.valid,
      email,
      budgetMax: budget,
      createdAt: createdAt.toISOString(),
      preferredChannel,
      nextFollowUpAt: nextFollowUpAt ? nextFollowUpAt.toISOString() : null,
      hasRecallDate: !!recallStr,
      pageSource: requestSource,
      notes: notesParts.join("\n\n"),
      updates,
      existingMatchId: existingMatch ? existingMatch.id : null,
      existingMatchName: existingMatch ? `${existingMatch.firstName} ${existingMatch.lastName}` : null,
    };
    mapped.push(candidate);
    if (!recallStr) noRecallCandidates.push(candidate);
  }

  // Wagner duplicate-pair flag (known special case — same family, different phones)
  const wagnerItems = mapped.filter((m) => /wagner/i.test(m.rawName));
  if (wagnerItems.length > 1) {
    specialCases.push({ type: "duplicate-pair-in-board", item: wagnerItems.map((w) => w.rawName).join(" / "), detail: "distinct phone numbers — not auto-merged, imported as separate leads" });
  }

  // staggered follow-ups for candidates without a Recall date: newest monday
  // createdAt first, spread across a 14–21 day window starting tomorrow.
  noRecallCandidates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // newest first
  const N = noRecallCandidates.length;
  const startDays = 2; // first (newest) lead's follow-up = now + 2 days
  const endDays = 21; // last (oldest) lead's follow-up = now + 21 days
  noRecallCandidates.forEach((c, idx) => {
    const days = N > 1 ? startDays + Math.round((idx / (N - 1)) * (endDays - startDays)) : startDays;
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(9, 0, 0, 0);
    c.nextFollowUpAt = d.toISOString();
    c.followUpStaggerDay = days;
  });

  // Split new vs already-existing (dedup match) — for "new leads" count
  const newCandidates = mapped.filter((m) => !m.existingMatchId);
  const dupCandidates = mapped.filter((m) => m.existingMatchId);

  const statusCounts = {};
  for (const c of newCandidates) statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  const noEmailCount = mapped.filter((c) => !c.email).length;
  const noPhoneCount = mapped.filter((c) => !c.phone).length;
  const invalidPhoneCount = mapped.filter((c) => c.phone && !c.phoneValid).length;
  const noRecallDateCount = mapped.filter((c) => !c.hasRecallDate).length;

  const report = {
    generatedAt: new Date().toISOString(),
    mode: EXECUTE ? "execute" : "dry-run",
    totals: {
      boardItems: allItems.length,
      excludedDemetrisGroup: excluded.length,
      candidates: candidates.length,
      newLeads: newCandidates.length,
      dedupMatchedExisting: dupCandidates.length,
      totalUpdatesFetched: totalUpdates,
      statusCounts,
      noEmailCount,
      noPhoneCount,
      invalidPhoneCount,
      noRecallDateCount_staggeredFollowUps: noRecallDateCount,
    },
    specialCases,
    dedupMatches: dupCandidates.map((c) => ({ monday: c.rawName, mondayPhone: c.phone, matchedExistingId: c.existingMatchId, matchedExistingName: c.existingMatchName })),
    sampleNewLeads: (() => {
      const byFollowUp = [...newCandidates].filter((c) => c.nextFollowUpAt).sort((a, b) => new Date(a.nextFollowUpAt) - new Date(b.nextFollowUpAt));
      const withRecall = newCandidates.filter((c) => c.hasRecallDate).slice(0, 3);
      const pick = [byFollowUp[0], byFollowUp[Math.floor(byFollowUp.length / 2)], byFollowUp[byFollowUp.length - 1], ...withRecall].filter(Boolean);
      const seen = new Set();
      return pick.filter((c) => (seen.has(c.mondayItemId) ? false : (seen.add(c.mondayItemId), true)))
        .map((c) => ({ name: `${c.firstName} ${c.lastName}`, status: c.status, budgetMax: c.budgetMax, createdAt: c.createdAt, nextFollowUpAt: c.nextFollowUpAt, hasRecallDate: c.hasRecallDate }));
    })(),
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify({ ...report, allNewLeads: EXECUTE ? undefined : newCandidates, allDupCandidates: EXECUTE ? undefined : dupCandidates }, null, 2));
  console.log(`\n─── SUMMARY (${report.mode}) ───`);
  console.log(JSON.stringify(report.totals, null, 2));
  console.log(`Special cases flagged: ${specialCases.length} (see ${REPORT_PATH})`);
  console.log(`Report written to ${REPORT_PATH}`);

  if (!EXECUTE) {
    await prisma.$disconnect();
    return;
  }

  // ─── EXECUTE: real writes ────────────────────────────────────────────────
  console.log("\n→ writing to database...");
  let created = 0;
  for (const c of newCandidates) {
    const lead = await prisma.lead.create({
      data: {
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email ?? "",
        phone: c.phone,
        status: c.status,
        source: "MANUAL",
        budgetMax: c.budgetMax,
        pageSource: c.pageSource,
        notes: c.notes,
        preferredChannel: c.preferredChannel,
        nextFollowUpAt: c.nextFollowUpAt ? new Date(c.nextFollowUpAt) : null,
        createdAt: new Date(c.createdAt),
        telegramNotified: true,
        emailNotified: true,
      },
    });
    for (const u of c.updates) {
      await prisma.leadInteraction.create({
        data: {
          leadId: lead.id,
          type: "NOTE",
          body: u.body,
          occurredAt: new Date(u.occurredAt),
          createdByName: u.createdByName,
          metadata: { source: "monday-import", mondayUpdateId: u.mondayUpdateId, mondayItemId: c.mondayItemId },
        },
      });
    }
    // Action Center staleFollowUp suppression: dated at import time (now),
    // never affects "Last contact"/urgency — those read LeadInteraction only.
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: "NOTE",
        content: `Imported from monday.com (original status: "${c.originalStatus}")`,
        createdBy: "monday-import",
      },
    });
    created++;
  }
  // enrich dedup-matched existing leads: only fill EMPTY fields, never overwrite
  let enriched = 0;
  for (const c of dupCandidates) {
    const existing = existingLeads.find((l) => l.id === c.existingMatchId);
    const patch = {};
    if (!existing.email && c.email) patch.email = c.email;
    if (existing.budgetMax == null && c.budgetMax != null) patch.budgetMax = c.budgetMax;
    if (!existing.preferredChannel && c.preferredChannel) patch.preferredChannel = c.preferredChannel;
    if (!existing.pageSource && c.pageSource) patch.pageSource = c.pageSource;
    if (!existing.notes && c.notes) patch.notes = c.notes;
    if (Object.keys(patch).length > 0) {
      await prisma.lead.update({ where: { id: existing.id }, data: patch });
      enriched++;
    }
    for (const u of c.updates) {
      await prisma.leadInteraction.create({
        data: {
          leadId: existing.id,
          type: "NOTE",
          body: u.body,
          occurredAt: new Date(u.occurredAt),
          createdByName: u.createdByName,
          metadata: { source: "monday-import", mondayUpdateId: u.mondayUpdateId, mondayItemId: c.mondayItemId },
        },
      });
    }
  }

  console.log(`✓ created ${created} new leads, enriched ${enriched} existing leads (empty fields only)`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
