import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HeroGreeting from "@/app/c/[token]/HeroGreeting";
import PartnerClosing from "@/app/c/[token]/PartnerClosing";
import { COPY, P_LOCALES, PARTNER_COPY } from "@/app/c/[token]/copy";
import { BRAND_LOGO_MAX_BYTES, checkBrandLogo } from "@/lib/partner/brand";
import { onboardingFactsFrom, onboardingHref, onboardingSteps } from "@/lib/partner/onboarding";
import {
  allowedPresentationSets, buildPresentationCreate, defaultPresentationLocale, draftFromForm, effectiveActiveClients,
  mergePresentationStats, presentationStatusOf, presentationUrl, type PresentationClaimRow,
} from "@/lib/partner/partnerPresentations";
import {
  LOGO_HEADERS, PARTNER_SHARE_IMAGE, PREVIEW_PARAM, brandDisplayName, isPreviewRequest, logoDecision, officeAlertPrefix,
  partnerPresentationAvailable, partnerShareTitle, presentationBranding, presentationOpenedRow, presentationPreviewUrl, tracksClientViews,
  whatsappDigits,
} from "@/lib/partner/presentationBranding";
import { validatePresentationDraft } from "@/lib/partner/presentationDraft";

// Component files use JSX without importing React (Next's automatic runtime); see unitsViewPayload.test.ts.
(globalThis as unknown as { React: typeof React }).React = React;

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const PARTNER = {
  brandName: "Sun Homes", company: "Sun Homes GmbH", firstName: "Anna", lastName: "Berg",
  brandPhone: "+49 170 1234567", brandEmail: "anna@sunhomes.de", brandWebsite: "https://sunhomes.de", hasLogo: true,
  logoUpdatedAt: new Date("2026-10-18T10:00:00Z"),
};

// ── presentationBranding ────────────────────────────────────────────────────

test("cve mode: a presentation without partnerId gets exactly { mode: 'cve' } (the page keeps its old code path)", () => {
  assert.deepEqual(presentationBranding({ token: "tok", partnerId: null }), { mode: "cve" });
  // Even stray partner data never switches a CVE presentation.
  assert.deepEqual(presentationBranding({ token: "tok", partnerId: null, partner: PARTNER }), { mode: "cve" });
});

test("partner mode: brand name, contact, wa.me digits and a versioned logo URL", () => {
  const b = presentationBranding({ token: "abc_DEF-123", partnerId: "p1", partner: PARTNER });
  assert.deepEqual(b, {
    mode: "partner",
    name: "Sun Homes",
    phone: "+49 170 1234567",
    whatsapp: "491701234567",
    email: "anna@sunhomes.de",
    website: "https://sunhomes.de",
    logoUrl: `/c/abc_DEF-123/logo?v=${PARTNER.logoUpdatedAt.getTime()}`,
  });
});

test("partner mode: name falls back to company, then first + last; no logo, no phone, unsafe website dropped", () => {
  const base = { ...PARTNER, hasLogo: false, brandPhone: null, brandWebsite: "http://insecure.example" };
  const b1 = presentationBranding({ token: "t", partnerId: "p1", partner: { ...base, brandName: "  " } });
  assert.equal(b1.mode, "partner");
  if (b1.mode !== "partner") return;
  assert.equal(b1.name, "Sun Homes GmbH");
  assert.equal(b1.logoUrl, null);
  assert.equal(b1.phone, null);
  assert.equal(b1.whatsapp, null);
  assert.equal(b1.website, null);
  assert.equal(brandDisplayName({ brandName: null, company: null, firstName: "Anna", lastName: "Berg" }), "Anna Berg");
  assert.equal(whatsappDigits("+357 99-12 34 56"), "35799123456");
  assert.equal(whatsappDigits("12"), null);
});

test("partner mode never falls back to CVE contact data, even when the partner row is missing", () => {
  assert.deepEqual(presentationBranding({ token: "t", partnerId: "p1", partner: null }), {
    mode: "partner", name: "", phone: null, whatsapp: null, email: null, website: null, logoUrl: null,
  });
});

// ── Public page rendering ───────────────────────────────────────────────────

const heroProps = {
  eyebrowTag: "TAG", greetingWord: "Hello", name: "Bob", introLine: "Intro", requirementsTitle: "Prefs",
  requirementChips: ["Paphos"], note: "Note", advisorName: "Maria", districtImage: null, locale: "en",
};

test("hero: CVE logo without brand, partner logo/name instead of it with brand", () => {
  const cve = renderToStaticMarkup(React.createElement(HeroGreeting, heroProps));
  assert.ok(cve.includes('alt="Cyprus VIP Estates"'));
  assert.ok(!cve.includes("cp-hero__partner"));
  const withLogo = renderToStaticMarkup(React.createElement(HeroGreeting, { ...heroProps, advisorName: "Sun Homes", brand: { name: "Sun Homes", logoUrl: "/c/t/logo" } }));
  assert.ok(withLogo.includes('src="/c/t/logo"'));
  assert.ok(!withLogo.includes("Cyprus VIP Estates"));
  const nameOnly = renderToStaticMarkup(React.createElement(HeroGreeting, { ...heroProps, brand: { name: "Sun Homes", logoUrl: null } }));
  assert.ok(nameOnly.includes('<p class="cp-hero__partnername" data-fx="logo">Sun Homes</p>'));
  assert.ok(!nameOnly.includes("Cyprus VIP Estates"));
});

test("partner closing: partner contact only — no CVE WhatsApp number, phone, email or site; 'Presented by' footer", () => {
  const b = presentationBranding({ token: "t", partnerId: "p1", partner: PARTNER });
  assert.equal(b.mode, "partner");
  if (b.mode !== "partner") return;
  for (const locale of ["en", "de", "pl", "ru"] as const) {
    const html = renderToStaticMarkup(React.createElement(PartnerClosing, { brand: b, locale }));
    assert.ok(html.includes("https://wa.me/491701234567?text="), locale);
    assert.ok(html.includes('href="tel:+491701234567"'));
    assert.ok(html.includes('href="mailto:anna@sunhomes.de"'));
    assert.ok(html.includes('href="https://sunhomes.de"'));
    assert.ok(html.includes(PARTNER_COPY[locale].presentedBy.replace("{name}", "Sun Homes")));
    assert.ok(!html.includes("35799278285"));
    assert.ok(!html.includes("cyprusvipestates.com"));
    assert.ok(!html.includes("Cyprus VIP Estates"));
    assert.ok(!html.includes("cp-closing__photocol"), "no advisor block");
  }
  // A "$&"-style name is inserted literally.
  const odd = renderToStaticMarkup(React.createElement(PartnerClosing, { brand: { ...b, name: "A$&B" }, locale: "en" }));
  assert.ok(odd.includes("Presented by A$&amp;B"));
});

test("page wiring: the CVE path is untouched and partner fields load only for partner presentations", () => {
  const page = src("app/c/[token]/page.tsx");
  // The CVE closing section keeps the office WhatsApp number and the advisor block, in the cve branch only.
  assert.ok(page.includes('whatsappPhone: "35799278285", email: presentation.advisor.email, personalPhone: presentation.advisor.phone,'));
  assert.ok(page.includes('{branding.mode === "partner" ? (\n          <PartnerClosing brand={branding} locale={locale} />'));
  assert.ok(page.includes("const partnerRow = presentation.partnerId\n    ? await prisma.partner.findUnique({"));
  assert.ok(page.includes('advisorName={branding.mode === "partner" ? branding.name || null : presentation.advisor?.name}'));
  assert.ok(page.includes('brand={branding.mode === "partner" ? { name: branding.name, logoUrl: branding.logoUrl } : undefined}'));
  // The partner query never loads the logo bytes into the page.
  assert.ok(!/brandLogo: true/.test(page));
  // Non-partner dead end unchanged; partner dead end has no CVE logo/link.
  assert.ok(page.includes("return <NotAvailable locale={asPLocale(presentation?.locale)} />;"));
  const partnerGone = page.slice(page.indexOf("function PartnerNotAvailable"), page.indexOf("export default async function"));
  assert.ok(!partnerGone.includes("cyprusvipestates") && !partnerGone.includes("<img"));
});

test("suspended partner: presentations not available (partner dead end), staff presentations unaffected", () => {
  assert.equal(partnerPresentationAvailable({ status: "ACTIVE" }), true);
  for (const st of ["SUSPENDED", "PENDING", "REJECTED", ""]) assert.equal(partnerPresentationAvailable({ status: st }), false, st);
  assert.equal(partnerPresentationAvailable(null), false, "missing partner row");
  const page = src("app/c/[token]/page.tsx");
  assert.ok(page.includes("if (presentation.partnerId && !partnerPresentationAvailable(partnerRow)) {\n    return <PartnerNotAvailable locale={locale} />;"));
  assert.ok(page.includes("status: true, brandName: true, company: true,"));
});

test("partner preview: ?preview=1 skips view tracking for partner presentations only; the copied link stays clean", () => {
  assert.equal(PREVIEW_PARAM, "preview");
  assert.equal(presentationPreviewUrl("https://cyprusvipestates.com/c/tok"), "https://cyprusvipestates.com/c/tok?preview=1");
  assert.equal(presentationPreviewUrl("https://x.test/c/tok?a=1"), "https://x.test/c/tok?a=1&preview=1");
  assert.equal(isPreviewRequest({ preview: "1" }), true);
  assert.equal(isPreviewRequest({ preview: ["1", "0"] }), true);
  for (const sp of [{}, { preview: "0" }, { preview: "true" }, { preview: "" }, { preview: ["0", "1"] }, undefined, null]) {
    assert.equal(isPreviewRequest(sp as Record<string, string | string[] | undefined> | undefined), false, JSON.stringify(sp));
  }
  assert.equal(tracksClientViews({ partnerId: "p1", preview: true }), false);
  assert.equal(tracksClientViews({ partnerId: "p1", preview: false }), true);
  assert.equal(tracksClientViews({ partnerId: null, preview: true }), true, "staff presentation: always tracked, as before");
  assert.equal(tracksClientViews({ partnerId: null, preview: false }), true);
  const page = src("app/c/[token]/page.tsx");
  assert.ok(page.includes("const trackViews = tracksClientViews({ partnerId: presentation.partnerId, preview: isPreviewRequest(searchParams) });"));
  assert.ok(page.includes("{trackViews && <ViewTracker token={params.token} />}"));
  const body = src("app/c/[token]/PresentationBody.tsx");
  const open = body.slice(body.indexOf("const openDetails"), body.indexOf("}, [token, trackViews]);"));
  assert.ok(open.indexOf("if (!trackViews) return;") < open.indexOf("fetch(`/api/c/${token}/view`"), "overlay view POST skipped in preview");
  // Portal: "Open" carries the marker, "Copy link" (sent to the client) never does.
  const bits = src("app/partner-portal/components/presentationBits.tsx");
  assert.ok(bits.includes("href={presentationPreviewUrl(p.url)}"));
  assert.ok(bits.includes("<CopyLink value={p.url}"));
  const forms = src("app/partner-portal/components/presentationForms.tsx");
  assert.ok(forms.includes("href={presentationPreviewUrl(state.url)}"));
  assert.ok(forms.includes("<CopyLink value={state.url}"));
});

test("partner mode: overlay hides 'View on site'; share title/image carry no CVE branding", () => {
  const overlay = src("app/c/[token]/PropertyOverlay.tsx");
  assert.ok(overlay.includes('{!partnerMode && publishStatus === "published" && slug && ('));
  assert.ok(overlay.includes("partnerMode = false,"), "defaults off: staff presentations keep the link");
  const body = src("app/c/[token]/PresentationBody.tsx");
  assert.ok(body.includes("partnerMode = false, trackViews = true,"));
  assert.ok(body.includes("partnerMode={partnerMode}"));
  // Share title: localized title + brand for an ACTIVE partner, never the client; generic otherwise.
  const p = { brandName: "Sun Homes", company: null, firstName: "Anna", lastName: "Berg", status: "ACTIVE" };
  assert.equal(partnerShareTitle(PARTNER_COPY.de.metaTitle, p), "Ihre Immobilienauswahl — Sun Homes");
  assert.equal(partnerShareTitle("T", { ...p, brandName: null }), "T — Anna Berg");
  assert.equal(partnerShareTitle("T", { ...p, brandName: " ", firstName: "", lastName: "" }), "T");
  assert.equal(partnerShareTitle("T", { ...p, status: "SUSPENDED" }), "T");
  assert.equal(partnerShareTitle("T", null), "T");
  assert.ok(!PARTNER_SHARE_IMAGE.path.includes("og/presentation"), "not the CVE share image");
  const page = src("app/c/[token]/page.tsx");
  const meta = page.slice(page.indexOf("export async function generateMetadata"), page.indexOf("const DISTRICT_HERO_IMAGES"));
  const partnerMeta = meta.slice(meta.indexOf("if (row?.partnerId) {"), meta.indexOf("const title = COPY[locale].metaTitle;"));
  assert.ok(partnerMeta.includes("partnerShareTitle(PARTNER_COPY[locale].metaTitle, row.partner)"));
  assert.ok(partnerMeta.includes("PARTNER_SHARE_IMAGE.path"));
  assert.ok(!partnerMeta.includes("PRESENTATION_OG_IMAGE") && !/(?<!PARTNER_)COPY\[locale\]\.metaTitle/.test(partnerMeta));
  assert.ok(!/greetingName/.test(meta), "no per-client content in metadata");
});

test("staff (cve) presentation path is unchanged: metadata, tracker, body props", () => {
  const page = src("app/c/[token]/page.tsx");
  const meta = page.slice(page.indexOf("export async function generateMetadata"), page.indexOf("const DISTRICT_HERO_IMAGES"));
  // The cve return is exactly the pre-3e object: CVE title, CVE share image.
  const cve = meta.slice(meta.indexOf("const title = COPY[locale].metaTitle;"));
  assert.ok(cve.includes("const description = COPY[locale].metaDescription;"));
  assert.ok(cve.includes("images: [{ url: PRESENTATION_OG_IMAGE, width: 1000, height: 1000 }],"));
  assert.ok(cve.includes("robots: { index: false, follow: false },"));
  // Body gets the partner-only props by spread, so a staff presentation's client props are the same as before.
  assert.ok(page.includes('{...(branding.mode === "partner" ? { partnerMode: true, trackViews } : {})}'));
  // Partner-only gates key off partnerId (null for staff presentations).
  assert.ok(page.includes("if (presentation.partnerId && !partnerPresentationAvailable(partnerRow))"));
  assert.equal(tracksClientViews({ partnerId: null, preview: true }), true);
});

test("partner presentation copy: en/de/pl/ru written, he reuses English, no CVE name", () => {
  for (const l of P_LOCALES) {
    const c = PARTNER_COPY[l];
    for (const v of Object.values(c)) {
      assert.ok(v && !v.includes("Cyprus VIP") && !v.includes("cyprusvipestates"), `${l}: ${v}`);
    }
    assert.ok(c.presentedBy.includes("{name}"));
  }
  assert.equal(PARTNER_COPY.he, PARTNER_COPY.en);
  assert.notEqual(PARTNER_COPY.de.metaTitle, PARTNER_COPY.en.metaTitle);
  assert.ok(COPY.en.metaTitle.includes("Cyprus VIP Estates"), "CVE copy unchanged");
});

// ── Logo route decision ─────────────────────────────────────────────────────

test("logo route: only an active, unexpired partner presentation with a stored logo of an allowed type", () => {
  const now = new Date("2026-10-18T12:00:00Z");
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const ok = { status: "active", expiresAt: new Date("2026-11-01"), partnerId: "p1", partner: { status: "ACTIVE", brandLogo: png, brandLogoType: "image/png" } };
  assert.deepEqual(logoDecision(ok, now), { ok: true, bytes: png, type: "image/png" });
  assert.deepEqual(logoDecision(null, now), { ok: false });
  assert.deepEqual(logoDecision({ ...ok, status: "revoked" }, now), { ok: false });
  assert.deepEqual(logoDecision({ ...ok, status: "expired" }, now), { ok: false });
  assert.deepEqual(logoDecision({ ...ok, expiresAt: new Date("2026-10-18T11:59:59Z") }, now), { ok: false });
  assert.deepEqual(logoDecision({ ...ok, partnerId: null }, now), { ok: false });
  assert.deepEqual(logoDecision({ ...ok, partner: null }, now), { ok: false });
  assert.deepEqual(logoDecision({ ...ok, partner: { status: "ACTIVE", brandLogo: null, brandLogoType: "image/png" } }, now), { ok: false });
  assert.deepEqual(logoDecision({ ...ok, partner: { status: "ACTIVE", brandLogo: new Uint8Array(), brandLogoType: "image/png" } }, now), { ok: false });
  assert.deepEqual(logoDecision({ ...ok, partner: { status: "ACTIVE", brandLogo: png, brandLogoType: "image/svg+xml" } }, now), { ok: false });
  // Suspended (or any non-ACTIVE) partner: 404.
  for (const st of ["SUSPENDED", "PENDING", "REJECTED"]) {
    assert.deepEqual(logoDecision({ ...ok, partner: { ...ok.partner, status: st } }, now), { ok: false }, st);
  }
  assert.deepEqual(LOGO_HEADERS, { "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" });
  const route = src("app/c/[token]/logo/route.ts");
  assert.ok(route.includes('headers: { "Content-Type": d.type, ...LOGO_HEADERS }'));
  assert.ok(route.includes("partner: { select: { status: true, brandLogo: true, brandLogoType: true } }"));
});

test("logo upload check: magic bytes decide, size capped, the claimed MIME type is never used", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  assert.deepEqual(checkBrandLogo(png), { ok: true, type: "image/png" });
  assert.deepEqual(checkBrandLogo(new Uint8Array()), { ok: false, code: "err.logoType" });
  assert.deepEqual(checkBrandLogo(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>")), { ok: false, code: "err.logoType" });
  const big = new Uint8Array(BRAND_LOGO_MAX_BYTES + 1);
  big.set(png);
  assert.deepEqual(checkBrandLogo(big), { ok: false, code: "err.logoSize" });
  const actions = src("app/partner-portal/brandActions.ts");
  assert.ok(!actions.includes("file.type"), "never trusts the browser's MIME type");
  assert.ok(actions.includes("brandLogo: Buffer.from(bytes), brandLogoType: check.type, brandLogoUpdatedAt: new Date()"));
  assert.ok(actions.includes("data: { brandLogo: null, brandLogoType: null, brandLogoUpdatedAt: new Date() }"));
  assert.equal((actions.match(/= await requirePartner\(\{ active: true \}\)/g) ?? []).length, 3);
  assert.equal((actions.match(/L\.brand\.hit\(me\.partner\.id\)/g) ?? []).length, 3);
  assert.ok(!actions.includes("@/auth"));
});

// ── PRESENTATION_OPENED producer ────────────────────────────────────────────

const pres = { id: "pr1", leadId: "l1", partnerId: "p1", greetingName: "Bob" };

test("outbox producer: first page-level view of a partner presentation only", () => {
  assert.deepEqual(presentationOpenedRow({ presentation: pres, developmentId: null, priorPageVisits: 0, claimName: "Bob Miller" }), {
    kind: "PRESENTATION_OPENED", refKey: "presopen:pr1", partnerId: "p1", leadId: "l1", payload: { clientName: "Bob Miller" },
  });
  // Fallback to the greeting name when no claim name is found.
  assert.equal(presentationOpenedRow({ presentation: pres, developmentId: null, priorPageVisits: 0, claimName: " " })?.payload.clientName, "Bob");
  // Not the first page view, a property overlay view, or a CVE presentation → nothing.
  assert.equal(presentationOpenedRow({ presentation: pres, developmentId: null, priorPageVisits: 1, claimName: "Bob" }), null);
  assert.equal(presentationOpenedRow({ presentation: pres, developmentId: "d1", priorPageVisits: 0, claimName: "Bob" }), null);
  assert.equal(presentationOpenedRow({ presentation: { ...pres, partnerId: null }, developmentId: null, priorPageVisits: 0, claimName: "Bob" }), null);
});

test("view route: outbox insert idempotent, office alert prefixed for partner presentations only", () => {
  assert.equal(officeAlertPrefix(null), "");
  assert.equal(officeAlertPrefix("Sun &amp; Sea"), "Partner presentation (Sun &amp; Sea) — ");
  const route = src("app/api/c/[token]/view/route.ts");
  assert.ok(route.includes("await prisma.partnerNotification.createMany({ data: [row], skipDuplicates: true });"));
  assert.ok(route.includes('let officePrefix = "";\n  if (presentation.partnerId) {'));
  assert.ok(route.includes("officeAlertPrefix(escapeHtml("));
  assert.ok(route.includes("await sendTelegramMessage(`${officePrefix}👀 ${name} opened their personal page — <a href=\"${crmLink}\">CRM</a>`);"));
  assert.ok(route.includes("await sendTelegramMessage(`${officePrefix}🔁 ${name} is back on their page (visit #${visitNumber})`);"));
});

// ── Create glue ─────────────────────────────────────────────────────────────

const NOW = new Date("2026-10-18T12:00:00Z");
const claimRow = (id: string, over: Partial<PresentationClaimRow> = {}): PresentationClaimRow => ({
  id, leadId: `lead-${id}`, state: "ACTIVE", createdAt: new Date("2026-09-01"), reviewedAt: null,
  submission: { firstName: `First${id}`, lastName: "Last", language: "de" }, lead: { status: "NEW", deletedAt: null }, ...over,
});

test("allowed clients follow the effective claim rule (trashed lead, expired protection, non-ACTIVE excluded)", () => {
  const rows = [
    claimRow("a"),
    claimRow("b", { lead: { status: "NEW", deletedAt: new Date() } }),
    claimRow("c", { createdAt: new Date("2025-01-01") }), // protection run out, nothing committed
    claimRow("d", { createdAt: new Date("2025-01-01") }), // old but committed by a live deal
    claimRow("e", { state: "IN_REVIEW" }),
    claimRow("f", { createdAt: new Date("2025-01-01") }), // old but a recent real contact
  ];
  const clients = effectiveActiveClients(rows, {
    liveDealLeads: new Set(["lead-d"]), lastContact: new Map([["lead-f", new Date("2026-10-01")]]), now: NOW,
  });
  assert.deepEqual(clients.map((c) => c.claimId), ["a", "d", "f"]);
  assert.deepEqual(clients[0], { claimId: "a", leadId: "lead-a", name: "Firsta Last", firstName: "Firsta", language: "de" });
});

test("create glue: server-built allowed sets reject foreign claims/projects; rows in selection order", () => {
  const clients = effectiveActiveClients([claimRow("a")], { liveDealLeads: new Set(), lastContact: new Map(), now: NOW });
  const sets = allowedPresentationSets(clients, [{ id: "d1" }, { id: "d2" }, { id: "d3" }]);
  const form = new FormData();
  form.set("claimId", "a");
  for (const id of ["d3", "d1"]) form.append("projectIds", id);
  form.set("greetingName", "Firsta");
  form.set("personalNote", "Hello");
  form.set("locale", "de");
  const v = validatePresentationDraft(draftFromForm(form), sets);
  assert.ok(v.ok);
  if (!v.ok) return;
  assert.deepEqual(v.data.projectIds, ["d3", "d1"]);

  const foreignClaim = new FormData();
  foreignClaim.set("claimId", "someone-elses");
  foreignClaim.append("projectIds", "d1");
  foreignClaim.set("greetingName", "X");
  foreignClaim.set("locale", "en");
  assert.deepEqual(validatePresentationDraft(draftFromForm(foreignClaim), sets), { ok: false, field: "claimId", code: "err.presentationClient" });
  const foreignProject = new FormData();
  foreignProject.set("claimId", "a");
  foreignProject.append("projectIds", "unpublished");
  foreignProject.set("greetingName", "X");
  foreignProject.set("locale", "en");
  assert.deepEqual(validatePresentationDraft(draftFromForm(foreignProject), sets), { ok: false, field: "projectIds", code: "err.presentationProjects" });

  const built = buildPresentationCreate({ draft: v.data, leadId: "lead-a", lead: { budgetMin: null, budgetMax: 400000 }, partnerId: "p1", token: "tok123456789", now: NOW });
  assert.deepEqual(built.presentation, {
    leadId: "lead-a", partnerId: "p1", advisorId: null, token: "tok123456789", locale: "de", greetingName: "Firsta", personalNote: "Hello",
    criteria: { budgetMax: 400000 }, status: "active", expiresAt: new Date("2026-11-17T12:00:00Z"),
  });
  assert.deepEqual(built.items, [{ developmentId: "d3", sortIndex: 0 }, { developmentId: "d1", sortIndex: 1 }]);
  const noNote = buildPresentationCreate({ draft: { ...v.data, personalNote: "" }, leadId: "l", lead: { budgetMin: 1, budgetMax: null }, partnerId: "p", token: "t", now: NOW });
  assert.equal(noNote.presentation.personalNote, null);
  assert.deepEqual(noNote.presentation.criteria, { budgetMin: 1 });

  const actions = src("app/partner-portal/presentationActions.ts");
  assert.ok(actions.includes("const [clients, mine] = await Promise.all([myPresentationClients(me.partner.id, now), myProjects(me.partner.id)]);"));
  assert.ok(actions.includes("validatePresentationDraft(draftFromForm(fd), allowedPresentationSets(clients, mine.projects))"));
  assert.ok(actions.includes('where: { id: client.claimId, partnerId: me.partner.id, leadId: client.leadId, state: "ACTIVE" }'));
  assert.ok(actions.includes('where: { id, partnerId: me.partner.id, status: { not: "revoked" } },'));
  assert.equal((actions.match(/L\.presentation\.hit\(me\.partner\.id\)/g) ?? []).length, 2);
});

test("defaults, status and stats helpers", () => {
  assert.equal(defaultPresentationLocale("ru", "en"), "ru");
  assert.equal(defaultPresentationLocale("he", "de"), "de");
  assert.equal(defaultPresentationLocale(null, "pl"), "pl");
  assert.equal(presentationUrl("abc"), "https://cyprusvipestates.com/c/abc");
  assert.equal(presentationStatusOf({ status: "revoked", expiresAt: null }, NOW), "revoked");
  assert.equal(presentationStatusOf({ status: "active", expiresAt: new Date("2026-10-01") }, NOW), "expired");
  assert.equal(presentationStatusOf({ status: "expired", expiresAt: null }, NOW), "expired");
  assert.equal(presentationStatusOf({ status: "active", expiresAt: new Date("2026-11-01") }, NOW), "active");
  const last = new Date("2026-10-17");
  const m = mergePresentationStats(["x", "y"], [{ presentationId: "x", count: 3, last }, { presentationId: "zz", count: 9, last }], [{ presentationId: "y", count: 2 }]);
  assert.deepEqual(m.get("x"), { views: 3, lastOpenedAt: last, favorites: 0 });
  assert.deepEqual(m.get("y"), { views: 0, lastOpenedAt: null, favorites: 2 });
  assert.equal(m.has("zz"), false);
});

test("scope: presentations are this partner's only; client activity only while the claim is effectively ACTIVE", () => {
  const scope = src("lib/partner/scope.ts");
  assert.ok(scope.includes("where: { partnerId, ...(opts.leadId ? { leadId: opts.leadId } : {}) },"));
  assert.ok(scope.includes("stats: client ? stats.get(r.id) ?? null : null,"));
  assert.ok(scope.includes("if (!clients.some((c) => c.claimId === claimId)) return [];"));
});

// ── Onboarding ──────────────────────────────────────────────────────────────

test("onboarding: 'First presentation sent' is optional (like Telegram), counts once given, links to /presentations", () => {
  const base = { status: "ACTIVE", hasAcceptance: true, bankComplete: true, hasClaim: true };
  assert.equal(onboardingSteps(onboardingFactsFrom(base)).steps.some((s) => s.key === "presentation"), false);
  const open = onboardingSteps(onboardingFactsFrom({ ...base, hasPresentation: false }));
  assert.equal(open.steps.find((s) => s.key === "presentation")?.optional, true, "listed, but optional");
  assert.equal(open.total, 4, "an open optional step does not grow the total");
  assert.equal(open.done, 4);
  assert.equal(open.complete, true, "never blocks completion");
  const given = onboardingSteps(onboardingFactsFrom({ ...base, hasPresentation: true }));
  assert.equal(given.total, 5);
  assert.equal(given.done, 5);
  assert.equal(given.complete, true);
  // Required steps still block: with an open bank step the card stays incomplete regardless of the presentation.
  assert.equal(onboardingSteps(onboardingFactsFrom({ ...base, bankComplete: false, hasPresentation: true })).complete, false);
  assert.equal(onboardingHref("presentation"), "/presentations");
});
