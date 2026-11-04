import type { IntakeFields } from "./intake";

// Client-side half of the Claude intake: turns the parsed fields into a patch
// for the new-lead form. Only empty form fields are filled — what the operator
// already typed always wins. Kept apart from intake.ts so the form does not
// pull the Anthropic client into the browser bundle.

type FormState = Record<string, string>;

const LABELS: [key: string, label: string][] = [
  ["firstName", "First name"], ["lastName", "Last name"], ["email", "Email"], ["phone", "Phone"],
  ["languagePreference", "Language"], ["budgetMin", "Budget from (EUR)"], ["budgetMax", "Budget to (EUR)"],
  ["timeline", "Timeline"], ["financing", "Financing"], ["message", "What the lead asked for"],
];

export function intakeToFormPatch(form: FormState, fields: IntakeFields): { patch: FormState; filled: string[] } {
  const { propertyTypes, interestText, ...rest } = fields;
  const values: FormState = {};
  for (const [k, v] of Object.entries(rest)) if (v !== undefined && v !== null) values[k] = String(v);
  const message = [interestText, propertyTypes?.length ? `Property types: ${propertyTypes.join(", ")}` : null].filter(Boolean).join("\n");
  // Marked so nobody mistakes Claude's wording for the lead's own words.
  if (message) values.message = `(from pasted text) ${message}`;

  const patch: FormState = {};
  const filled: string[] = [];
  for (const [k, label] of LABELS) {
    if (values[k] === undefined || (form[k] ?? "").trim()) continue;
    patch[k] = values[k];
    filled.push(label);
  }
  return { patch, filled };
}
