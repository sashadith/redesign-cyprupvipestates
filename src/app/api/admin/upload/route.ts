// Admin image upload → Sharp-processed, content-addressed local storage + Media row.
// Pipeline on upload: auto-orient (EXIF) → cap long edge → recompress (PNG photos → JPEG;
// keep transparency as PNG; WebP stays WebP) → strip metadata → generate a tiny blur
// placeholder. Files are content-addressed on the PROCESSED bytes
// (/public/uploads/images/<sha1>-<WxH>.<ext>) so they round-trip the Portable Text converters.
// Animated GIF and anything Sharp can't read are stored as-is. Admin-session protected.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { imageSize } from "image-size";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Cap the stored original: 2560px on the long edge is retina-safe for full-bleed heroes
// (a 1280px CSS slot at DPR 2). Property galleries never need 5000px+ source files.
const MAX_EDGE = 2560;
const QUALITY = 82; // strong quality with good size for Core Web Vitals

type Processed = {
  buf: Buffer; ext: string; mime: string;
  width: number | null; height: number | null; blurDataUrl: string | null;
};

// AVATAR_SIZE/PHOTO_MAX_HEIGHT: the two User-profile-photo upload modes (Part 8
// of the CRM/Presentation task) — square cropped avatar for the admin UI, and a
// tall transparent cutout for the Client Presentation closing section.
const AVATAR_SIZE = 256;
const PHOTO_MAX_HEIGHT = 800;

async function processImage(input: Buffer, srcExt: string, mode?: string | null): Promise<Processed> {
  // GIF: keep as-is so animation is preserved (Sharp would flatten it) — never
  // applies to the avatar/photoPng modes, which reject non-PNG/JPEG upstream.
  if (srcExt === "gif") {
    let w: number | null = null, h: number | null = null;
    try { const d = imageSize(input); w = d.width ?? null; h = d.height ?? null; } catch {}
    return { buf: input, ext: "gif", mime: "image/gif", width: w, height: h, blurDataUrl: null };
  }

  const img = sharp(input, { failOn: "none" }).rotate(); // bake EXIF orientation, then strip metadata
  const meta = await img.metadata();

  if (mode === "avatar") {
    // Square, cropped to fill — the small round/square admin avatar.
    const out = await img.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE, fit: "cover" }).webp({ quality: QUALITY }).toBuffer({ resolveWithObject: true });
    return { buf: out.data, ext: "webp", mime: "image/webp", width: out.info.width ?? null, height: out.info.height ?? null, blurDataUrl: null };
  }
  if (mode === "photoPng") {
    // Transparent cutout for the Client Presentation closing section — never
    // recompressed to WebP/JPEG, so the alpha channel survives exactly as
    // uploaded. Height-capped (not width), since these are tall portrait cutouts.
    const out = await img.resize({ height: PHOTO_MAX_HEIGHT, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
    return { buf: out.data, ext: "png", mime: "image/png", width: out.info.width ?? null, height: out.info.height ?? null, blurDataUrl: null };
  }

  const tooBig = (meta.width ?? 0) > MAX_EDGE || (meta.height ?? 0) > MAX_EDGE;
  let pipe = tooBig
    ? img.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    : img;

  // Keep transparency as PNG; everything else (incl. photographic PNGs) → JPEG/WebP.
  let ext: string, mime: string;
  if (srcExt === "webp") {
    pipe = pipe.webp({ quality: QUALITY }); ext = "webp"; mime = "image/webp";
  } else if (srcExt === "png" && meta.hasAlpha) {
    pipe = pipe.png({ compressionLevel: 9, palette: true }); ext = "png"; mime = "image/png";
  } else {
    pipe = pipe.jpeg({ quality: QUALITY, mozjpeg: true }); ext = "jpg"; mime = "image/jpeg";
  }

  const out = await pipe.toBuffer({ resolveWithObject: true });
  const blur = await sharp(out.data).resize(16, 16, { fit: "inside" }).webp({ quality: 35 }).toBuffer();
  return {
    buf: out.data, ext, mime,
    width: out.info.width ?? null, height: out.info.height ?? null,
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  const srcExt = ALLOWED[file.type];
  if (!srcExt) return NextResponse.json({ error: "Unsupported type" }, { status: 400 });
  const folder = String(form.get("folder") ?? "").trim().slice(0, 80) || null;
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 400 });

  // "avatar" and "photoPng" are the two User-profile-photo modes (Part 8) —
  // everything else keeps the general media-library behavior unchanged.
  const mode = String(form.get("mode") ?? "").trim() || null;
  if (mode === "photoPng" && srcExt !== "png") {
    return NextResponse.json({ error: "Only PNG files are accepted here (transparent background required)." }, { status: 400 });
  }
  if (mode === "avatar" && srcExt === "gif") {
    return NextResponse.json({ error: "Animated GIFs aren't supported for the avatar." }, { status: 400 });
  }

  const raw = Buffer.from(await file.arrayBuffer());

  // Process; fall back to raw bytes if Sharp can't read the file (never hard-fail an upload).
  let p: Processed;
  try {
    p = await processImage(raw, srcExt, mode);
  } catch {
    let w: number | null = null, h: number | null = null;
    try { const d = imageSize(raw); w = d.width ?? null; h = d.height ?? null; } catch {}
    p = { buf: raw, ext: srcExt, mime: file.type, width: w, height: h, blurDataUrl: null };
  }

  const hash = crypto.createHash("sha1").update(p.buf).digest("hex");
  const base = p.width && p.height ? `${hash}-${p.width}x${p.height}.${p.ext}` : `${hash}.${p.ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "images");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, base), p.buf);

  const url = `/uploads/images/${base}`;
  const ref = p.width && p.height ? `image-${hash}-${p.width}x${p.height}-${p.ext}` : `image-${hash}-${p.ext}`;

  const media = await prisma.media.upsert({
    where: { sanityAssetId: ref },
    update: {
      url, path: url, originalFilename: file.name,
      ...(folder ? { folder } : {}),
      ...(p.blurDataUrl ? { blurDataUrl: p.blurDataUrl } : {}),
    },
    create: {
      sanityAssetId: ref, filename: base, originalFilename: file.name, path: url, url,
      mimeType: p.mime, fileSize: p.buf.length, width: p.width, height: p.height, folder,
      blurDataUrl: p.blurDataUrl,
      uploadedById: (session.user as any)?.id ?? null,
    },
  });

  return NextResponse.json({ ok: true, url, ref, width: p.width, height: p.height, id: media.id });
}
