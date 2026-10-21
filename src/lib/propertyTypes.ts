// Property types for a unit — the KIND of home, not the bedroom count.
// Since 2026-10-20 this is the one unit-type vocabulary (src/lib/unitType.ts):
// whatever the admin picks here is also what every sync writes.
import { UNIT_TYPES } from "./unitType";

export const PROPERTY_TYPES: string[] = [...UNIT_TYPES];
