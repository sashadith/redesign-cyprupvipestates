// Shared wa.me phone formatting — was duplicated across CockpitCard.tsx and
// both presentation API routes (api/admin/presentations/route.ts and
// [id]/route.ts), found during the Lead Cockpit correction-batch audit.
// Strips everything except digits and a leading "+", then drops that "+" —
// wa.me wants a bare international number, no "+". Assumes the stored phone
// is already in international form (does not add a country code).
export function formatWaPhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${formatWaPhone(phone)}?text=${encodeURIComponent(text)}`;
}
