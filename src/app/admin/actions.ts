"use server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth, signOut } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { htmlToPortableText } from "@/lib/portableText/htmlToPt.mjs";
import { isHtmlMarker } from "@/lib/portableText/richText";
import { zonedInputToUtc } from "@/lib/tz";
import { localizedHref } from "@/lib/locale";
import { deepSetString } from "@/lib/homepageFields";

// Convert every `{__html}` rich-text marker (produced by the block editor) into
// Portable Text via the shared converter — so all blocks store consistent PT and
// nothing hand-builds it. Recursive, position-independent.
function convertHtmlMarkers(node: any): any {
  if (isHtmlMarker(node)) return htmlToPortableText(node.__html);
  if (Array.isArray(node)) return node.map(convertHtmlMarkers);
  if (node && typeof node === "object") {
    const o: any = {};
    for (const [key, v] of Object.entries(node)) o[key] = convertHtmlMarkers(v);
    return o;
  }
  return node;
}

const LOCALES = ["en", "de", "pl", "ru"];

// Resolve the scheduledAt column from the editor form. Only meaningful when the
// status is SCHEDULED (the naive datetime is read as Europe/Berlin → UTC); any
// other status clears it. Throws if SCHEDULED is chosen without a valid time.
function scheduledAtFromForm(formData: FormData, status: string): Date | null {
  if (status !== "SCHEDULED") return null;
  const when = zonedInputToUtc(String(formData.get("scheduledAt") ?? ""));
  if (!when) throw new Error("A publish date/time is required when status is Scheduled.");
  return when;
}
function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}

// Resolve the slug from the editor form. The slug is editable for every document
// (the admin manages localized slugs for translations); the submitted value is
// slugified and made unique per language (excluding self). An empty submission
// leaves the slug unchanged, so a missing field can never wipe a stored slug.
async function slugFromForm(
  model: any,
  id: string,
  formData: FormData,
): Promise<{ slug?: string }> {
  const raw = formData.get("slug");
  if (raw == null) return {}; // field absent → don't touch the slug
  const desired = slugify(String(raw));
  if (!desired) return {}; // empty/whitespace → keep existing slug
  const cur = await model.findUnique({ where: { id }, select: { language: true } });
  if (!cur) return {};
  let slug = desired;
  let n = 2;
  while (await model.findFirst({ where: { language: cur.language, slug, NOT: { id } }, select: { id: true } })) {
    slug = `${desired}-${n++}`;
  }
  return { slug };
}

// Stamp publishedAt the first time a document transitions into PUBLISHED, so
// drafts/translations published manually from the editor get a real publish date
// (mirrors the scheduled-publish cron). No-op for already-published docs.
async function publishedAtOnPublish(
  model: any,
  id: string,
  newStatus: string,
): Promise<{ publishedAt?: Date }> {
  if (newStatus !== "PUBLISHED") return {};
  const cur = await model.findUnique({ where: { id }, select: { publishedAt: true } });
  return cur && !cur.publishedAt ? { publishedAt: new Date() } : {};
}
// Parse a hidden-input JSON field; "" → null. Prisma Json? requires DbNull (not JS null) for SQL NULL.
function parseJsonField(v: FormDataEntryValue | null): any {
  const s = String(v ?? "").trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}
const jsonOrDbNull = (v: any) => (v == null ? Prisma.DbNull : v);
const floatOrNull = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim(); return s === "" ? null : Number(s); };

// Invalidate the PUBLIC (frontend) ISR cache after a content change, so edits/publishes appear
// immediately instead of waiting for the revalidate window. English is served prefix-less
// (`/blog/x`) but Next's internal route still carries the `[lang]` segment (`/en/blog/x`), so we
// revalidate BOTH the prefixed internal route and the clean public path (no-op when identical).
function revalPublic(language: string, segments: string[] = []) {
  const internal = `/${language}${segments.length ? "/" + segments.join("/") : ""}`;
  revalidatePath(internal);
  const clean = localizedHref(language, segments);
  if (clean !== internal) revalidatePath(clean);
}
function revalidateProjectPublic(language: string, slug: string) {
  revalPublic(language, ["projects", slug]);
  revalPublic(language, ["projects"]);
  revalPublic(language, []);
}
function revalidateBlogPublic(language: string, slug: string) {
  revalPublic(language, ["blog", slug]);
  revalPublic(language, ["blog"]);
}
function revalidateSinglepagePublic(language: string, slug: string) {
  revalPublic(language, [slug]);
}
function revalidateCaseStudyPublic(language: string, slug: string) {
  revalPublic(language, ["case-studies", slug]);
  revalPublic(language, ["case-studies"]);
}

const STATUSES = ["NEW", "QUALIFIED", "CONTACTED", "VIEWING_SCHEDULED", "OFFER", "CLOSED", "LOST"];
const CONTENT_STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"];

async function requireSession() {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) throw new Error("Unauthorized");
  // Re-validate against the DB so a deactivated/deleted user can't keep acting
  // for the remainder of their JWT lifetime (audit M3).
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!user || !user.isActive) throw new Error("Unauthorized");
  return session;
}
async function requireAdmin() {
  const session = await requireSession();
  if ((session.user as any)?.role !== "ADMIN") throw new Error("Forbidden");
  return session;
}

// ── Account: change own password ──
export async function changePassword(_prev: any, formData: FormData) {
  const session = await requireSession();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next.length < 12) return { error: "New password must be at least 12 characters." };
  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } });
  if (!user) return { error: "User not found." };
  if (!(await bcrypt.compare(current, user.password))) return { error: "Current password is incorrect." };
  await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(next, 10) } });
  return { ok: "Password updated." };
}

// ── Users (ADMIN) ──
export async function createUser(_prev: any, formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "EDITOR");
  const password = String(formData.get("password") ?? "");
  if (!email || !name) return { error: "Name and email are required." };
  if (password.length < 12) return { error: "Password must be at least 12 characters." };
  if (!["ADMIN", "EDITOR"].includes(role)) return { error: "Invalid role." };
  if (await prisma.user.findUnique({ where: { email } })) return { error: "Email already exists." };
  await prisma.user.create({ data: { email, name, role: role as any, password: await bcrypt.hash(password, 10) } });
  revalidatePath("/admin/users");
  return { ok: `User ${email} created.` };
}

export async function toggleUserActive(id: string) {
  const session = await requireAdmin();
  if ((session.user as any).id === id) throw new Error("You cannot deactivate yourself.");
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) throw new Error("Not found");
  await prisma.user.update({ where: { id }, data: { isActive: !u.isActive } });
  revalidatePath("/admin/users");
}

// Hard-delete a user. Guards against self-removal and removing the last admin.
// Unassigns their leads and nulls their uploaded media first; sessions cascade.
export async function deleteUser(id: string) {
  const session = await requireAdmin();
  if ((session.user as any).id === id) throw new Error("You cannot remove your own account.");
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) throw new Error("Not found");
  if (u.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) throw new Error("Cannot remove the last admin.");
  }
  await prisma.$transaction([
    prisma.lead.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } }),
    prisma.media.updateMany({ where: { uploadedById: id }, data: { uploadedById: null } }),
    prisma.user.delete({ where: { id } }),
  ]);
  revalidatePath("/admin/users");
}

// Admin sets/resets another user's password directly (no email round-trip).
export async function adminSetPassword(id: string, _prev: any, formData: FormData): Promise<{ ok?: string; error?: string }> {
  await requireAdmin();
  const next = String(formData.get("password") ?? "");
  if (next.length < 12) return { error: "Password must be at least 12 characters." };
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return { error: "User not found." };
  await prisma.user.update({ where: { id }, data: { password: await bcrypt.hash(next, 10) } });
  revalidatePath("/admin/users");
  return { ok: `Password updated for ${u.email}.` };
}

// ── Self-service password reset (forgot-password flow) ──
const resetMailer = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.hostinger.com",
  port: Number(process.env.EMAIL_PORT || 465),
  secure: String(process.env.EMAIL_SECURE || "true") === "true",
  auth: { user: process.env.EMAIL_USER!, pass: process.env.EMAIL_PASSWORD! },
});
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

// Base URL for the reset link. The Host header is attacker-controllable, so a
// reset link must NEVER be built from it unvalidated (reset poisoning → token
// theft). We allow only known hosts (covers staging IP + production domain) and
// fall back to the canonical domain for anything else; protocol is derived from
// the validated host, not from a spoofable X-Forwarded-Proto.
const RESET_HOSTS = new Set([
  "cyprusvipestates.com",
  "www.cyprusvipestates.com",
  "72.60.89.239",
]);
function requestBaseUrl(): string {
  const raw = (headers().get("host") ?? "").toLowerCase();
  const host = RESET_HOSTS.has(raw) ? raw : "cyprusvipestates.com";
  const proto = host === "72.60.89.239" ? "http" : "https";
  return `${proto}://${host}`;
}

// Step 1: request a reset link. Enumeration-safe — always returns the same message.
export async function requestPasswordReset(_prev: any, formData: FormData): Promise<{ ok?: string; error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const generic = { ok: "If that email is registered, a reset link has been sent." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.isActive) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });
    const link = `${requestBaseUrl()}/admin/reset?token=${token}`;
    try {
      await resetMailer.sendMail({
        from: `Cyprus VIP Estates <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "Reset your admin password",
        text: `Reset your Cyprus VIP Estates admin password:\n\n${link}\n\nThis link expires in 1 hour and can be used once. If you did not request this, ignore this email.`,
      });
    } catch {
      // Don't leak delivery failures to the client; the generic message stands.
    }
  }
  return generic;
}

// Step 2: complete the reset with a valid, unexpired, unused token.
export async function resetPasswordWithToken(_prev: any, formData: FormData): Promise<{ ok?: string; error?: string }> {
  const token = String(formData.get("token") ?? "");
  const next = String(formData.get("password") ?? "");
  if (next.length < 12) return { error: "Password must be at least 12 characters." };
  if (!token) return { error: "Invalid or missing reset token." };

  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { password: await bcrypt.hash(next, 10) } }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    // invalidate any other outstanding tokens for this user
    prisma.passwordResetToken.deleteMany({ where: { userId: row.userId, usedAt: null } }),
  ]);
  return { ok: "Password updated. You can now sign in." };
}

// ── Content meta editing (slug intentionally NOT editable — URL preservation) ──
export async function updateProjectMeta(id: string, formData: FormData) {
  await requireSession();
  const status = String(formData.get("status") ?? "PUBLISHED");
  if (!CONTENT_STATUSES.includes(status)) throw new Error("Invalid status");
  const num = (k: string) => { const v = String(formData.get(k) ?? "").trim(); return v === "" ? null : Math.round(Number(v)); };
  const patch = { ...(await slugFromForm(prisma.project, id, formData)), ...(await publishedAtOnPublish(prisma.project, id, status)) };
  const row = await prisma.project.update({
    where: { id },
    data: {
      ...patch,
      title: String(formData.get("title") ?? "").trim(),
      excerpt: String(formData.get("excerpt") ?? "").trim() || null,
      status: status as any,
      scheduledAt: scheduledAtFromForm(formData, status),
      isFeatured: formData.get("isFeatured") === "on",
      isNew: formData.get("isNew") === "on",
      isSold: formData.get("isSold") === "on",
      listingPriority: num("listingPriority") ?? 0,
      price: num("price"),
      city: String(formData.get("city") ?? "").trim() || null,
      propertyType: String(formData.get("propertyType") ?? "").trim() || null,
      previewImage: jsonOrDbNull(parseJsonField(formData.get("previewImage"))),
      images: jsonOrDbNull(parseJsonField(formData.get("images"))),
      latitude: floatOrNull(formData.get("latitude")),
      longitude: floatOrNull(formData.get("longitude")),
      seo: {
        metaTitle: String(formData.get("seoTitle") ?? "").trim(),
        metaDescription: String(formData.get("seoDescription") ?? "").trim(),
      },
    },
  });
  revalidatePath(`/admin/content/projects/${id}`);
  revalidatePath("/admin/content/projects");
  revalidateProjectPublic(row.language, row.slug);
}

export async function updateBlogMeta(id: string, formData: FormData) {
  await requireSession();
  const status = String(formData.get("status") ?? "PUBLISHED");
  if (!CONTENT_STATUSES.includes(status)) throw new Error("Invalid status");
  // Editable publication date (Berlin wall-time → UTC). An explicit value wins;
  // otherwise keep the auto-set-on-first-publish behaviour.
  const explicitPublishedAt = zonedInputToUtc(String(formData.get("publishedAt") ?? ""));
  const patch = {
    ...(await slugFromForm(prisma.blog, id, formData)),
    ...(explicitPublishedAt ? { publishedAt: explicitPublishedAt } : await publishedAtOnPublish(prisma.blog, id, status)),
  };
  const row = await prisma.blog.update({
    where: { id },
    data: {
      ...patch,
      title: String(formData.get("title") ?? "").trim(),
      excerpt: String(formData.get("excerpt") ?? "").trim() || null,
      status: status as any,
      scheduledAt: scheduledAtFromForm(formData, status),
      previewImage: jsonOrDbNull(parseJsonField(formData.get("previewImage"))),
      authorId: String(formData.get("authorId") ?? "").trim() || null,
      categoryId: String(formData.get("categoryId") ?? "").trim() || null,
      seo: {
        metaTitle: String(formData.get("seoTitle") ?? "").trim(),
        metaDescription: String(formData.get("seoDescription") ?? "").trim(),
      },
    },
  });
  revalidatePath(`/admin/content/blog/${id}`);
  revalidatePath("/admin/content/blog");
  revalidateBlogPublic(row.language, row.slug);
}

export async function updateLeadStatus(id: string, status: string, reason?: string) {
  const session = await requireSession();
  if (!STATUSES.includes(status)) throw new Error("Invalid status");
  const r = String(reason ?? "").trim().slice(0, 500);
  await prisma.lead.update({ where: { id }, data: { status: status as any } });
  await prisma.leadActivity.create({
    data: {
      leadId: id,
      type: "STATUS_CHANGE",
      content: `Status changed to ${status.replace(/_/g, " ")}${r ? ` — ${r}` : ""}`,
      createdBy: session.user?.name ?? "admin",
      createdById: (session.user as any)?.id ?? null,
    },
  });
  revalidatePath(`/admin/crm/${id}`);
  revalidatePath("/admin/crm");
  revalidatePath("/admin");
}

export async function addLeadNote(id: string, note: string) {
  const session = await requireSession();
  const content = note.trim();
  if (!content) return;
  await prisma.leadActivity.create({
    data: { leadId: id, type: "NOTE", content, createdBy: session.user?.name ?? "admin", createdById: (session.user as any)?.id ?? null },
  });
  revalidatePath(`/admin/crm/${id}`);
}

// Assign a lead to a team member (or unassign with an empty value).
export async function assignLead(id: string, userId: string) {
  const session = await requireSession();
  const assignedToId = userId || null;
  let label = "Unassigned";
  if (assignedToId) {
    const u = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { name: true, isActive: true },
    });
    if (!u || !u.isActive) throw new Error("Invalid user");
    label = u.name;
  }
  await prisma.lead.update({ where: { id }, data: { assignedToId } });
  await prisma.leadActivity.create({
    data: {
      leadId: id,
      type: "ASSIGNMENT",
      content: assignedToId ? `Assigned to ${label}` : "Unassigned",
      createdBy: session.user?.name ?? "admin",
      createdById: (session.user as any)?.id ?? null,
    },
  });
  revalidatePath(`/admin/crm/${id}`);
  revalidatePath("/admin/crm");
  revalidatePath("/admin");
}

// Manually create a lead from the admin (same data shape + validation as the
// public lead API). Marked with source = MANUAL.
const LEAD_TIMELINES = ["IMMEDIATE", "THREE_MONTHS", "SIX_MONTHS", "ONE_YEAR", "JUST_LOOKING"];
const LEAD_FINANCING = ["CASH", "MORTGAGE", "UNDECIDED"];
const LEAD_PROP_TYPES = ["Apartment", "Villa", "Townhouse", "Penthouse"];

export async function createLead(_prev: any, formData: FormData): Promise<{ error?: string }> {
  const session = await requireSession();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!firstName) return { error: "First name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "A valid email is required." };

  const num = (k: string) => { const v = String(formData.get(k) ?? "").trim(); return v === "" ? null : Math.round(Number(v)); };
  const oneOf = (k: string, allowed: string[]) => { const v = String(formData.get(k) ?? "").trim(); return allowed.includes(v) ? v : null; };
  const assignedToId = String(formData.get("assignedToId") ?? "").trim() || null;
  if (assignedToId) {
    const valid = await prisma.user.findFirst({ where: { id: assignedToId, isActive: true }, select: { id: true } });
    if (!valid) return { error: "Invalid assignee." };
  }

  const lead = await prisma.lead.create({
    data: {
      firstName,
      lastName: lastName || "",
      email,
      phone: phone || null,
      nationality: String(formData.get("nationality") ?? "").trim() || null,
      languagePreference: oneOf("languagePreference", LOCALES) as any,
      budgetMin: num("budgetMin"),
      budgetMax: num("budgetMax"),
      timeline: oneOf("timeline", LEAD_TIMELINES) as any,
      financing: oneOf("financing", LEAD_FINANCING) as any,
      propertyTypeInterest: formData.getAll("propertyTypeInterest").map(String).filter((t) => LEAD_PROP_TYPES.includes(t)),
      message: String(formData.get("message") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      source: "MANUAL",
      status: (oneOf("status", STATUSES) ?? "NEW") as any,
      assignedToId,
    },
  });
  await prisma.leadActivity.create({
    data: { leadId: lead.id, type: "CREATED", content: "Lead created manually", createdBy: session.user?.name ?? "admin", createdById: (session.user as any)?.id ?? null },
  });
  revalidatePath("/admin/crm");
  revalidatePath("/admin");
  redirect(`/admin/crm/${lead.id}`);
}

// Edit an existing lead's contact + qualification fields (audit H4). Status, source
// and assignment are managed by their own controls and are intentionally untouched here.
export async function updateLead(id: string, _prev: any, formData: FormData): Promise<{ error?: string }> {
  const session = await requireSession();
  const existing = await prisma.lead.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { error: "Lead not found." };

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!firstName) return { error: "First name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "A valid email is required." };

  const num = (k: string) => { const v = String(formData.get(k) ?? "").trim(); return v === "" ? null : Math.round(Number(v)); };
  const oneOf = (k: string, allowed: string[]) => { const v = String(formData.get(k) ?? "").trim(); return allowed.includes(v) ? v : null; };

  await prisma.lead.update({
    where: { id },
    data: {
      firstName,
      lastName: lastName || "",
      email,
      phone: phone || null,
      nationality: String(formData.get("nationality") ?? "").trim() || null,
      languagePreference: oneOf("languagePreference", LOCALES) as any,
      budgetMin: num("budgetMin"),
      budgetMax: num("budgetMax"),
      timeline: oneOf("timeline", LEAD_TIMELINES) as any,
      financing: oneOf("financing", LEAD_FINANCING) as any,
      propertyTypeInterest: formData.getAll("propertyTypeInterest").map(String).filter((t) => LEAD_PROP_TYPES.includes(t)),
      message: String(formData.get("message") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });
  await prisma.leadActivity.create({
    data: { leadId: id, type: "EDIT", content: "Lead details edited", createdBy: session.user?.name ?? "admin", createdById: (session.user as any)?.id ?? null },
  });
  revalidatePath(`/admin/crm/${id}`);
  revalidatePath("/admin/crm");
  redirect(`/admin/crm/${id}`);
}

// Merge a duplicate lead into a target (audit H2): move the source's activities to the
// target, record a MERGE note, then delete the source.
export async function mergeLeads(targetId: string, sourceId: string) {
  const session = await requireSession();
  if (!targetId || !sourceId || targetId === sourceId) throw new Error("Invalid merge");
  const [target, source] = await Promise.all([
    prisma.lead.findUnique({ where: { id: targetId }, select: { id: true } }),
    prisma.lead.findUnique({ where: { id: sourceId } }),
  ]);
  if (!target || !source) throw new Error("Lead not found");
  const summary = `Merged duplicate: ${source.firstName} ${source.lastName} <${source.email}> · ${source.source.replace(/_/g, " ")} · ${source.createdAt.toISOString().slice(0, 10)}`;
  await prisma.$transaction([
    prisma.leadActivity.updateMany({ where: { leadId: sourceId }, data: { leadId: targetId } }),
    prisma.leadActivity.create({
      data: { leadId: targetId, type: "MERGE", content: summary, createdBy: session.user?.name ?? "admin", createdById: (session.user as any)?.id ?? null },
    }),
    prisma.lead.delete({ where: { id: sourceId } }),
  ]);
  revalidatePath(`/admin/crm/${targetId}`);
  revalidatePath("/admin/crm");
}

// Homepage "Featured Projects" slider — per-language curated list stored on the homepage
// siteDocument as featuredProjectsBlock.projects[] ({_key,_ref,_type:"projectRef"}). The
// front end reads this exact shape via resolveProjectRefs (matches _ref → project.sanityId,
// order-preserving). This action rewrites the ordered list from the admin editor.
export async function updateHomepageFeatured(lang: string, formData: FormData) {
  const session = await requireSession();
  if (!LOCALES.includes(lang)) throw new Error("Invalid language");
  const ids = String(formData.get("projectIds") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "homepage", language: lang as any } } });
  if (!row) throw new Error("Homepage document not found for this language");

  // Keep only ids that are real projects in THIS language, preserving the submitted order + dropping dups.
  const valid = await prisma.project.findMany({ where: { language: lang as any, sanityId: { in: ids } }, select: { sanityId: true } });
  const validSet = new Set(valid.map((v) => v.sanityId));
  const seen = new Set<string>();
  const ordered = ids.filter((id) => validSet.has(id) && !seen.has(id) && (seen.add(id), true));

  const data = (row.data as any) ?? {};
  const fpb = { ...(data.featuredProjectsBlock ?? {}) };
  fpb.projects = ordered.map((id) => ({ _key: crypto.randomUUID().replace(/-/g, "").slice(0, 12), _ref: id, _type: "projectRef" }));

  await prisma.siteDocument.update({ where: { id: row.id }, data: { data: { ...data, featuredProjectsBlock: fpb } } });
  void session;
  revalidatePath("/", "layout"); // homepage (all locales)
  revalidatePath("/admin/content/featured");
}

// Homepage "Featured Case Studies" — same ref pattern as featured projects, but caseStudyRef.
export async function updateHomepageFeaturedCaseStudies(lang: string, formData: FormData) {
  await requireSession();
  if (!LOCALES.includes(lang)) throw new Error("Invalid language");
  const ids = String(formData.get("caseStudyIds") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "homepage", language: lang as any } } });
  if (!row) throw new Error("Homepage document not found for this language");
  const valid = await prisma.caseStudy.findMany({ where: { language: lang as any, sanityId: { in: ids } }, select: { sanityId: true } });
  const validSet = new Set(valid.map((v) => v.sanityId));
  const seen = new Set<string>();
  const ordered = ids.filter((id) => validSet.has(id) && !seen.has(id) && (seen.add(id), true));
  const data = (row.data as any) ?? {};
  const fcb = { ...(data.featuredCaseStudiesBlock ?? {}) };
  fcb.caseStudies = ordered.map((id) => ({ _key: crypto.randomUUID().replace(/-/g, "").slice(0, 12), _ref: id, _type: "caseStudyRef" }));
  await prisma.siteDocument.update({ where: { id: row.id }, data: { data: { ...data, featuredCaseStudiesBlock: fcb } } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/content/featured");
}

// Phase 2 — curated "Related Landing Pages" on a singlepage. Stores refs to OTHER
// same-language PUBLISHED singlepages (enforced here, not just in the picker): cross-language,
// unpublished, empty-slug, and self refs are dropped. Order is preserved; duplicates removed.
export async function saveRelatedLandingPages(id: string, formData: FormData) {
  await requireSession();
  const page = await prisma.singlepage.findUnique({ where: { id }, select: { language: true, slug: true, sanityId: true } });
  if (!page) throw new Error("Page not found");
  const ids = String(formData.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  // Keep only real, PUBLISHED singlepages in THIS language (never cross-language), excluding self.
  const valid = await prisma.singlepage.findMany({
    where: { language: page.language, status: "PUBLISHED", slug: { not: "" }, sanityId: { in: ids } },
    select: { sanityId: true },
  });
  const validSet = new Set(valid.map((v) => v.sanityId));
  const seen = new Set<string>();
  const ordered = ids.filter((x) => x !== page.sanityId && validSet.has(x) && !seen.has(x) && (seen.add(x), true));
  const refs = ordered.map((x) => ({ _key: crypto.randomUUID().replace(/-/g, "").slice(0, 12), _ref: x, _type: "singlepageRef" }));
  await prisma.singlepage.update({ where: { id }, data: { relatedLandingPages: refs as any } });
  revalidateSinglepagePublic(page.language, page.slug);
  revalidatePath(`/admin/content/pages/${id}`);
}

// Homepage text fields — generic string-leaf editor (SEO, hero, all block titles/descriptions/
// labels/slide texts). Only overwrites existing string leaves; structure/media/rich-text preserved.
export async function updateHomepageFields(lang: string, formData: FormData) {
  await requireSession();
  if (!LOCALES.includes(lang)) throw new Error("Invalid language");
  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "homepage", language: lang as any } } });
  if (!row) throw new Error("Homepage document not found for this language");
  const data = JSON.parse(JSON.stringify(row.data ?? {}));
  formData.forEach((v, k) => {
    if (k.startsWith("f::")) deepSetString(data, k.slice(3), String(v));
  });
  await prisma.siteDocument.update({ where: { id: row.id }, data: { data } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/content/featured");
}

// Faithful homepage editor save. Receives the full homepage document (edited) as JSON, overlays
// its top-level keys onto a fresh copy of the stored document (so fields the editor doesn't expose
// — e.g. slug/language — are preserved, never stripped), converts any {__html} rich-text markers
// to Portable Text, and writes it back. Sanity/production is never touched.
export async function saveHomepage(lang: string, formData: FormData) {
  await requireSession();
  if (!LOCALES.includes(lang)) throw new Error("Invalid language");
  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "homepage", language: lang as any } } });
  if (!row) throw new Error("Homepage document not found for this language");
  let incoming: any;
  try { incoming = JSON.parse(String(formData.get("doc") ?? "{}")); } catch { throw new Error("Invalid homepage payload"); }
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) throw new Error("Invalid homepage payload");
  const fresh = JSON.parse(JSON.stringify(row.data ?? {}));
  for (const k of Object.keys(incoming)) fresh[k] = incoming[k];
  const converted = convertHtmlMarkers(fresh);
  await prisma.siteDocument.update({ where: { id: row.id }, data: { data: converted } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/content/featured");
}

// Site settings — edits only safe scalar fields on the footer doc; preserves the rest of the JSON.
export async function updateFooterSettings(lang: string, formData: FormData) {
  await requireAdmin();
  if (!["en", "de", "pl", "ru"].includes(lang)) throw new Error("Invalid language");
  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "footer", language: lang as any } } });
  if (!row) throw new Error("Footer not found");
  const prev = row.data as Record<string, any>;

  // Edit only the text fields of each contact/social row; preserve _key + icon
  // (and any other keys) so the footer's structure and images stay intact.
  const contacts = Array.isArray(prev.contacts)
    ? prev.contacts.map((c: any, i: number) => ({
        ...c,
        type: (String(formData.get(`contact_${i}_type`) ?? "").trim() || c.type),
        label: String(formData.get(`contact_${i}_label`) ?? c.label ?? "").trim(),
      }))
    : prev.contacts;

  const socialLinks = Array.isArray(prev.socialLinks)
    ? prev.socialLinks.map((s: any, i: number) => ({
        ...s,
        link: String(formData.get(`social_${i}_link`) ?? s.link ?? "").trim(),
        label: (String(formData.get(`social_${i}_label`) ?? "").trim() || s.label),
      }))
    : prev.socialLinks;

  const policyLinks = Array.isArray(prev.policyLinks)
    ? prev.policyLinks.map((l: any, i: number) => ({
        ...l,
        label: String(formData.get(`policy_${i}_label`) ?? l.label ?? "").trim(),
        link: String(formData.get(`policy_${i}_link`) ?? l.link ?? "").trim(),
      }))
    : prev.policyLinks;

  const scalar = (key: string) => {
    const v = formData.get(key);
    return v === null ? prev[key] : String(v).trim();
  };

  const data = {
    ...prev,
    copyright: String(formData.get("copyright") ?? "").trim(),
    vatNumber: String(formData.get("vatNumber") ?? "").trim(),
    discklaimer: String(formData.get("disclaimer") ?? "").trim(),
    companyTitle: scalar("companyTitle"),
    contactTitle: scalar("contactTitle"),
    newsletterTitle: scalar("newsletterTitle"),
    newsletterButtonLabel: scalar("newsletterButtonLabel"),
    contacts,
    socialLinks,
    policyLinks,
  };
  await prisma.siteDocument.update({ where: { id: row.id }, data: { data } });
  revalidatePath("/admin/settings");
  // Footer renders on every public page — revalidate the whole locale layout.
  revalidatePath("/", "layout");
}

export async function updateSinglepageMeta(id: string, formData: FormData) {
  await requireSession();
  const status = String(formData.get("status") ?? "PUBLISHED");
  if (!CONTENT_STATUSES.includes(status)) throw new Error("Invalid status");
  const patch = { ...(await slugFromForm(prisma.singlepage, id, formData)), ...(await publishedAtOnPublish(prisma.singlepage, id, status)) };
  const row = await prisma.singlepage.update({
    where: { id },
    data: {
      ...patch,
      title: String(formData.get("title") ?? "").trim(),
      excerpt: String(formData.get("excerpt") ?? "").trim() || null,
      status: status as any,
      scheduledAt: scheduledAtFromForm(formData, status),
      seo: {
        metaTitle: String(formData.get("seoTitle") ?? "").trim(),
        metaDescription: String(formData.get("seoDescription") ?? "").trim(),
      },
    },
  });
  revalidatePath(`/admin/content/pages/${id}`);
  revalidatePath("/admin/content/pages");
  revalidateSinglepagePublic(row.language, row.slug);
}

// Rich body editing — TipTap HTML → Portable Text on save.
const PROJECT_PT_FIELDS = ["description", "fullDescription"];
export async function saveProjectField(id: string, field: string, html: string) {
  await requireSession();
  if (!PROJECT_PT_FIELDS.includes(field)) throw new Error("Invalid field");
  const pt = htmlToPortableText(html);
  const row = await prisma.project.update({ where: { id }, data: { [field]: pt as any } });
  revalidatePath(`/admin/content/projects/${id}`);
  revalidateProjectPublic(row.language, row.slug);
  return { ok: true };
}

// Case study rich sections — stored as Portable Text inside the caseDetails JSON.
const CASE_STUDY_DETAIL_FIELDS = ["clientSituation", "requirements", "solution", "result", "selectedProperty"];
export async function saveCaseStudyDetail(id: string, field: string, html: string) {
  await requireSession();
  if (!CASE_STUDY_DETAIL_FIELDS.includes(field)) throw new Error("Invalid field");
  const row = await prisma.caseStudy.findUnique({ where: { id }, select: { caseDetails: true, language: true, slug: true } });
  if (!row) throw new Error("Case study not found");
  const cd = { ...((row.caseDetails as any) ?? {}) };
  cd[field] = htmlToPortableText(html);
  await prisma.caseStudy.update({ where: { id }, data: { caseDetails: cd as any } });
  revalidatePath(`/admin/content/case-studies/${id}`);
  revalidatePath(localizedHref(row.language, ["case-studies", row.slug]));
  return { ok: true };
}

// ── New content creation (starts as DRAFT) ──
export async function createBlogPost(_prev: any, formData: FormData) {
  await requireSession();
  const language = String(formData.get("language") ?? "en");
  const title = String(formData.get("title") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "").trim() || title);
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  if (!LOCALES.includes(language)) return { error: "Invalid language" };
  if (!title || !slug) return { error: "Title and slug are required." };
  if (await prisma.blog.findFirst({ where: { language: language as any, slug } })) return { error: "A post with this slug already exists in this language." };
  const created = await prisma.blog.create({
    data: { sanityId: `local-${crypto.randomUUID()}`, language: language as any, slug, title, excerpt: excerpt || null, status: "DRAFT" },
  });
  revalidatePath("/admin/content/blog");
  redirect(`/admin/content/blog/${created.id}`);
}

// Generic "create new" for the remaining content types (mirrors createProject/createBlogPost).
// titleField maps the form's single text input to the model's title/name column; hasSlug/hasStatus/
// hasExcerpt match each model. New items are DRAFT (where applicable) and open in their editor.
const CREATE_TYPES: Record<string, { model: any; path: string; hasStatus: boolean; hasSlug: boolean; hasExcerpt: boolean; titleField: "title" | "name"; label: string }> = {
  singlepage: { model: prisma.singlepage, path: "pages", hasStatus: true, hasSlug: true, hasExcerpt: true, titleField: "title", label: "page" },
  caseStudy: { model: prisma.caseStudy, path: "case-studies", hasStatus: true, hasSlug: true, hasExcerpt: true, titleField: "title", label: "case study" },
  developer: { model: prisma.developer, path: "developers", hasStatus: false, hasSlug: true, hasExcerpt: true, titleField: "title", label: "developer" },
  author: { model: prisma.author, path: "authors", hasStatus: false, hasSlug: false, hasExcerpt: false, titleField: "name", label: "author" },
  category: { model: prisma.category, path: "categories", hasStatus: false, hasSlug: true, hasExcerpt: false, titleField: "title", label: "category" },
};

export async function createContent(type: string, _prev: any, formData: FormData) {
  await requireSession();
  const cfg = CREATE_TYPES[type];
  if (!cfg) return { error: "Unknown content type" };
  const language = String(formData.get("language") ?? "en");
  if (!LOCALES.includes(language)) return { error: "Invalid language" };
  const titleVal = String(formData.get("title") ?? "").trim();
  if (!titleVal) return { error: `A ${cfg.label} title is required.` };

  const data: any = { sanityId: `local-${crypto.randomUUID()}`, language: language as any, [cfg.titleField]: titleVal };
  if (cfg.hasStatus) data.status = "DRAFT";
  if (cfg.hasExcerpt) { const ex = String(formData.get("excerpt") ?? "").trim(); if (ex) data.excerpt = ex; }
  if (cfg.hasSlug) {
    const slug = slugify(String(formData.get("slug") ?? "").trim() || titleVal);
    if (!slug) return { error: "A valid slug is required." };
    if (await cfg.model.findFirst({ where: { language: language as any, slug }, select: { id: true } }))
      return { error: `A ${cfg.label} with this slug already exists in this language.` };
    data.slug = slug;
  }

  const created = await cfg.model.create({ data });
  revalidatePath(`/admin/content/${cfg.path}`);
  redirect(`/admin/content/${cfg.path}/${created.id}`);
}

export async function createProject(_prev: any, formData: FormData) {
  await requireSession();
  const language = String(formData.get("language") ?? "en");
  const title = String(formData.get("title") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "").trim() || title);
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  if (!LOCALES.includes(language)) return { error: "Invalid language" };
  if (!title || !slug) return { error: "Title and slug are required." };
  if (await prisma.project.findFirst({ where: { language: language as any, slug } })) return { error: "A project with this slug already exists in this language." };
  const created = await prisma.project.create({
    data: { sanityId: `local-${crypto.randomUUID()}`, language: language as any, slug, title, excerpt: excerpt || null, status: "DRAFT" },
  });
  revalidatePath("/admin/content/projects");
  redirect(`/admin/content/projects/${created.id}`);
}

// Page-builder block editing (blog). Rebuilds contentBlocks from the editor's item list:
// textContent blocks get their HTML converted to Portable Text; all other block types are
// preserved verbatim (round-trip-safe). Order follows the items array.
type BlockItem = { type: string; key: string; html?: string; block?: any };
export async function saveBlogContentBlocks(id: string, items: BlockItem[]) {
  await requireSession();
  if (!Array.isArray(items)) throw new Error("Invalid blocks");
  const blocks = items
    .map((it) => {
      if (it.type === "textContent") {
        const orig = (it.block && typeof it.block === "object") ? it.block : {};
        return { ...orig, _type: "textContent", _key: it.key, content: htmlToPortableText(it.html ?? "") };
      }
      return it.block ? convertHtmlMarkers(it.block) : null;
    })
    .filter(Boolean);
  const row = await prisma.blog.update({ where: { id }, data: { contentBlocks: blocks as any } });
  revalidatePath(`/admin/content/blog/${id}`);
  revalidateBlogPublic(row.language, row.slug);
  return { ok: true };
}

// Internal blog articles for the Inline Related Article picker (ref + label).
export async function listBlogArticlesForPicker(): Promise<{ ref: string; title: string; language: string }[]> {
  await requireSession();
  const rows = await prisma.blog.findMany({
    select: { sanityId: true, title: true, slug: true, language: true },
    orderBy: [{ language: "asc" }, { title: "asc" }],
  });
  return rows
    .filter((r) => r.sanityId)
    .map((r) => ({ ref: r.sanityId as string, title: (r.title || r.slug || "Untitled") as string, language: r.language as string }));
}

export async function saveSinglepageContentBlocks(id: string, items: BlockItem[]) {
  await requireSession();
  if (!Array.isArray(items)) throw new Error("Invalid blocks");
  const blocks = items
    .map((it) => {
      if (it.type === "textContent") {
        const orig = (it.block && typeof it.block === "object") ? it.block : {};
        return { ...orig, _type: "textContent", _key: it.key, content: htmlToPortableText(it.html ?? "") };
      }
      return it.block ? convertHtmlMarkers(it.block) : null;
    })
    .filter(Boolean);
  const row = await prisma.singlepage.update({ where: { id }, data: { contentBlocks: blocks as any } });
  revalidatePath(`/admin/content/pages/${id}`);
  revalidateSinglepagePublic(row.language, row.slug);
  return { ok: true };
}

// ── Media: organise assets into folders ──
export async function setMediaFolder(id: string, folder: string) {
  await requireSession();
  const f = String(folder ?? "").trim().slice(0, 80);
  // Auto-register the folder so it persists even before any file lands in it.
  if (f) await prisma.mediaFolder.upsert({ where: { name: f }, update: {}, create: { name: f } });
  await prisma.media.update({ where: { id }, data: { folder: f || null } });
  revalidatePath("/admin/media");
}

export async function createMediaFolder(_prev: any, formData: FormData): Promise<{ ok?: string; error?: string }> {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { error: "Folder name is required." };
  await prisma.mediaFolder.upsert({ where: { name }, update: {}, create: { name } });
  revalidatePath("/admin/media");
  return { ok: `Folder “${name}” created.` };
}

// Remove a folder record and unfile any media currently in it.
export async function deleteMediaFolder(name: string) {
  await requireSession();
  await prisma.media.updateMany({ where: { folder: name }, data: { folder: null } });
  await prisma.mediaFolder.deleteMany({ where: { name } });
  revalidatePath("/admin/media");
}

// ── Categories (reference entity; appears on blog posts) ──
export async function updateCategory(id: string, formData: FormData) {
  await requireSession();
  const patch = await slugFromForm(prisma.category, id, formData);
  await prisma.category.update({
    where: { id },
    data: { ...patch, title: String(formData.get("title") ?? "").trim() },
  });
  revalidatePath(`/admin/content/categories/${id}`);
  revalidatePath("/admin/content/categories");
  revalidatePath("/", "layout"); // category labels appear across blog pages
}

// ── Header (site document, per language; renders on every page) ──
export async function updateHeaderDoc(id: string, formData: FormData) {
  await requireSession();
  const row = await prisma.siteDocument.findUnique({ where: { id } });
  if (!row || row.type !== "header") throw new Error("Header not found");
  const data = row.data as any;
  const key = () => crypto.randomBytes(6).toString("hex");
  const parsed = parseJsonField(formData.get("navLinks"));
  const navLinks = Array.isArray(parsed)
    ? parsed
        .map((n: any) => ({
          ...n,
          _key: typeof n._key === "string" && n._key ? n._key : key(),
          label: String(n.label ?? "").trim(),
          link: String(n.link ?? "").trim(),
          subLinks: Array.isArray(n.subLinks)
            ? n.subLinks
                .map((s: any) => ({ ...s, _key: typeof s._key === "string" && s._key ? s._key : key(), label: String(s.label ?? "").trim(), link: String(s.link ?? "").trim() }))
                .filter((s: any) => s.label || s.link)
            : [],
        }))
        .filter((n: any) => n.label || n.link)
    : data.navLinks;
  const next = {
    ...data,
    logo: parseJsonField(formData.get("logo")),
    logoMobile: parseJsonField(formData.get("logoMobile")),
    navLinks,
  };
  await prisma.siteDocument.update({ where: { id }, data: { data: next } });
  revalidatePath("/admin/content/header");
  revalidatePath("/", "layout");
}

// ── Forms (formStandardDocument; flat string labels) ──
export async function updateFormDoc(id: string, formData: FormData) {
  await requireSession();
  const row = await prisma.siteDocument.findUnique({ where: { id } });
  if (!row || row.type !== "formStandardDocument") throw new Error("Form not found");
  const data = row.data as any;
  const form = { ...(data.form ?? {}) };
  for (const [k, v] of Object.entries(form)) {
    if (!k.startsWith("_") && typeof v === "string") {
      const next = formData.get(`f_${k}`);
      if (next !== null) form[k] = String(next);
    }
  }
  await prisma.siteDocument.update({ where: { id }, data: { data: { ...data, form } } });
  revalidatePath("/admin/content/forms");
  revalidatePath("/", "layout");
}

// ── Landing / section pages (site documents: blogPage, caseStudiesPage,
//    projectsPage, propertiesPage, notFoundPage) ──
const SITE_PAGE_TYPES = ["blogPage", "caseStudiesPage", "projectsPage", "notFoundPage"];
const SITE_PAGE_EXCLUDE = new Set(["title", "metaTitle", "metaDescription", "slug", "_type", "content", "seo"]);

export async function updateSitePage(id: string, formData: FormData) {
  await requireSession();
  const row = await prisma.siteDocument.findUnique({ where: { id } });
  if (!row || !SITE_PAGE_TYPES.includes(row.type)) throw new Error("Page not found");
  const prev = row.data as Record<string, any>;
  const data: Record<string, any> = { ...prev };

  data.title = String(formData.get("title") ?? "").trim();
  const seoTitle = String(formData.get("seoTitle") ?? "").trim();
  const seoDescription = String(formData.get("seoDescription") ?? "").trim();
  if (prev.seo && typeof prev.seo === "object") {
    data.seo = { ...prev.seo, metaTitle: seoTitle, metaDescription: seoDescription };
  } else {
    data.metaTitle = seoTitle;
    data.metaDescription = seoDescription;
  }
  // Other top-level string fields (e.g. 404 page's textStart/textEnd/buttonText/description).
  for (const [k, v] of Object.entries(prev)) {
    if (typeof v === "string" && !SITE_PAGE_EXCLUDE.has(k)) {
      const next = formData.get(`x_${k}`);
      if (next !== null) data[k] = String(next);
    }
  }
  await prisma.siteDocument.update({ where: { id }, data: { data } });
  revalidatePath("/admin/content/landing");
  revalidatePath("/", "layout"); // listing/404 pages render the layout
}

export async function saveSitePageContent(id: string, html: string) {
  await requireSession();
  const row = await prisma.siteDocument.findUnique({ where: { id } });
  if (!row || !SITE_PAGE_TYPES.includes(row.type)) throw new Error("Page not found");
  const data = { ...(row.data as any), content: htmlToPortableText(html) };
  await prisma.siteDocument.update({ where: { id }, data: { data } });
  revalidatePath("/admin/content/landing");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ── Translations: create a linked translation of an existing document ──
// Keeps the document-per-language model (linked by translationGroupId). Copies
// the source content as a starting point, assigns the same group, sets the
// target language + a unique slug, marks it DRAFT, and opens it in the editor.
const TR_TYPES: Record<string, { model: any; path: string; hasStatus: boolean; hasSlug: boolean }> = {
  project: { model: prisma.project, path: "projects", hasStatus: true, hasSlug: true },
  blog: { model: prisma.blog, path: "blog", hasStatus: true, hasSlug: true },
  singlepage: { model: prisma.singlepage, path: "pages", hasStatus: true, hasSlug: true },
  caseStudy: { model: prisma.caseStudy, path: "case-studies", hasStatus: true, hasSlug: true },
  developer: { model: prisma.developer, path: "developers", hasStatus: false, hasSlug: true },
  author: { model: prisma.author, path: "authors", hasStatus: false, hasSlug: false },
  category: { model: prisma.category, path: "categories", hasStatus: false, hasSlug: true },
};

// Resolve the same reference doc (author/category) in another language via its translation
// group, so a created translation links the correct-language reference. Null if none.
async function siblingIdInLang(model: any, sourceId: string | null | undefined, lang: string): Promise<string | null> {
  if (!sourceId) return null;
  const src = await model.findUnique({ where: { id: sourceId }, select: { translationGroupId: true } });
  if (!src?.translationGroupId) return null;
  const sib = await model.findFirst({ where: { translationGroupId: src.translationGroupId, language: lang as any }, select: { id: true } });
  return sib?.id ?? null;
}

export async function createTranslation(type: string, sourceId: string, targetLang: string) {
  await requireSession();
  const cfg = TR_TYPES[type];
  if (!cfg) throw new Error("Unknown content type");
  if (!LOCALES.includes(targetLang)) throw new Error("Invalid language");

  const source: any = await cfg.model.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error("Source document not found");

  // Ensure the source has a translation group (generate + persist if missing).
  let groupId: string = source.translationGroupId;
  if (!groupId) {
    groupId = crypto.randomUUID();
    await cfg.model.update({ where: { id: sourceId }, data: { translationGroupId: groupId } });
  }

  // If a translation already exists for this language, just open it.
  const existing = await cfg.model.findFirst({ where: { translationGroupId: groupId, language: targetLang as any }, select: { id: true } });
  if (existing) redirect(`/admin/content/${cfg.path}/${existing.id}`);

  // Copy source content as the starting point.
  const data: any = { ...source };
  delete data.id; delete data.createdAt; delete data.updatedAt; delete data.publishedAt; delete data.scheduledAt;
  data.sanityId = `local-${crypto.randomUUID()}`;
  data.language = targetLang;
  data.translationGroupId = groupId;
  if (cfg.hasStatus) data.status = "DRAFT";
  if (cfg.hasSlug) {
    const taken = async (s: string) => !!(await cfg.model.findFirst({ where: { language: targetLang as any, slug: s }, select: { id: true } }));
    const base = String(source.slug || "untitled");
    let slug = base;
    if (await taken(slug)) { slug = `${base}-${targetLang}`; let n = 2; while (await taken(slug)) slug = `${base}-${targetLang}-${n++}`; }
    data.slug = slug;
  }
  // Blog references author/category by id — remap them to the target language's sibling
  // (author/category are fully translated 4-language groups), so the translation links the
  // correct-language reference instead of inheriting the source language's. null → editor picks.
  if (type === "blog") {
    data.authorId = await siblingIdInLang(prisma.author, source.authorId, targetLang);
    data.categoryId = await siblingIdInLang(prisma.category, source.categoryId, targetLang);
  }
  // Drop null-valued keys so Prisma create uses column defaults (avoids Json-null errors).
  for (const k of Object.keys(data)) if (data[k] === null) delete data[k];

  const created = await cfg.model.create({ data });
  revalidatePath(`/admin/content/${cfg.path}`);
  revalidatePath(`/admin/content/${cfg.path}/${sourceId}`);
  redirect(`/admin/content/${cfg.path}/${created.id}`);
}

// ── Developers (reference entity — no status) ──
function revalidateDeveloperPublic(language: string, slug: string) {
  revalPublic(language, ["developers", slug]);
  revalPublic(language, ["developers"]);
}
export async function updateDeveloperMeta(id: string, formData: FormData) {
  await requireSession();
  const patch = await slugFromForm(prisma.developer, id, formData);
  const row = await prisma.developer.update({
    where: { id },
    data: {
      ...patch,
      title: String(formData.get("title") ?? "").trim(),
      titleFull: String(formData.get("titleFull") ?? "").trim() || null,
      excerpt: String(formData.get("excerpt") ?? "").trim() || null,
      logo: jsonOrDbNull(parseJsonField(formData.get("logo"))),
      seo: {
        metaTitle: String(formData.get("seoTitle") ?? "").trim(),
        metaDescription: String(formData.get("seoDescription") ?? "").trim(),
      },
    },
  });
  revalidatePath(`/admin/content/developers/${id}`);
  revalidatePath("/admin/content/developers");
  revalidateDeveloperPublic(row.language, row.slug);
}
export async function saveDeveloperDescription(id: string, html: string) {
  await requireSession();
  const row = await prisma.developer.update({ where: { id }, data: { description: htmlToPortableText(html) as any } });
  revalidatePath(`/admin/content/developers/${id}`);
  revalidateDeveloperPublic(row.language, row.slug);
  return { ok: true };
}

// ── Authors (reference entity — appears on blog posts; bio is plain text) ──
export async function updateAuthorMeta(id: string, formData: FormData) {
  await requireSession();
  const specialization = String(formData.get("specialization") ?? "")
    .split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  await prisma.author.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim(),
      position: String(formData.get("position") ?? "").trim() || null,
      bio: String(formData.get("bio") ?? "").trim() || null,
      linkedin: String(formData.get("linkedin") ?? "").trim() || null,
      specialization,
      image: jsonOrDbNull(parseJsonField(formData.get("image"))),
    },
  });
  revalidatePath(`/admin/content/authors/${id}`);
  revalidatePath("/admin/content/authors");
}

// ── Case studies ──
// Edits the safe fields (rich `caseDetails` Portable Text is preserved untouched —
// a dedicated rich editor for those is a follow-up; main body is edited as blocks).
export async function updateCaseStudyMeta(id: string, formData: FormData) {
  await requireSession();
  const status = String(formData.get("status") ?? "PUBLISHED");
  if (!CONTENT_STATUSES.includes(status)) throw new Error("Invalid status");
  const patch = { ...(await slugFromForm(prisma.caseStudy, id, formData)), ...(await publishedAtOnPublish(prisma.caseStudy, id, status)) };
  const row = await prisma.caseStudy.update({
    where: { id },
    data: {
      ...patch,
      title: String(formData.get("title") ?? "").trim(),
      fullTitle: String(formData.get("fullTitle") ?? "").trim() || null,
      excerpt: String(formData.get("excerpt") ?? "").trim() || null,
      category: String(formData.get("category") ?? "").trim() || null,
      status: status as any,
      scheduledAt: scheduledAtFromForm(formData, status),
      previewImage: jsonOrDbNull(parseJsonField(formData.get("previewImage"))),
      seo: {
        metaTitle: String(formData.get("seoTitle") ?? "").trim(),
        metaDescription: String(formData.get("seoDescription") ?? "").trim(),
      },
      clientOverview: {
        budget: String(formData.get("co_budget") ?? "").trim(),
        location: String(formData.get("co_location") ?? "").trim(),
        propertyType: String(formData.get("co_propertyType") ?? "").trim(),
        purchaseTimeline: String(formData.get("co_purchaseTimeline") ?? "").trim(),
      },
    },
  });
  revalidatePath(`/admin/content/case-studies/${id}`);
  revalidatePath("/admin/content/case-studies");
  revalidateCaseStudyPublic(row.language, row.slug);
}

export async function saveCaseStudyContentBlocks(id: string, items: BlockItem[]) {
  await requireSession();
  if (!Array.isArray(items)) throw new Error("Invalid blocks");
  const blocks = items
    .map((it) => {
      if (it.type === "textContent") {
        const orig = (it.block && typeof it.block === "object") ? it.block : {};
        return { ...orig, _type: "textContent", _key: it.key, content: htmlToPortableText(it.html ?? "") };
      }
      return it.block ? convertHtmlMarkers(it.block) : null;
    })
    .filter(Boolean);
  const row = await prisma.caseStudy.update({ where: { id }, data: { mainContent: blocks as any } });
  revalidatePath(`/admin/content/case-studies/${id}`);
  revalidateCaseStudyPublic(row.language, row.slug);
  return { ok: true };
}

export async function logout() {
  await signOut({ redirectTo: "/admin/login" });
}

// ─────────────────────────────────────────────────────────────────────────
// DEVELOPER FEED ANALYSIS (discovery / standardization tool).
// Creates developer accounts and analyzes uploaded XML files / feed URLs into a
// field-mapping table. NOTHING here writes to Project/Property or public content.
// ─────────────────────────────────────────────────────────────────────────

async function uniqueAccountSlug(desired: string, excludeId?: string): Promise<string> {
  const base = slugify(desired) || "developer";
  let slug = base;
  let n = 2;
  while (
    await prisma.developerAccount.findFirst({
      where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    })
  ) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export async function createDeveloperAccount(_prev: any, formData: FormData) {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Developer name is required." };
  const slug = await uniqueAccountSlug(String(formData.get("slug") ?? "") || name);
  const website = String(formData.get("website") ?? "").trim() || null;
  const contactInfo = String(formData.get("contactInfo") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const dev = await prisma.developerAccount.create({ data: { name, slug, website, contactInfo, notes } });
  revalidatePath("/admin/feeds");
  redirect(`/admin/feeds/${dev.id}`);
}

export async function updateDeveloperAccount(id: string, formData: FormData) {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Developer name is required.");
  await prisma.developerAccount.update({
    where: { id },
    data: {
      name,
      website: String(formData.get("website") ?? "").trim() || null,
      contactInfo: String(formData.get("contactInfo") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });
  revalidatePath(`/admin/feeds/${id}`);
  revalidatePath("/admin/feeds");
}

export async function deleteDeveloperAccount(id: string) {
  await requireSession();
  await prisma.developerAccount.delete({ where: { id } }); // cascades analyses
  revalidatePath("/admin/feeds");
  redirect("/admin/feeds");
}

export async function deleteFeedAnalysis(id: string) {
  await requireSession();
  const row = await prisma.developerFeedAnalysis.findUnique({ where: { id }, select: { developerAccountId: true } });
  await prisma.developerFeedAnalysis.delete({ where: { id } });
  if (row) revalidatePath(`/admin/feeds/${row.developerAccountId}`);
}

// Analyze an uploaded XML file OR a feed URL. Stores the raw XML (size-capped)
// plus the analyzed field descriptors. Read-only w.r.t. the actual feed source.
export async function analyzeDeveloperFeed(developerAccountId: string, _prev: any, formData: FormData) {
  await requireSession();
  const { analyzeXml, MAX_FEED_BYTES } = await import("@/lib/devFeeds/analyze");

  const mode = String(formData.get("mode") ?? "file");
  let xml = "";
  let sourceType = "FILE";
  let sourceUrl: string | null = null;
  let sourceFileName: string | null = null;

  try {
    if (mode === "url") {
      sourceType = "URL";
      const url = String(formData.get("url") ?? "").trim();
      if (!/^https?:\/\//i.test(url)) return { error: "Enter a valid http(s) feed URL." };
      sourceUrl = url;
      // SSRF-safe: rejects URLs resolving to private/internal addresses and
      // re-validates every redirect hop; streams with the size cap.
      const { fetchFeedXml } = await import("@/lib/devFeeds/fetchFeed");
      xml = await fetchFeedXml(url, MAX_FEED_BYTES);
    } else {
      const file = formData.get("file") as File | null;
      if (!file || file.size === 0) return { error: "Choose an XML file to upload." };
      if (file.size > MAX_FEED_BYTES) return { error: `File too large (> ${MAX_FEED_BYTES / 1024 / 1024} MB).` };
      sourceFileName = file.name || "feed.xml";
      xml = Buffer.from(await file.arrayBuffer()).toString("utf8");
    }
  } catch (e: any) {
    return { error: e?.name === "TimeoutError" ? "Feed fetch timed out." : `Could not read feed: ${e?.message ?? e}` };
  }

  if (!xml.trim()) return { error: "The feed/file is empty." };

  let result;
  try {
    result = await analyzeXml(xml);
  } catch (e: any) {
    return { error: `Could not parse XML: ${e?.message ?? e}` };
  }
  if (!result.itemNodePath || result.fields.length === 0) {
    return { error: "No repeating item nodes / fields were detected in this feed." };
  }

  const row = await prisma.developerFeedAnalysis.create({
    data: {
      developerAccountId,
      sourceType,
      sourceUrl,
      sourceFileName,
      rawXml: xml, // already size-capped above
      itemNodePath: result.itemNodePath,
      itemCount: result.itemCount,
      fields: result.fields as any,
    },
  });
  revalidatePath(`/admin/feeds/${developerAccountId}`);
  redirect(`/admin/feeds/${developerAccountId}/analysis/${row.id}`);
}

// Persist manual edits to the mapping table (a JSON array posted from the client
// editor): include/ignore, suggested internal field, recommendation, notes.
export async function saveFeedMapping(analysisId: string, _prev: any, formData: FormData) {
  await requireSession();
  const raw = String(formData.get("fields") ?? "");
  let fields: any;
  try {
    fields = JSON.parse(raw);
  } catch {
    return { error: "Invalid mapping payload." };
  }
  if (!Array.isArray(fields)) return { error: "Invalid mapping payload." };
  const row = await prisma.developerFeedAnalysis.update({
    where: { id: analysisId },
    data: { fields: fields as any },
    select: { developerAccountId: true },
  });
  revalidatePath(`/admin/feeds/${row.developerAccountId}/analysis/${analysisId}`);
  revalidatePath("/admin/feeds/compare");
  return { ok: true };
}
