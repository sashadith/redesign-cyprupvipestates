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
import { zonedInputToUtc } from "@/lib/tz";

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
// Parse a hidden-input JSON field; "" → null. Prisma Json? requires DbNull (not JS null) for SQL NULL.
function parseJsonField(v: FormDataEntryValue | null): any {
  const s = String(v ?? "").trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}
const jsonOrDbNull = (v: any) => (v == null ? Prisma.DbNull : v);
const floatOrNull = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim(); return s === "" ? null : Number(s); };

// Invalidate the PUBLIC (frontend) ISR cache after a content change, so edits/publishes appear
// immediately instead of waiting for the revalidate window. (All locales are prefixed: /en, /de, …)
function revalidateProjectPublic(language: string, slug: string) {
  revalidatePath(`/${language}/projects/${slug}`);
  revalidatePath(`/${language}/projects`);
  revalidatePath(`/${language}`);
}
function revalidateBlogPublic(language: string, slug: string) {
  revalidatePath(`/${language}/blog/${slug}`);
  revalidatePath(`/${language}/blog`);
}
function revalidateSinglepagePublic(language: string, slug: string) {
  revalidatePath(`/${language}/${slug}`);
}

const STATUSES = ["NEW", "QUALIFIED", "CONTACTED", "VIEWING_SCHEDULED", "OFFER", "CLOSED", "LOST"];
const CONTENT_STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"];

async function requireSession() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
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
  const row = await prisma.project.update({
    where: { id },
    data: {
      title: String(formData.get("title") ?? "").trim(),
      excerpt: String(formData.get("excerpt") ?? "").trim() || null,
      status: status as any,
      scheduledAt: scheduledAtFromForm(formData, status),
      isFeatured: formData.get("isFeatured") === "on",
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
  const row = await prisma.blog.update({
    where: { id },
    data: {
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

export async function updateLeadStatus(id: string, status: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  if (!STATUSES.includes(status)) throw new Error("Invalid status");
  await prisma.lead.update({ where: { id }, data: { status: status as any } });
  await prisma.leadActivity.create({
    data: { leadId: id, type: "STATUS_CHANGE", content: `Status changed to ${status}`, createdBy: session.user?.name ?? "admin" },
  });
  revalidatePath(`/admin/crm/${id}`);
  revalidatePath("/admin/crm");
  revalidatePath("/admin");
}

export async function addLeadNote(id: string, note: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const content = note.trim();
  if (!content) return;
  await prisma.leadActivity.create({
    data: { leadId: id, type: "NOTE", content, createdBy: session.user?.name ?? "admin" },
  });
  revalidatePath(`/admin/crm/${id}`);
}

// Assign a lead to a team member (or unassign with an empty value).
export async function assignLead(id: string, userId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
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
    },
  });
  revalidatePath(`/admin/crm/${id}`);
  revalidatePath("/admin/crm");
  revalidatePath("/admin");
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

  const data = {
    ...prev,
    copyright: String(formData.get("copyright") ?? "").trim(),
    vatNumber: String(formData.get("vatNumber") ?? "").trim(),
    discklaimer: String(formData.get("disclaimer") ?? "").trim(),
    contacts,
    socialLinks,
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
  const row = await prisma.singlepage.update({
    where: { id },
    data: {
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
      return it.block ?? null;
    })
    .filter(Boolean);
  const row = await prisma.blog.update({ where: { id }, data: { contentBlocks: blocks as any } });
  revalidatePath(`/admin/content/blog/${id}`);
  revalidateBlogPublic(row.language, row.slug);
  return { ok: true };
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
      return it.block ?? null;
    })
    .filter(Boolean);
  const row = await prisma.singlepage.update({ where: { id }, data: { contentBlocks: blocks as any } });
  revalidatePath(`/admin/content/pages/${id}`);
  revalidateSinglepagePublic(row.language, row.slug);
  return { ok: true };
}

export async function logout() {
  await signOut({ redirectTo: "/admin/login" });
}
