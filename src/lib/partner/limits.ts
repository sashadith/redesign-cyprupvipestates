/** Module-level throttles for the partner portal (server-only; per process, reset on restart). */
import { makeThrottle } from "./throttle";

const HOUR = 3_600_000;
const MIN15 = 15 * 60_000;

export const partnerLimits = {
  registerIp: makeThrottle(5, HOUR),
  registerEmail: makeThrottle(3, HOUR),
  loginIp: makeThrottle(20, MIN15),
  loginEmail: makeThrottle(5, MIN15),
  resendIp: makeThrottle(5, HOUR),
  resendEmail: makeThrottle(3, HOUR),
  forgotIp: makeThrottle(5, HOUR),
  forgotEmail: makeThrottle(3, HOUR),
  /** Submissions of e-mailed tokens (verify / reset). */
  tokenIp: makeThrottle(30, MIN15),
  changePassword: makeThrottle(5, MIN15),
  profile: makeThrottle(30, MIN15),
};

/** Throttle key for a request without a usable client IP (all such requests share one bucket). */
export const ipKey = (ip: string | null) => ip ?? "no-ip";
