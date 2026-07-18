import { logCronRun } from "@/lib/cronLog";

// IndexNow — a shared protocol Bing, Yandex, Seznam, and Naver participate in
// (Google does NOT; that's what the GSC integration covers separately). No
// registration/console needed: the key itself IS the credential, proven by
// hosting a static file at https://cyprusvipestates.com/<key>.txt containing
// the key (see public/<INDEXNOW_KEY>.txt) — see indexnow.org for the spec.
const ENDPOINT = "https://api.indexnow.org/indexnow";
const SITE_URL = "https://cyprusvipestates.com";
const HOST = "cyprusvipestates.com";
const BATCH_CHUNK_SIZE = 1000; // IndexNow allows up to 10,000 URLs/request; chunk conservatively

export function isIndexNowConfigured(): boolean {
  return !!process.env.INDEXNOW_KEY;
}

function keyLocation(): string {
  return `${SITE_URL}/${process.env.INDEXNOW_KEY}.txt`;
}

// Fire-and-forget: NEVER throws (every internal step is caught). Call sites
// should invoke this WITHOUT awaiting it (`void pingIndexNow(...)`) so the
// real action's response never waits on IndexNow's network round-trip — this
// VPS runs a long-lived Node process (pm2), not serverless, so the promise
// keeps running to completion in the background after the caller returns.
// Every result (success or failure) is logged via CronRunLog under job
// "indexnow:<event>" so pings stay auditable even though nothing awaits them.
export async function pingIndexNow(event: string, urls: string[]): Promise<void> {
  if (!urls.length) return;
  if (!isIndexNowConfigured()) {
    await logCronRun(`indexnow:${event}`, false, "skipped: INDEXNOW_KEY not configured");
    return;
  }
  try {
    const chunks: string[][] = [];
    for (let i = 0; i < urls.length; i += BATCH_CHUNK_SIZE) chunks.push(urls.slice(i, i + BATCH_CHUNK_SIZE));

    for (const chunk of chunks) {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: HOST, key: process.env.INDEXNOW_KEY, keyLocation: keyLocation(), urlList: chunk }),
      });
      // IndexNow returns 200/202 on success; 200 if some URLs were already
      // known. Anything else is logged but still doesn't throw.
      if (!res.ok) {
        await logCronRun(`indexnow:${event}`, false, `HTTP ${res.status} for ${chunk.length} URL(s)`);
        continue;
      }
      await logCronRun(`indexnow:${event}`, true, `submitted ${chunk.length} URL(s)`);
    }
  } catch (e) {
    await logCronRun(`indexnow:${event}`, false, e instanceof Error ? e.message : String(e));
  }
}

export async function pingIndexNowUrl(event: string, url: string): Promise<void> {
  return pingIndexNow(event, [url]);
}

export function absUrl(path: string): string {
  return path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}
