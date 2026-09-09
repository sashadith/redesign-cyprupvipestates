import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/crm/updateLeadStatus";
import { PROPERTY_VALUES } from "@/app/components/qualifierFields";

// Input contract of crm_create_lead, prisma-free for the pure test. Mirrors
// the admin "New lead" form: first name required, email optional but valid
// when given, the same enums the form offers. Source is always MANUAL and
// the assignee is the operator — neither is an input.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CreateLeadInput = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().max(100).optional(),
    email: z.string().trim().max(200).optional().describe("Optional (WhatsApp-only leads often have none) but must be a valid address when given."),
    phone: z.string().trim().max(40).optional(),
    nationality: z.string().trim().max(80).optional(),
    languagePreference: z.enum(["en", "de", "pl", "ru"]).optional(),
    budgetMin: z.number().int().nonnegative().optional(),
    budgetMax: z.number().int().nonnegative().optional(),
    timeline: z.enum(["IMMEDIATE", "THREE_MONTHS", "SIX_MONTHS", "ONE_YEAR", "TWO_YEARS", "JUST_LOOKING"]).optional(),
    financing: z.enum(["CASH", "MORTGAGE", "UNDECIDED"]).optional(),
    propertyTypeInterest: z.array(z.enum(PROPERTY_VALUES)).max(5).optional(),
    message: z.string().trim().max(4000).optional().describe("What the lead asked for, in their words."),
    notes: z.string().trim().max(4000).optional().describe("Internal notes."),
    status: z.enum([...LEAD_STATUSES]).default("NEW"),
    allowDuplicate: z.boolean().default(false).describe("Create even if an active lead with the same email or phone exists. Default false: the existing lead is returned instead."),
  })
  .superRefine((v, ctx) => {
    if (v.email && !EMAIL_RE.test(v.email)) ctx.addIssue({ code: "custom", path: ["email"], message: "email is not a valid address." });
    if (v.budgetMin != null && v.budgetMax != null && v.budgetMin > v.budgetMax) ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "budgetMax must be ≥ budgetMin." });
  });

export type CreateLeadInputType = z.infer<typeof CreateLeadInput>;
