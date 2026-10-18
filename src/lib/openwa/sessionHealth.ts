// What the WhatsApp health cron should do about the gateway session it just
// looked at. Pure — the route does the I/O.
//
// Why this exists (2026-10-18): the gateway container restarted on 10-17 09:36
// UTC, the session's auto-start hit "event bridge never attached", and OpenWA
// marked it `failed` while keeping the saved credentials. Docker's health check
// stayed green because it never looks at the session, so for ~25 hours the CRM
// read empty threads, refused sends and dropped inbound messages without a word.
// A plain POST /start fixed it in ten seconds. This makes that the automatic
// first response and tells the operator only when it did not work.

export type SessionStatus =
  | "created" | "initializing" | "qr_ready" | "authenticating" | "ready"
  | "disconnected" | "action_required" | "failed";

/** `null` = the gateway did not answer at all. */
export type Observation = { status: string; lastError: string | null } | null;

export type HealthHistory = {
  /** Unhealthy runs in a row, INCLUDING this one. */
  consecutiveBad: number;
  /** Minutes since this cron last tried POST /start; null = never. */
  minutesSinceRestart: number | null;
};

export type HealthDecision = {
  ok: boolean;
  restart: boolean;
  /** "pairing" = a human must scan a QR code / re-link; "down" = still broken after self-repair. */
  alert: "down" | "pairing" | null;
};

// Statuses a restart cannot fix: WhatsApp wants the phone.
const NEEDS_PHONE = new Set(["qr_ready", "action_required"]);
// Statuses that are normal for a minute while a session comes up.
const TRANSIENT = new Set(["created", "initializing", "authenticating"]);

// Long enough for one start attempt to settle (it reached `ready` in ~10 s on
// 10-18, the bridge timeout that killed it on 10-17 is ~90 s).
export const RESTART_COOLDOWN_MIN = 15;
// Runs every 5 minutes: 2 = ~10 min broken, 3 = ~15 min stuck coming up.
const BAD_RUNS_BEFORE_ALERT = 2;
const TRANSIENT_RUNS_BEFORE_ACTION = 3;

export function decideHealthAction(obs: Observation, h: HealthHistory): HealthDecision {
  if (obs && obs.status === "ready") return { ok: true, restart: false, alert: null };

  // Gateway unreachable: nothing to restart from here, but say so if it lasts.
  if (!obs) return { ok: false, restart: false, alert: h.consecutiveBad >= BAD_RUNS_BEFORE_ALERT ? "down" : null };

  if (NEEDS_PHONE.has(obs.status)) return { ok: false, restart: false, alert: "pairing" };

  const cooledDown = h.minutesSinceRestart === null || h.minutesSinceRestart >= RESTART_COOLDOWN_MIN;

  if (TRANSIENT.has(obs.status)) {
    const stuck = h.consecutiveBad >= TRANSIENT_RUNS_BEFORE_ACTION;
    return { ok: false, restart: stuck && cooledDown, alert: stuck ? "down" : null };
  }

  // failed, disconnected, or a status this code has never seen: restart first,
  // alert only when that has already been tried and the session is still down.
  return { ok: false, restart: cooledDown, alert: h.consecutiveBad >= BAD_RUNS_BEFORE_ALERT ? "down" : null };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Telegram HTML, English (admin-facing). WhatsApp itself is the broken channel, so Telegram only. */
export function healthAlertText(kind: "down" | "pairing" | "recovered", obs: Observation, restarted: boolean): string {
  if (kind === "recovered") {
    return "✅ <b>WhatsApp gateway is back</b>\nSession is ready again. CRM threads, sends and inbound messages work.";
  }
  const state = obs ? `Status: <b>${esc(obs.status)}</b>${obs.lastError ? `\nError: ${esc(obs.lastError.slice(0, 300))}` : ""}` : "The gateway did not answer (container down or unreachable).";
  if (kind === "pairing") {
    return [
      "📵 <b>WhatsApp gateway needs the phone</b>",
      state,
      "The session has to be linked again. Open https://wa.cyprusvipestates.com, start session cve-whatsapp and scan the QR code with WhatsApp on the business phone (Settings → Linked devices → Link a device).",
      "Until then: no CRM WhatsApp threads, no sends, no team-group lead alerts, inbound messages are not recorded.",
    ].join("\n");
  }
  return [
    "⚠️ <b>WhatsApp gateway is down</b>",
    state,
    restarted ? "An automatic restart was just attempted; the next check runs in 5 minutes." : "Automatic restart already tried in the last 15 minutes without success.",
    "Until fixed: no CRM WhatsApp threads, no sends, no team-group lead alerts, inbound messages are not recorded.",
  ].join("\n");
}
