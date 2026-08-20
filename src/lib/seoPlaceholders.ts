// The {placeholder} tokens that stored SEO text may carry instead of a live
// figure. Resolved on every render by applySeoPlaceholders() in
// src/lib/developmentSeo.ts — see the block comment there for why they exist.
//
// Deliberately its own module, with NO imports: both the server-side resolver
// and the admin editor (a client component) need this list, and
// developmentSeo.ts pulls in @/lib/prisma, which instantiates a PrismaClient at
// module scope and must never reach the browser bundle.
export const SEO_PLACEHOLDERS = ["priceFrom", "unitsAvailable", "completion"] as const;

export type SeoPlaceholder = (typeof SEO_PLACEHOLDERS)[number];
