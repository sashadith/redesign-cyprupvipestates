// Turns a CRM-stored phone number into the MSISDN WhatsApp addresses.
// Deliberately NOT the reconciliation's last-9-digit comparison: there is no
// join here, the number comes from the lead record the caller named, so this
// only reformats. Reintroducing fuzzy matching would let a wrong lead be
// addressed — see the design doc.
const MIN_MSISDN_DIGITS = 8;
const MAX_MSISDN_DIGITS = 15; // E.164

export function toMsisdn(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length < MIN_MSISDN_DIGITS || digits.length > MAX_MSISDN_DIGITS) return null;
  return digits;
}

export function chatIdFor(phone: string | null | undefined): string | null {
  const msisdn = toMsisdn(phone);
  return msisdn ? `${msisdn}@c.us` : null;
}
