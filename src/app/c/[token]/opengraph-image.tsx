import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getDbProjectsByIds } from "@/lib/developmentRender";
import { absUrl } from "@/lib/indexnow";
import { atSize } from "@/app/preview-project/imageSize";
import { asPLocale } from "./copy";
import { formatLocationLine, formatResidenceCount, ogHeadline } from "./ogCopy";

// 2026-08-11 — dynamic, per-presentation link-preview image. Runs in the
// default Node.js runtime (NOT edge) because it reads local font files off
// disk — next/font/google's Fraunces/Mulish are only ever exposed as
// build-time-hashed CSS, never as a buffer ImageResponse (satori) can embed,
// so the two weights actually used here are checked-in TTFs instead (see
// ./fonts/). Fetching them from Google Fonts at request time was considered
// and rejected: this VPS has already shown transient failures fetching
// Google Fonts mid-build this same day (see DEPLOYMENT.md-adjacent incident
// notes) — a link-preview scraper is exactly the kind of caller that won't
// retry, so a request-time external dependency here would be a real
// flakiness risk for zero benefit over a 70KB checked-in file.
//
// PUBLIC ROUTE — same as the page itself (src/middleware.ts excludes "c/"
// from the [lang] tree entirely; nothing here calls requireSession/auth()).
// WhatsApp/LinkedIn/iMessage scrapers fetch this with no cookies, exactly
// like any other unauthenticated request — confirmed by reading
// middleware.ts rather than assumed.
export const alt = "Cyprus VIP Estates — a personal property selection";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = "#C9A876";
const GOLD_DIM = "rgba(201,168,118,0.55)";
const LOGO_URL = "https://cyprusvipestates.com/uploads/images/862e62ebddfc232ff9838efb63eb28685b515eb4-400x208.png";

// satori (ImageResponse's renderer) can't decode WebP — confirmed directly
// ("Can't load image ...: Unsupported image type: image/webp" in dev),
// which every hero photo on this site is (see imageMirror.ts). Re-encoding
// through sharp (already a dependency — same one api/admin/upload/route.ts
// uses) sidesteps that entirely rather than depending on satori ever
// growing WebP support. JPEG q82 matches the quality the upload pipeline
// already settled on for photos. Returns null on any fetch/decode failure
// so a broken source image degrades to the plain gradient background
// instead of failing the whole link preview.
async function heroImageDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const jpeg = await sharp(input).resize(1200, 630, { fit: "cover" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: { token: string } }) {
  // Fraunces has no Cyrillic subset on Google Fonts at all (confirmed —
  // same reason layout.tsx pairs it with a second display face, Playfair
  // Display's cyrillic subset, for RU content: --font-display vs
  // --font-display-cyr). Embedding only Fraunces silently rendered RU
  // headlines in whatever system fallback satori reaches for — caught by
  // actually looking at a rendered RU test image, not assumed.
  const [fraunces, mulish, playfairCyr] = await Promise.all([
    readFile(join(process.cwd(), "src/app/c/[token]/fonts/Fraunces-500.ttf")),
    readFile(join(process.cwd(), "src/app/c/[token]/fonts/Mulish-600.ttf")),
    readFile(join(process.cwd(), "src/app/c/[token]/fonts/PlayfairDisplay-500-cyr.ttf")),
  ]);

  const presentation = await prisma.clientPresentation.findUnique({
    where: { token: params.token },
    select: {
      status: true,
      expiresAt: true,
      greetingName: true,
      locale: true,
      items: { orderBy: { sortIndex: "asc" }, select: { developmentId: true } },
    },
  });

  // Same "usable" gate as page.tsx's NotAvailable branch — an expired/
  // revoked link's preview shouldn't keep advertising the client's name and
  // selection after the page itself now says "no longer available". Unlike
  // page.tsx, this route never flips an overdue "active" row to "expired"
  // itself — that write belongs to the actual page view, not a link-preview
  // scraper that may hit this route many times from different platforms.
  const isExpired = !!presentation?.expiresAt && presentation.expiresAt < new Date();
  const usable = !!presentation && presentation.status === "active" && !isExpired;

  const locale = asPLocale(presentation?.locale);
  const devIds = usable ? presentation!.items.map((i) => i.developmentId) : [];
  const firstDevId = devIds[0];

  // Only the first item needs the full view-model (hero image + district);
  // the rest just need to exist — a cheap count(), not a second
  // getDbProjectsByIds() call, since that also resolves galleries/units for
  // developments whose photo we'll never use here.
  const [firstDevMap, validCount] = await Promise.all([
    firstDevId
      ? getDbProjectsByIds([firstDevId], locale)
      : Promise.resolve({} as Awaited<ReturnType<typeof getDbProjectsByIds>>),
    devIds.length ? prisma.development.count({ where: { id: { in: devIds } } }) : Promise.resolve(0),
  ]);
  const firstDev = firstDevId ? firstDevMap[firstDevId] : undefined;
  const heroImageUrl = firstDev?.gallery[0] ? absUrl(atSize(firstDev.gallery[0], "medium")) : null;
  const heroImage = heroImageUrl ? await heroImageDataUri(heroImageUrl) : null;
  const place = firstDev?.district || firstDev?.town || null;

  const headline = ogHeadline(locale, usable ? presentation!.greetingName : null);
  const headlineFont = locale === "ru" ? "PlayfairDisplayCyr" : "Fraunces";
  const metaLine = usable
    ? `${formatResidenceCount(locale, validCount)} · ${formatLocationLine(locale, place)}`
    : formatLocationLine(locale, null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "relative",
          backgroundColor: "#1A1815",
          fontFamily: "Mulish",
        }}
      >
        {heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            width={1200}
            height={630}
            alt=""
            style={{ position: "absolute", top: 0, left: 0, width: "1200px", height: "630px", objectFit: "cover" }}
          />
        )}
        {/* Bottom-up dark gradient — a full-bleed photo needs this for the
            text to stay readable regardless of what's in the source image;
            also darkens the whole frame toward the site's near-black. */}
        <div
          style={{
            position: "absolute", top: 0, left: 0, width: "1200px", height: "630px",
            background: "linear-gradient(180deg, rgba(15,13,11,0.55) 0%, rgba(15,13,11,0.7) 45%, rgba(10,9,7,0.96) 100%)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", position: "relative", padding: "64px 80px 72px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_URL} width={132} height={69} alt="" style={{ width: "132px", height: "69px", objectFit: "contain", marginBottom: "36px" }} />
          <div
            style={{
              display: "flex",
              fontFamily: headlineFont,
              fontWeight: 500,
              fontSize: 58,
              lineHeight: 1.15,
              color: "#F5F1EA",
              maxWidth: "920px",
            }}
          >
            {headline}
          </div>
          <div style={{ display: "flex", width: "88px", height: "2px", backgroundColor: GOLD, margin: "28px 0 22px" }} />
          <div
            style={{
              display: "flex",
              fontFamily: "Mulish",
              fontWeight: 600,
              fontSize: 20,
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: GOLD_DIM,
            }}
          >
            {metaLine}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: fraunces, weight: 500, style: "normal" },
        { name: "Mulish", data: mulish, weight: 600, style: "normal" },
        { name: "PlayfairDisplayCyr", data: playfairCyr, weight: 500, style: "normal" },
      ],
    },
  );
}
