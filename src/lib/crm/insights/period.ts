// Period presets for the Insights page, resolved to Cyprus-time boundaries.
// `from` is inclusive, `to` exclusive (the start of the day after the last day shown).
import { dayKey, CRM_TZ } from "../today";
import { zonedWallTimeToUtc } from "../../booking/timezone";

export const PERIOD_PRESETS = ["this_month", "last_3_months", "this_year", "last_12_months", "custom"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export type ResolvedPeriod = {
  preset: PeriodPreset;
  from: Date;
  to: Date;
  fromKey: string; // first day shown, "YYYY-MM-DD" in Cyprus time
  toKey: string; // last day shown (inclusive)
};

const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseKey(key: string | undefined): [number, number, number] | null {
  const m = key ? KEY.exec(key) : null;
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return [y, mo, d];
}

const startOfDay = (y: number, mo: number, d: number) => zonedWallTimeToUtc(y, mo, d, 0, 0, CRM_TZ);
const fmt = (d: Date) => d.toISOString().slice(0, 10);

function build(preset: PeriodPreset, from: [number, number, number], to: [number, number, number]): ResolvedPeriod {
  const after = new Date(Date.UTC(to[0], to[1] - 1, to[2] + 1));
  return {
    preset,
    from: startOfDay(from[0], from[1], from[2]),
    to: startOfDay(after.getUTCFullYear(), after.getUTCMonth() + 1, after.getUTCDate()),
    fromKey: fmt(new Date(Date.UTC(from[0], from[1] - 1, from[2]))),
    toKey: fmt(new Date(Date.UTC(to[0], to[1] - 1, to[2]))),
  };
}

export function resolvePeriod(input: { preset?: string; from?: string; to?: string; now: Date }): ResolvedPeriod {
  const [y, m, d] = dayKey(input.now).split("-").map(Number);
  const today: [number, number, number] = [y, m, d];
  const monthsBack = (n: number): [number, number, number] => {
    const s = new Date(Date.UTC(y, m - 1 - n, 1));
    return [s.getUTCFullYear(), s.getUTCMonth() + 1, 1];
  };

  switch (input.preset) {
    case "last_3_months": return build("last_3_months", monthsBack(2), today);
    case "last_12_months": return build("last_12_months", monthsBack(11), today);
    case "this_year": return build("this_year", [y, 1, 1], today);
    case "custom": {
      const f = parseKey(input.from);
      const t = parseKey(input.to);
      if (f && t && Date.UTC(f[0], f[1] - 1, f[2]) <= Date.UTC(t[0], t[1] - 1, t[2])) {
        return build("custom", f, t);
      }
      break;
    }
  }
  return build("this_month", [y, m, 1], today);
}
