import { anthropic, AI_MODEL } from "./anthropic";
import mammoth from "mammoth";

/* Pull genuinely useful marketing copy out of a developer's supporting documents
   (a "Project Information" Word doc, a Presentation/Specifications PDF, …) —
   these often contain good sales copy (overview paragraphs, "Features include"
   bullet lists) that the price list itself never has. Used as extra sourceText
   for generateProjectDescription so it gets rewritten instead of ignored. */

// Word docs — plain text extraction, no AI needed.
export async function extractTextFromDocx(buf: Buffer): Promise<string> {
  try {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return (value || "").trim();
  } catch {
    return "";
  }
}

// PDFs — Claude reads it natively and pulls out only the descriptive text,
// ignoring price tables, unit lists, legal boilerplate and contact details.
export async function extractTextFromPdf(base64: string): Promise<string> {
  const client = anthropic();
  if (!client) return "";
  try {
    const msg = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          // Prompt-caching evaluated: skipped — ~110 tokens, well under the
          // 1024-token floor, and (same as pdfExtract.ts) the PDF document block
          // above precedes this text, so it isn't a leading prefix either.
          {
            type: "text",
            text: `Extract ONLY the descriptive marketing text and bullet-point features/specifications from this document (overview paragraphs, "Features include"-style lists, unique selling points). Ignore price tables, unit lists, legal boilerplate, and contact details. Return plain text, verbatim or lightly cleaned up — no commentary of your own, no headings you invented. If there's nothing relevant, return an empty string.`,
          },
        ],
      }],
    });
    const block = msg.content.find((b: any) => b.type === "text") as any;
    return (block?.text || "").trim();
  } catch {
    return "";
  }
}
