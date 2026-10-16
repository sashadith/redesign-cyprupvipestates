"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateAreaContent, type FourLang } from "@/lib/ai/areaContent";
import { slugOfArea } from "./slug";

// Server Actions are reachable as a plain POST regardless of the (panel)
// layout's login check — middleware skips /admin and nginx only proxies — so
// every action here checks the session itself. Same contract as
// requireSession() in src/app/admin/actions.ts: a session with a user id, and
// that user still active in the DB (a deactivated user's JWT stays valid).
async function requireActiveUser() {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!user || !user.isActive) throw new Error("Unauthorized");
  return session;
}

// Generate the 4-language description (does NOT save — the editor shows it for
// review first). Siblings from the same district are passed to keep it distinct.
export async function generateArea(name: string, district: string, words?: number, tuning?: { emphasize?: string; avoid?: string }): Promise<{ ok: boolean; texts?: FourLang; error?: string }> {
  try {
    await requireActiveUser();
    const self = slugOfArea(name);
    const sibs = await prisma.areaDescription.findMany({
      where: { district, NOT: { areaSlug: self } },
      select: { areaName: true, textEN: true },
      take: 6,
    });
    const siblings = sibs.filter((s) => s.textEN).map((s) => ({ area: s.areaName, text: s.textEN! }));
    const texts = await generateAreaContent({ areaName: name, district, siblings, words, emphasize: tuning?.emphasize, avoid: tuning?.avoid });
    return { ok: true, texts };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function saveArea(input: { slug: string; name: string; district: string; texts: FourLang; approve: boolean; source?: string }) {
  await requireActiveUser();
  const { slug, name, district, texts, approve } = input;
  const data = {
    areaName: name,
    district: district || null,
    textEN: texts.en?.trim() || null,
    textDE: texts.de?.trim() || null,
    textPL: texts.pl?.trim() || null,
    textRU: texts.ru?.trim() || null,
    textHE: texts.he?.trim() || null,
    source: input.source || "ai",
    status: approve ? "approved" : "draft",
  };
  await prisma.areaDescription.upsert({
    where: { areaSlug: slug },
    update: data,
    create: { areaSlug: slug, ...data },
  });
  revalidatePath("/admin/developments/areas");
  revalidatePath(`/admin/developments/areas/${slug}`);
  revalidatePath("/admin/developments");
}
