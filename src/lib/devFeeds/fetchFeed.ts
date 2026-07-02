// SSRF-safe fetch for developer feed URLs. The feed URL is admin-supplied, so we
// must stop it (or a redirect hop) from reaching internal/private addresses
// (loopback, link-local, RFC1918, ULA, cloud metadata, the shared Postgres, other
// VPS apps). Resolves each hostname via DNS and rejects private IPs; follows
// redirects manually, re-validating every hop; streams the body with a byte cap.

import { promises as dns } from "node:dns";
import net from "node:net";

// Parse an IPv4 dotted string to its 32-bit integer, or null.
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = (n << 8) | o;
  }
  return n >>> 0;
}

function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unpardseable → treat as blocked
  const inRange = (base: string, bits: number) => {
    const b = ipv4ToInt(base)!;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (b & mask);
  };
  return (
    inRange("0.0.0.0", 8) || // unspecified / "this network"
    inRange("10.0.0.0", 8) || // private
    inRange("100.64.0.0", 10) || // CGNAT
    inRange("127.0.0.0", 8) || // loopback
    inRange("169.254.0.0", 16) || // link-local (incl. cloud metadata 169.254.169.254)
    inRange("172.16.0.0", 12) || // private
    inRange("192.0.0.0", 24) || // IETF protocol assignments
    inRange("192.168.0.0", 16) || // private
    inRange("198.18.0.0", 15) || // benchmarking
    inRange("224.0.0.0", 4) || // multicast
    inRange("240.0.0.0", 4) // reserved
  );
}

function isBlockedIpv6(ip: string): boolean {
  const a = ip.toLowerCase();
  // IPv4-mapped (::ffff:1.2.3.4) → validate the embedded IPv4
  const mapped = a.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  if (a === "::" || a === "::1") return true; // unspecified / loopback
  if (a.startsWith("fe8") || a.startsWith("fe9") || a.startsWith("fea") || a.startsWith("feb")) return true; // fe80::/10 link-local
  if (a.startsWith("fc") || a.startsWith("fd")) return true; // fc00::/7 unique-local
  if (a.startsWith("ff")) return true; // multicast
  return false;
}

function isBlockedIp(ip: string): boolean {
  const fam = net.isIP(ip);
  if (fam === 4) return isBlockedIpv4(ip);
  if (fam === 6) return isBlockedIpv6(ip);
  return true; // not a valid IP → block
}

async function assertHostPublic(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (host.toLowerCase() === "localhost") throw new Error("URL resolves to a private/internal address.");
  // If it's already an IP literal, check it directly; otherwise resolve all A/AAAA.
  const literals = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((r) => r.address);
  if (literals.length === 0) throw new Error("Could not resolve feed host.");
  for (const ip of literals) {
    if (isBlockedIp(ip)) throw new Error("URL resolves to a private/internal address and was blocked.");
  }
}

/** Fetch a feed URL as text, SSRF-safe, size- and time-capped. Throws on any violation. */
export async function fetchFeedXml(rawUrl: string, maxBytes: number, timeoutMs = 20000): Promise<string> {
  let current = rawUrl;
  for (let hop = 0; hop < 4; hop++) {
    let u: URL;
    try {
      u = new URL(current);
    } catch {
      throw new Error("Invalid feed URL.");
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http(s) feed URLs are allowed.");
    if (u.username || u.password) throw new Error("URLs with embedded credentials are not allowed.");
    await assertHostPublic(u.hostname);

    const res = await fetch(u, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "CVE-FeedAnalyzer/1.0", accept: "application/xml,text/xml,*/*" },
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error(`Redirect (${res.status}) without a location.`);
      current = new URL(loc, u).toString(); // re-validate the next hop on the next loop
      continue;
    }
    if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);

    const declared = Number(res.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`Feed too large (> ${maxBytes / 1024 / 1024} MB).`);

    // Stream with a hard byte cap so an unbounded body can't exhaust memory.
    const reader = res.body?.getReader();
    if (!reader) return "";
    const chunks: Buffer[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new Error(`Feed too large (> ${maxBytes / 1024 / 1024} MB).`);
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("Too many redirects.");
}
