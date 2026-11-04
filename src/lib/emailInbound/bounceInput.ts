import type { ParsedMail } from "mailparser";
import type { BounceInput } from "./bounce";

// mailparser's ParsedMail → the plain shape parseBounce reads. The report parts (delivery-status,
// original headers) arrive as attachments; only small text parts are read.
export function bounceInput(parsed: ParsedMail): BounceInput {
  const header = (name: string): string | null => {
    const v = parsed.headers.get(name);
    if (v == null) return null;
    if (typeof v === "string") return v;
    if (typeof v === "object" && "value" in v) {
      const params = (v as { params?: Record<string, string> }).params ?? {};
      return [String((v as { value: unknown }).value), ...Object.entries(params).map(([k, p]) => `${k}=${p}`)].join("; ");
    }
    return String(v);
  };
  return {
    from: parsed.from?.value?.[0]?.address ?? null,
    subject: parsed.subject ?? null,
    text: parsed.text ?? null,
    failedRecipientsHeader: header("x-failed-recipients"),
    contentType: header("content-type"),
    attachments: (parsed.attachments ?? [])
      .filter((a) => /delivery-status|rfc822/i.test(a.contentType) && a.size < 200_000)
      .map((a) => ({ contentType: a.contentType, content: a.content.toString("utf8") })),
  };
}
