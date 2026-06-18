// Admin image upload → content-addressed local storage + Media row.
// Saves to /public/uploads/images/<sha1>-<WxH>.<ext> so the path matches migrated assets and
// round-trips through the Portable Text converters (localUrlToRef). Admin-session protected.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { imageSize } from "image-size";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  const ext = ALLOWED[file.type];
  if (!ext) return NextResponse.json({ error: "Unsupported type" }, { status: 400 });
  const folder = String(form.get("folder") ?? "").trim().slice(0, 80) || null;
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha1").update(buf).digest("hex");
  let w: number | null = null, h: number | null = null;
  try { const d = imageSize(buf); w = d.width ?? null; h = d.height ?? null; } catch {}

  const base = w && h ? `${hash}-${w}x${h}.${ext}` : `${hash}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "images");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, base), buf);

  const url = `/uploads/images/${base}`;
  const ref = w && h ? `image-${hash}-${w}x${h}-${ext}` : `image-${hash}-${ext}`;

  const media = await prisma.media.upsert({
    where: { sanityAssetId: ref },
    update: { url, path: url, originalFilename: file.name, ...(folder ? { folder } : {}) },
    create: {
      sanityAssetId: ref, filename: base, originalFilename: file.name, path: url, url,
      mimeType: file.type, fileSize: buf.length, width: w, height: h, folder,
      uploadedById: (session.user as any)?.id ?? null,
    },
  });

  return NextResponse.json({ ok: true, url, ref, width: w, height: h, id: media.id });
}
