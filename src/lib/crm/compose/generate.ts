import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/ai/anthropic";
import { matchDevelopmentsForLead, type DevelopmentMatch } from "@/lib/crm/matching";
import { determineLeadState, type LeadState } from "./leadState";
import { loadPlaybook } from "./loadPlaybook";
import { buildFirstContactOpening } from "./greeting";
import { buildEmailClosing } from "./closing";

// Real number from the current signature — given to the model as literal
// data (never let it invent or reformat a phone number), see call-offer.md.
const CONTACT_PHONE = "+357 99278285";

// Pinned to Sonnet 5 specifically for this feature (2026-07 — confirmed with
// the user so the SEO Advisor, which also calls Anthropic, stays on its own
// existing model independently). Sonnet 5's tokenizer runs ~30% more tokens
// for the same text than the previous generation, hence the higher MAX_TOKENS
// below versus what a naive port of the seoAdvisor call would use. Sonnet 5
// also rejects non-default temperature/top_p — this call deliberately sets
// neither. A newer "effort" (low/medium/high/xhigh/max) output-quality knob
// exists for this model but is beta-only in @anthropic-ai/sdk 0.110.0
// (BetaOutputConfig, client.beta.messages.create) — left out for now to stay
// on the stable API surface; revisit if the draft quality needs tuning.
const COMPOSE_MODEL = process.env.ANTHROPIC_MODEL_COMPOSE || "claude-sonnet-5";

export type ComposeChannel = "EMAIL" | "WHATSAPP";

export type ComposeResult =
  | { ok: true; channel: ComposeChannel; subject: string | null; body: string; leadState: LeadState; matchedDevelopmentNames: string[] }
  | { ok: false; error: string };

const MAX_TOKENS: Record<ComposeChannel, number> = { WHATSAPP: 400, EMAIL: 1100 };
const TOP_MATCHES = 3;
const MIN_SCORE_TO_MENTION = 40; // below this, a "match" is too weak to be worth naming — treat as no real match

// Only the fields the model is allowed to know about a matched property —
// nothing invented, nothing beyond what matchDevelopmentsForLead() actually
// returned. This shape IS the hallucination guard's data half; the prompt
// half is the explicit instruction below.
function summarizeMatch(m: DevelopmentMatch) {
  return {
    name: m.development.publicName,
    location: [m.development.area, m.development.district, m.development.town].filter(Boolean)[0] ?? null,
    priceFrom: m.development.priceFrom,
    priceTo: m.development.priceTo,
    currency: m.development.currency,
    unitsAvailable: m.development.unitsAvailable,
    unitsTotal: m.development.unitsTotal,
    exampleUnits: m.matchedUnits.slice(0, 2).map((u) => ({ type: u.type, beds: u.beds, areaBuilt: u.areaBuilt, price: u.price })),
  };
}

// Real budget signal, either the lead's own stated number or — much more
// common in practice (see the 2026-07-24 budget-signal audit: 43% of leads
// have a stated budgetMax vs 79% with a pageSource, many of which are direct
// project-page URLs) — inferred from a specific project page they visited.
// Both are real data; "inferred_from_browsing" must be presented to the
// model as an anchor to state tentatively, never as a certainty.
type BudgetSignal =
  | { known: true; source: "stated"; amount: number; currency: "EUR" }
  | { known: true; source: "inferred_from_browsing"; amount: number; currency: string; projectName: string }
  | { known: false };

type IdentifiedProject = { name: string; completion: string | null; priceFrom: number | null; currency: string } | null;

// Project.completionDate is occasionally a raw "YYYY-MM-DD" string (unlike
// Development.completion, which is already free-form like "Q2 2027") —
// reformat only when it parses cleanly as an ISO date; otherwise pass through
// unchanged so a value that's already free-form text isn't mangled.
function formatCompletion(raw: string | null): string | null {
  if (!raw) return null;
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!isoMatch) return raw;
  const [, year, month] = isoMatch;
  const quarter = Math.floor((Number(month) - 1) / 3) + 1;
  return `Q${quarter} ${year}`;
}

// Resolved once per draft, independent of budget — a lead's pageSource often
// names the exact project they came from (79% of leads have a pageSource;
// see the 2026-07-24 budget-signal audit), which is real, citable data for
// the "send the brochure for THIS project" opening (examples.md), not just a
// budget hint. Checks Development first (the newer model), then falls back
// to the legacy Project model (following supersession if a Project has been
// migrated to a Development) — both real NEW leads found on 2026-07-24 only
// resolve via the legacy Project model, so this fallback is not an edge case.
async function resolveIdentifiedProject(pageSource: string | null): Promise<IdentifiedProject> {
  const slugMatch = pageSource?.match(/\/projects\/([a-z0-9-]+)/i);
  if (!slugMatch) return null;
  const slug = slugMatch[1];

  const dev = await prisma.development.findFirst({
    where: { slug, publishStatus: { in: ["published", "ready"] } },
    select: { publicName: true, completion: true, priceFrom: true, currency: true },
  });
  if (dev) return { name: dev.publicName, completion: dev.completion, priceFrom: dev.priceFrom, currency: dev.currency ?? "EUR" };

  const proj = await prisma.project.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      title: true,
      completionDate: true,
      price: true,
      supersededByDevelopment: { select: { publicName: true, completion: true, priceFrom: true, currency: true, publishStatus: true } },
    },
  });
  if (!proj) return null;
  const superseding = proj.supersededByDevelopment;
  if (superseding && ["published", "ready"].includes(superseding.publishStatus)) {
    return { name: superseding.publicName, completion: superseding.completion, priceFrom: superseding.priceFrom, currency: superseding.currency ?? "EUR" };
  }
  return {
    name: proj.title,
    completion: formatCompletion(proj.completionDate),
    priceFrom: proj.price,
    currency: "EUR",
  };
}

function resolveBudgetSignal(
  lead: { budgetMin: number | null; budgetMax: number | null },
  identifiedProject: IdentifiedProject,
): BudgetSignal {
  const stated = lead.budgetMax ?? lead.budgetMin;
  if (stated != null) return { known: true, source: "stated", amount: stated, currency: "EUR" };
  if (identifiedProject?.priceFrom != null) {
    return { known: true, source: "inferred_from_browsing", amount: identifiedProject.priceFrom, currency: identifiedProject.currency, projectName: identifiedProject.name };
  }
  return { known: false };
}

function buildSystemPrompt(
  state: LeadState,
  language: string,
  channel: ComposeChannel,
  openingGreeting: string | null,
  callOfferEligible: boolean,
): string {
  const pb = loadPlaybook(state, language);
  const lengthRule = channel === "WHATSAPP"
    ? "This is a WhatsApp message: 2-4 short sentences maximum, no subject line, no greeting-letter formality — write the way a real short WhatsApp message reads. Do not add a closing sign-off or name at the end."
    : "This is an email: include a subject line, distinct from the body and varied to match this specific lead's state and situation — never default to a generic phrase like 'Following up on your enquiry'. Body length should match a normal, considerate reply — not a brochure, not a one-liner. Do NOT write a closing valediction, your name, or a role line (no 'Best regards, Sascha' etc.) — that closing block plus the real signature are appended automatically by the sending system after your text. End the body naturally after the last substantive sentence, right after the opening greeting's content — do not write the greeting's line itself as a separate concern, see the greeting rule below.";

  const greetingRule = openingGreeting
    ? `Open the message with EXACTLY this text, verbatim, as your first lines — do not rephrase, translate, retranslate, or alter a single word of it, including its one exclamation mark:\n"${openingGreeting}"\nContinue directly after it with the rest of the message (value-first paragraph if applicable, then the three bulleted questions, etc. — see by-state.md).`
    : "This is not the first contact — do not use a fixed greeting. Look at how the lead has addressed Sascha in the timeline (first name vs formal title, formality level) and mirror that; if nothing in the timeline gives a clear signal, use the same style as a first-contact greeting would (see by-language.md's Salutation section).";

  return [
    "You are drafting a reply for Sascha Dith, a buyer's advisor for Cyprus real estate, to review and send himself. You are NEVER sending anything directly — this is a draft for a human to edit.",
    "\n--- VOICE (standing rules) ---\n" + pb.voice,
    "\n--- PSYCHOLOGY (conversation approach) ---\n" + pb.psychology,
    "\n--- ANTI-SLOP (avoid machine-generated tells) ---\n" + pb.antiSlop,
    "\n--- THIS LEAD'S STATE ---\n" + pb.byState,
    "\n--- LANGUAGE / REGISTER ---\n" + pb.byLanguage,
    // Omitted entirely (not just flagged false) when ineligible — a boolean
    // stated in prose next to instructions on HOW to make an offer proved
    // less reliable than simply not presenting the concept at all (caught
    // 2026-07-24: models kept offering a call in COLD/presentation states
    // despite being told callOfferEligible was false, likely pattern-matching
    // the reference examples' unconditional phone-number mention instead).
    callOfferEligible ? "\n--- CALL OFFER ---\n" + pb.callOffer : "",
    pb.examples ? "\n--- REFERENCE EXAMPLES ---\n" + pb.examples : "",
    "\n--- GREETING ---\n" + greetingRule,
    "\n--- FORMAT ---\n" + lengthRule,
    "\n--- HARD RULE, NO EXCEPTIONS ---",
    "You may ONLY reference specific properties, units, prices, or availability counts that appear verbatim in the 'Matched properties' section of the data you are given below.",
    "If that section is empty or says no properties were matched, do NOT invent, estimate, or hint at any specific property, project name, price, or unit availability. Write a reply that works with zero property mentions — ask a clarifying question or address what the lead actually said instead.",
    "Never round, estimate, or 'fill in' a number that wasn't given to you exactly. Never invent a project name. Never state or imply a unit is available if it wasn't listed.",
    "If no '--- CALL OFFER ---' section appears in this prompt, that itself is the signal: do not offer a call, phone number, video call, or viewing anywhere in the draft, and do not mention contactPhone even if it's present in the data. The reference examples always include a phone offer, but that does not apply to every draft — only replicate that part of the examples when a CALL OFFER section is actually present above.",
    "For budgetSignal specifically: if source is 'stated', treat the amount as a fact they gave you. If source is 'inferred_from_browsing', treat it only as a tentative anchor from a specific project page they viewed — present it as an assumption to confirm ('I'll assume something in that range unless you tell me otherwise'), never as a fact they stated.",
    "For identifiedProject: only mention a completion date if its 'completion' field is non-null — if it's null, offer the brochure and price/availability list without any date. Never estimate or guess a completion date.",
    "contactPhone is the one real phone number to use verbatim if you make a contact offer — never alter its digits or format, never invent a different one.",
    "\n--- HARD RULE, NO EXCEPTIONS: NO EXCLAMATION MARKS (except the one already baked into the greeting) ---",
    "The only exclamation mark that may ever appear is the one already inside the fixed opening text you were told to reproduce verbatim (the greeting rule above), on first contact only. In everything YOU write yourself — every other sentence, in every language, including Russian where a warmer register might otherwise call for one — zero exclamation marks. Warmth is conveyed through word choice and attentiveness, never through punctuation.",
    "\n--- HARD RULE, NO EXCEPTIONS: ANTI-SLOP (this is not a preference, check your draft against it before finishing) ---",
    "Before you finalize the draft, scan it against these three and fix any hit — they are the most common machine-generated tells and the ones most likely to slip through:",
    "1. Zero tolerance for 'not X, but Y' / 'rather than Y' antithesis constructions in any language (e.g. 'I'd rather ask than send a list', 'nicht X, sondern Y', 'a не только Y'-style rejections-then-pivot). State the real point directly instead — do not set up a rejected alternative first.",
    "2. Zero tolerance for 'actually' or its equivalent in any language ('eigentlich', 'на самом деле', 'właściwie') used as a filler intensifier.",
    "3. Em-dash (—) budget: ONE, for the entire message, no matter how long it is. Before you output your final answer, literally count how many '—' characters you have written so far. The first one is free. Every single one after that must be deleted and that sentence rewritten with a comma, a period, or a parenthetical instead — never left in. A message with three or four em-dashes across several sentences is exactly the failure mode this rule exists to prevent.",
    "\n--- HARD RULE, NO EXCEPTIONS: MEASURED DATA IS SILENT, REMEMBERED DATA IS NOT ---",
    "The data you're given may include facts the lead told us themselves (their own message, a timeline note, a date they mentioned) and facts we measured about their behavior (presentation viewCount, lastViewedAt, time-on-page). Treat these two categories completely differently:",
    "- Something the lead told us: you may reference it naturally, framed as something you remember or that they mentioned ('you mentioned...', 'I remember you said...') — never framed as something you observed or noticed just now.",
    "- Something we measured about their behavior (views, opens, timing): NEVER mention or hint at it in the text, in any phrasing, soft or direct. Not 'I saw you looked at this again', not 'noticed you opened it', not any rephrasing of the same fact — including indirect ones like 'from what you've already looked at in the presentation' or 'from the properties you viewed'. If you want to refer to the presentation's contents, frame it around what WAS SENT ('from the selection I put together for you', 'in the overview I sent'), never around what THEY viewed. It may silently inform your tone and timing — it must never appear in the words themselves.",
  ].filter(Boolean).join("\n");
}

export async function generateReplyDraft(leadId: string, channel: ComposeChannel): Promise<ComposeResult> {
  const client = anthropic();
  if (!client) return { ok: false, error: "AI drafting is not configured (ANTHROPIC_API_KEY missing)." };

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    include: {
      interactions: { orderBy: { occurredAt: "desc" }, take: 20 },
    },
  });
  if (!lead) return { ok: false, error: "Lead not found." };

  const presentations = await prisma.clientPresentation.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    take: 1,
    include: { views: { select: { createdAt: true } } },
  });
  const primary = presentations[0];
  const presentation = primary
    ? {
        sentAt: primary.createdAt,
        viewCount: primary.views.length,
        lastViewedAt: primary.views.length ? new Date(Math.max(...primary.views.map((v) => v.createdAt.getTime()))) : null,
      }
    : null;

  const lastDirected = lead.interactions.find((i) => i.direction != null);
  const state = determineLeadState({
    status: lead.status,
    createdAt: lead.createdAt,
    lastDirectedInteractionAt: lastDirected?.occurredAt ?? null,
    presentation,
  });

  const language = lead.languagePreference ?? "en";

  let matches: DevelopmentMatch[] = [];
  try {
    matches = await matchDevelopmentsForLead(
      { budgetMin: lead.budgetMin, budgetMax: lead.budgetMax, propertyTypeInterest: lead.propertyTypeInterest },
      (lead.lastMatchFilters as any) ?? {},
    );
  } catch {
    matches = []; // matching failure must never block drafting — just draft with no properties named
  }
  const usableMatches = matches.filter((m) => m.score >= MIN_SCORE_TO_MENTION).slice(0, TOP_MATCHES);

  const timelineForPrompt = lead.interactions.slice(0, 12).map((i) => ({
    type: i.type,
    direction: i.direction,
    occurredAt: i.occurredAt.toISOString().slice(0, 10),
    excerpt: (i.body ?? i.subject ?? "").slice(0, 240),
  }));

  const identifiedProject = await resolveIdentifiedProject(lead.pageSource);
  const budgetSignal = resolveBudgetSignal(lead, identifiedProject);
  // Both gates computed in code, not left to the model to cross-reference —
  // the model is never shown the computed LeadState as an explicit label, so
  // a prose-only "only in NEW/CONTACTED-fresh" rule in call-offer.md isn't
  // reliably self-enforced (caught 2026-07-24: a PRESENTATION_UNOPENED draft
  // included a call offer). The state gate is now a hard precondition here.
  const callOfferStateGate = state === "NEW" || state === "CONTACTED_FRESH";
  const callOfferEligible =
    callOfferStateGate &&
    (lead.propertyTypeInterest.length > 0 ||
      budgetSignal.known ||
      lead.timeline != null ||
      identifiedProject != null);

  const openingGreeting = state === "NEW" ? buildFirstContactOpening(lead, language) : null;

  const dataPayload = {
    lead: {
      firstName: lead.firstName,
      language,
      budgetSignal,
      identifiedProject,
      contactPhone: CONTACT_PHONE,
      preferredChannel: lead.preferredChannel,
      propertyTypeInterest: lead.propertyTypeInterest,
      internalNote: lead.notes,
      originalMessage: lead.message,
      status: lead.status,
      autoFollowUpCount: lead.autoFollowUpCount,
    },
    timeline: timelineForPrompt,
    presentation,
    matchedProperties: usableMatches.map(summarizeMatch),
  };

  const systemPrompt = buildSystemPrompt(state, language, channel, openingGreeting, callOfferEligible);

  const tool = {
    name: "compose_reply",
    description: "The drafted reply, ready for human review.",
    input_schema: {
      type: "object" as const,
      properties: {
        ...(channel === "EMAIL" ? { subject: { type: "string", description: "Email subject line." } } : {}),
        body: { type: "string", description: "The reply body text." },
      },
      required: channel === "EMAIL" ? ["subject", "body"] : ["body"],
    },
  };

  let msg;
  try {
    msg = await client.messages.create({
      model: COMPOSE_MODEL,
      max_tokens: MAX_TOKENS[channel],
      system: systemPrompt,
      tools: [tool as any],
      tool_choice: { type: "tool", name: "compose_reply" },
      messages: [{ role: "user", content: `Data:\n${JSON.stringify(dataPayload)}` }],
    });
  } catch (e: any) {
    return { ok: false, error: `Could not reach the AI service — ${e?.message || "please try again"}.` };
  }

  const toolUse = msg.content.find((b: any) => b.type === "tool_use") as any;
  const rawBody = (toolUse?.input?.body ?? "").trim();
  const subject = channel === "EMAIL" ? (toolUse?.input?.subject ?? "").trim() : null;
  if (!rawBody || (channel === "EMAIL" && !subject)) {
    return { ok: false, error: `The AI did not return a usable draft (stop reason: ${msg.stop_reason}). Nothing was pre-filled — try again.` };
  }

  // The deterministic closing (valediction + real name + role line) is
  // appended here, never generated by the model — see closing.ts. The
  // signature block itself (logo/contact/social) is appended separately,
  // later, by sendCrmEmailAction via getSignatureHtml.
  const body = channel === "EMAIL" ? `${rawBody}\n\n${buildEmailClosing(language)}` : rawBody;

  return { ok: true, channel, subject, body, leadState: state, matchedDevelopmentNames: usableMatches.map((m) => m.development.publicName) };
}
