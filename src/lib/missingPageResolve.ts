// Where a URL that matches no page should be redirected instead of answering 404.
//
// House rule (2026-10-12): the public site never leaves a content URL on a 404.
// Pure logic with an injected repository so it is unit-testable without a
// database; the Prisma-backed wiring lives in missingPageRedirect.ts.
//
// Order of preference, always a single hop to a page that really renders:
//   1. the same article/page in the REQUESTED locale (translationGroupId sibling)
//   2. the English sibling (the site's default language), when the requested
//      locale has no translation
//   3. the article/page in its own language (the slug exists, only the language
//      prefix on the URL is wrong)
//   4. for landing pages: the nearest existing parent path
//   5. the section index in the requested locale (/blog, /projects, ...), or the
//      locale's homepage for landing pages
//
// Scanner junk (wp-admin, *.php, .env, very deep paths) is not a content URL and
// keeps its 404: sending every probe to the homepage would only create soft-404s.

export type MissingKind = "blog" | "page" | "project" | "developer" | "caseStudy";

export interface SlugRow {
  language: string;
  slug: string;
  translationGroupId: string | null;
}

export interface MissingRepo {
  /** PUBLISHED blog rows with exactly this slug, any language. */
  blogsBySlug(slug: string): Promise<SlugRow[]>;
  blogSibling(groupId: string, language: string): Promise<SlugRow | null>;
  /** PUBLISHED landing pages whose full slug ("parent/child") equals `slug`, any language. */
  pagesBySlug(slug: string): Promise<SlugRow[]>;
  /** PUBLISHED landing pages in `language` whose slug ends with "/<last>" (a child reached without its parent). */
  pagesEndingWith(language: string, last: string): Promise<SlugRow[]>;
  pageSibling(groupId: string, language: string): Promise<SlugRow | null>;
  pageExists(language: string, slug: string): Promise<boolean>;
}

export interface MissingEnv {
  isPublicLocale(lang: string): boolean;
  href(lang: string, segments: string[]): string;
}

const PUBLIC_LOCALE_CODES = ["en", "de", "pl", "ru", "he"];

const SECTION_INDEX: Record<Exclude<MissingKind, "page">, string> = {
  blog: "blog",
  project: "projects",
  developer: "developers",
  caseStudy: "case-studies",
};

const SCANNER_SEGMENTS = new Set([
  "wp-admin", "wp-login", "wp-content", "wp-includes", "wp-json", "xmlrpc", "phpmyadmin",
  "cgi-bin", "administrator", "admin", "login", "backup", "config", "vendor", "node_modules",
]);

// No `u` flag (the project compiles for an older target): instead of whitelisting letters,
// refuse anything that makes a segment a file, an escape or a probe: dots, slashes, quotes,
// percent-encoding, whitespace and other punctuation. Cyrillic/Polish/German letters pass.
const BAD_SEGMENT = /[\s.\/\\?#%:;@<>"'`|*&=+$,!()\[\]{}~^]/;

/** A real content path: 1-4 segments, none empty, with a file/escape/probe character or a scanner target. */
export function looksLikeContentPath(segments: string[]): boolean {
  if (segments.length < 1 || segments.length > 4) return false;
  return segments.every((s) => s.length > 0 && s.length <= 140 && s[0] !== "-" && !BAD_SEGMENT.test(s) && !SCANNER_SEGMENTS.has(s.toLowerCase()));
}

const prefer = (rows: SlugRow[], isPublic: (l: string) => boolean): SlugRow | null => {
  const ok = rows.filter((r) => isPublic(r.language));
  return ok.find((r) => r.language === "en") ?? ok[0] ?? null;
};

export async function resolveMissing(
  repo: MissingRepo,
  env: MissingEnv,
  req: { kind: MissingKind; lang: string; segments: string[] },
): Promise<string | null> {
  const { kind, lang, segments } = req;

  // A link written "https:/cyprusvipestates.com/en/case-studies" (one slash) inside a page is read
  // as a relative path and arrives here as ["https:", "cyprusvipestates.com", "en", "case-studies"].
  // Our own host: send the visitor where the author meant. Another host: not ours, keep the 404.
  if (/^https?:$/i.test(segments[0] ?? "")) {
    if (!/^(www\.)?cyprusvipestates\.com$/i.test(segments[1] ?? "")) return null;
    let rest = segments.slice(2);
    let target = lang;
    if (rest.length && PUBLIC_LOCALE_CODES.includes(rest[0])) { target = rest[0]; rest = rest.slice(1); }
    return looksLikeContentPath(rest) || rest.length === 0 ? env.href(target, rest) : null;
  }

  if (!looksLikeContentPath(segments)) return null;
  const self = env.href(lang, kind === "page" ? segments : [SECTION_INDEX[kind], ...segments]);
  const ok = (t: string | null | undefined): string | null => (t && t !== self ? t : null);

  if (kind === "blog") {
    const rows = await repo.blogsBySlug(segments[0]);
    const row = prefer(rows, env.isPublicLocale);
    if (row) {
      if (row.translationGroupId && env.isPublicLocale(lang)) {
        const sib = await repo.blogSibling(row.translationGroupId, lang);
        const t = sib && ok(env.href(lang, ["blog", sib.slug]));
        if (t) return t;
      }
      if (row.translationGroupId && lang !== "en") {
        const en = await repo.blogSibling(row.translationGroupId, "en"); // default language beats the source language
        const t = en && ok(env.href("en", ["blog", en.slug]));
        if (t) return t;
      }
      const own = ok(env.href(row.language, ["blog", row.slug]));
      if (own) return own;
    }
    return ok(env.href(lang, ["blog"]));
  }

  if (kind === "page") {
    const full = segments.join("/");
    const flat = await repo.pagesEndingWith(lang, segments[segments.length - 1]);
    const child = flat.find((r) => r.slug !== full);
    if (child) {
      const t = ok(env.href(lang, child.slug.split("/")));
      if (t) return t;
    }
    const row = prefer((await repo.pagesBySlug(full)).filter((r) => r.language !== lang), env.isPublicLocale);
    if (row) {
      if (row.translationGroupId && env.isPublicLocale(lang)) {
        const sib = await repo.pageSibling(row.translationGroupId, lang);
        const t = sib && ok(env.href(lang, sib.slug.split("/")));
        if (t) return t;
      }
      if (row.translationGroupId && lang !== "en") {
        const en = await repo.pageSibling(row.translationGroupId, "en");
        const t = en && ok(env.href("en", en.slug.split("/")));
        if (t) return t;
      }
      const own = ok(env.href(row.language, row.slug.split("/")));
      if (own) return own;
    }
    for (let i = segments.length - 1; i >= 1; i--) {
      const parent = segments.slice(0, i);
      if (await repo.pageExists(lang, parent.join("/"))) return ok(env.href(lang, parent));
    }
    return ok(env.href(lang, []));
  }

  return ok(env.href(lang, [SECTION_INDEX[kind]]));
}
