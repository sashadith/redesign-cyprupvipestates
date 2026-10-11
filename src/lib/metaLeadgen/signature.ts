import { createHmac, timingSafeEqual } from "crypto";

/** Meta signs the RAW request body with the app secret:
 *  X-Hub-Signature-256: sha256=<hex>. Compared in constant time. */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string | undefined): boolean {
  if (!appSecret || !header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const given = Buffer.from(header.slice("sha256=".length), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
