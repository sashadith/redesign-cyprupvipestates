import type { ReactNode } from "react";

/**
 * Bidi-isolates a JSX value inside otherwise-RTL text — a price, phone
 * number, e-mail, URL, or Latin name — so it never gets visually reordered
 * by the surrounding Hebrew paragraph.
 *
 * `ltr`: also forces left-to-right direction on the isolated run (prices,
 * phone numbers, e-mails — anything whose own internal order must stay
 * fixed). Without it, the content is isolated but keeps its own natural
 * direction (Latin names inside Hebrew sentences).
 *
 * Pure server-safe markup — no client-only code — so it can be used from
 * both server and client components. See src/app/rtl.css for
 * .bidi-isolate / .ltr-isolate, and src/lib/locale.ts's ltrIsolate() for the
 * plain-string equivalent (copy tables, generated sentences).
 */
export default function Bdi({ children, ltr }: { children: ReactNode; ltr?: boolean }) {
  return <bdi className={ltr ? "ltr-isolate" : "bidi-isolate"}>{children}</bdi>;
}
