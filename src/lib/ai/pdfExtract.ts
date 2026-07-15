import { anthropic, AI_MODEL } from "./anthropic";
import { tuningBlock, type Tuning } from "./tuning";

/* Extract structured project data from developer PDFs (brochure + price list).
   Claude reads the PDFs natively; forced tool use guarantees a clean schema.
   Used to pre-fill thin-feed projects (Domenica/Pafilia/Medousa) in the admin —
   the human reviews before saving, nothing is auto-published. */

export type ExtractedUnit = {
  ref: string;
  type?: string;
  block?: string;
  beds?: number;
  baths?: number;
  internalM2?: number;
  verandaM2?: number;
  totalM2?: number;
  price?: number;
  status: "available" | "sold" | "reserved";
};

export type ExtractedProject = {
  name: string;
  tagline?: string;
  description: string;
  developer?: string;
  completion?: string;
  vatApplies?: boolean;
  priceFrom?: number;
  priceTo?: number;
  amenities: string[];
  pois: { label: string; distance: string }[];
  units: ExtractedUnit[];
};

const SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "The project's real marketing name (e.g. 'Eniko Mare')" },
    tagline: { type: "string", description: "Short tagline if present" },
    description: { type: "string", description: "Marketing description of the development, 2-4 sentences, no invented facts" },
    developer: { type: "string", description: "Developer/company name if stated" },
    completion: { type: "string", description: "Completion or delivery date, e.g. 'Q2 2028'" },
    vatApplies: { type: "boolean", description: "true if prices are subject to VAT / ex. VAT" },
    priceFrom: { type: "number", description: "Lowest AVAILABLE price in EUR, digits only (no currency, no separators)" },
    priceTo: { type: "number", description: "Highest available price in EUR, digits only" },
    amenities: { type: "array", items: { type: "string" }, description: "Facilities & specifications, one per item" },
    pois: {
      type: "array",
      description: "Nearby points of interest with distances",
      items: { type: "object", properties: { label: { type: "string" }, distance: { type: "string" } }, required: ["label", "distance"] },
    },
    units: {
      type: "array",
      description: "Every unit in the price list, including sold ones",
      items: {
        type: "object",
        properties: {
          ref: { type: "string", description: "Unit reference, e.g. 'A101'" },
          type: { type: "string", description: "Property TYPE (kind of home), e.g. Apartment, Penthouse, Studio, Villa, Detached House, Semi-Detached House, Townhouse, Office, Commercial — NOT the bedroom count" },
          block: { type: "string" },
          beds: { type: "integer" },
          baths: { type: "integer" },
          internalM2: { type: "number", description: "Internal covered area in m²" },
          verandaM2: { type: "number", description: "Covered veranda area in m²" },
          totalM2: { type: "number", description: "Total covered area in m²" },
          price: { type: "number", description: "Price in EUR digits only; omit if sold/not priced" },
          status: { type: "string", enum: ["available", "sold", "reserved"] },
        },
        required: ["ref", "status"],
      },
    },
  },
  required: ["name", "description", "amenities", "units"],
};

// Prompt-caching evaluated: skipped. ~245 tokens, under Sonnet's 1024-token floor
// — and even if it weren't, the PDF document blocks precede this text in `content`
// (see extractProjectFromPdfs below), so the large/variable part would be the
// prefix and this static text the suffix, the opposite of what cache_control needs
// (it caches everything up to and including the marked block, so the cacheable
// unit must be a stable LEADING prefix). Reordering to fix that would put PDF
// binary content ahead of the instructions, which risks changing how the model
// reads them — out of scope for a caching-only change.
const PROMPT = `You are given a property developer's PDFs for ONE residential project (typically a brochure plus a price list). Extract the structured project data and return it via the project_data tool.

Rules:
- Use ONLY what the documents state — never invent prices, dates, or features.
- Include EVERY unit from the price list, including SOLD ones (set status accordingly). "SOLD" → status "sold" and omit price.
- priceFrom/priceTo = the AVAILABLE units' price range only.
- Each unit's "type" = the KIND of property (Apartment, Penthouse, Villa, Semi-Detached House, Office, Commercial …), inferred from the brochure — NOT the bedroom count.
- amenities = the facilities/specifications list (pool, gym, roof terrace, etc.), one clean item each.
- pois = nearby points of interest with their distances (beach, airport, city centre, etc.).
- description = the development's marketing description, concise, no headings.`;

export async function extractProjectFromPdfs(pdfs: { base64: string }[], tuning?: Tuning): Promise<ExtractedProject | null> {
  const client = anthropic();
  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");

  const content: any[] = pdfs.map((p) => ({
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: p.base64 },
  }));
  content.push({ type: "text", text: PROMPT + tuningBlock(tuning) });

  const msg = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 8000,
    tools: [{ name: "project_data", description: "Structured data for one residential project.", input_schema: SCHEMA as any }],
    tool_choice: { type: "tool", name: "project_data" },
    messages: [{ role: "user", content }],
  });

  const tool = msg.content.find((b: any) => b.type === "tool_use") as any;
  return (tool?.input as ExtractedProject) ?? null;
}
