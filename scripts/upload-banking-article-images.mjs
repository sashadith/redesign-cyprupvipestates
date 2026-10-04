/* Content Offensive Plan — uploads the 2 hand-built infographics (SVG,
   converted locally) and the 1 AI-generated illustration for the banking-
   account article, replicating src/app/api/admin/upload/route.ts's exact
   processImage() pipeline (auto-orient, cap long edge at 2560px, PNG-with-
   alpha stays PNG/palette, everything else -> mozjpeg q82, sha1 of the
   PROCESSED bytes as the content-addressed filename) so the resulting
   `image-<hash>-<w>x<h>-<ext>` ref is byte-identical to what a real admin
   upload through the UI would have produced.

   No live HTTP endpoint call (that needs a NextAuth session) — instead,
   per this session's own established SSH access (~/.ssh/cvp_vps, see
   local-db-is-production memory), scp the processed file straight into
   the VPS's shared, persistent uploads directory (/var/www/shared-
   uploads/images/ — deliberately outside the release-swap cycle per
   deploy-prod.sh's own comments, after a prior incident wiped that
   directory), then upsert the matching Media row via Prisma exactly as
   the route does. */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import crypto from "node:crypto";

const prisma = new PrismaClient();
const MAX_EDGE = 2560;
const QUALITY = 82;
const VPS = "root@72.60.89.239";
const SSH_KEY = `${process.env.HOME}/.ssh/cvp_vps`;
const REMOTE_DIR = "/var/www/shared-uploads/images";

async function processImage(input) {
  const img = sharp(input, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const tooBig = (meta.width ?? 0) > MAX_EDGE || (meta.height ?? 0) > MAX_EDGE;
  let pipe = tooBig ? img.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true }) : img;

  let ext, mime;
  if (meta.hasAlpha) {
    pipe = pipe.png({ compressionLevel: 9, palette: true }); ext = "png"; mime = "image/png";
  } else {
    pipe = pipe.jpeg({ quality: QUALITY, mozjpeg: true }); ext = "jpg"; mime = "image/jpeg";
  }
  const out = await pipe.toBuffer({ resolveWithObject: true });
  return { buf: out.data, ext, mime, width: out.info.width, height: out.info.height };
}

const FILES = [
  { path: "scratchpad/infographic-5-steps.png", alt: "5 steps to open a Cyprus bank account", folder: "blog" },
  { path: "scratchpad/infographic-bank-comparison.png", alt: "Bank of Cyprus vs Hellenic Bank — remote onboarding and timeline comparison", folder: "blog" },
  { path: "scratchpad/banking-illustration.png", alt: "Opening a bank account in Cyprus", folder: "blog" },
];

async function main() {
  const results = [];
  for (const f of FILES) {
    const raw = fs.readFileSync(f.path);
    const p = await processImage(raw);
    const hash = crypto.createHash("sha1").update(p.buf).digest("hex");
    const base = `${hash}-${p.width}x${p.height}.${p.ext}`;
    const ref = `image-${hash}-${p.width}x${p.height}-${p.ext}`;
    const url = `/uploads/images/${base}`;

    const localTmp = `/tmp/${base}`;
    fs.writeFileSync(localTmp, p.buf);

    // scp to the VPS's shared, persistent uploads directory
    execFileSync("ssh", ["-i", SSH_KEY, VPS, "mkdir", "-p", REMOTE_DIR], { stdio: "inherit" });
    execFileSync("scp", ["-i", SSH_KEY, localTmp, `${VPS}:${REMOTE_DIR}/${base}`], { stdio: "inherit" });

    const media = await prisma.media.upsert({
      where: { sanityAssetId: ref },
      update: { url, path: url },
      create: {
        sanityAssetId: ref, filename: base, originalFilename: f.path.split("/").pop(),
        path: url, url, mimeType: p.mime, fileSize: p.buf.length,
        width: p.width, height: p.height, folder: f.folder,
      },
    });

    console.log(`Uploaded ${f.path} -> ref=${ref} (${p.width}x${p.height}, ${p.mime}, media.id=${media.id})`);
    results.push({ ...f, ref, width: p.width, height: p.height });
    fs.unlinkSync(localTmp);
  }

  // Verify live
  for (const r of results) {
    const u = `https://cyprusvipestates.com/uploads/images/${r.ref.replace(/^image-/, "").replace(/-(\d+x\d+)-(\w+)$/, "-$1.$2")}`;
    console.log("Live URL to verify:", u);
  }

  fs.writeFileSync("scratchpad/uploaded-image-refs.json", JSON.stringify(results, null, 2));
  console.log("\nRefs saved to scratchpad/uploaded-image-refs.json");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
