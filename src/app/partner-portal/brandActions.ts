"use server";
/**
 * Phase 3e: the partner's branding for presentations they send ("Your branding" on the profile). Scoped
 * to the session's own partner (requirePartner({ active: true })) — never an id from the form. The logo
 * type comes from the file's magic bytes, never from the browser's claimed MIME type.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writePartnerAudit } from "@/lib/partner/audit";
import { BRAND_LOGO_MAX_BYTES, checkBrandLogo, validateBrand } from "@/lib/partner/brand";
import { partnerLimits as L } from "@/lib/partner/limits";
import { requirePartner } from "@/lib/partner/session";
import type { BrandState, LogoState } from "./formState";

export async function saveBrandAction(_prev: BrandState, fd: FormData): Promise<BrandState> {
  const me = await requirePartner({ active: true });
  if (!L.brand.hit(me.partner.id)) return { error: "err.rateLimited" };
  const v = validateBrand({
    brandName: fd.get("brandName"),
    brandPhone: fd.get("brandPhone"),
    brandEmail: fd.get("brandEmail"),
    brandWebsite: fd.get("brandWebsite"),
  });
  if (!v.ok) return { error: v.code, field: v.field };
  const saved = await prisma.partner.update({
    where: { id: me.partner.id },
    data: v.data,
    select: { brandName: true, brandPhone: true, brandEmail: true, brandWebsite: true },
  });
  await writePartnerAudit(me.partner, me.user, "partner_brand_updated", {
    fields: Object.entries(v.data).filter(([, x]) => x !== null).map(([k]) => k),
  });
  revalidatePath("/partner-portal/profile");
  return { ok: true, ...saved };
}

export async function uploadBrandLogoAction(_prev: LogoState, fd: FormData): Promise<LogoState> {
  const me = await requirePartner({ active: true });
  if (!L.brand.hit(me.partner.id)) return { error: "err.rateLimited" };
  const file = fd.get("logo");
  if (!file || typeof file === "string") return { error: "err.logoType", field: "logo" };
  // The declared size is checked before reading the bytes; the byte check below is the authoritative one.
  if (file.size > BRAND_LOGO_MAX_BYTES) return { error: "err.logoSize", field: "logo" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkBrandLogo(bytes);
  if (!check.ok) return { error: check.code, field: "logo" };
  await prisma.partner.update({
    where: { id: me.partner.id },
    data: { brandLogo: Buffer.from(bytes), brandLogoType: check.type, brandLogoUpdatedAt: new Date() },
    select: { id: true },
  });
  await writePartnerAudit(me.partner, me.user, "partner_brand_logo_updated", { type: check.type, bytes: bytes.length });
  revalidatePath("/partner-portal/profile");
  return { ok: true };
}

export async function removeBrandLogoAction(_prev: LogoState, _fd: FormData): Promise<LogoState> {
  const me = await requirePartner({ active: true });
  if (!L.brand.hit(me.partner.id)) return { error: "err.rateLimited" };
  // Bytes and type are always cleared together: the public page reads "has a logo" from brandLogoType.
  await prisma.partner.update({
    where: { id: me.partner.id },
    data: { brandLogo: null, brandLogoType: null, brandLogoUpdatedAt: new Date() },
    select: { id: true },
  });
  await writePartnerAudit(me.partner, me.user, "partner_brand_logo_removed", {});
  revalidatePath("/partner-portal/profile");
  return { ok: true, removed: true };
}
