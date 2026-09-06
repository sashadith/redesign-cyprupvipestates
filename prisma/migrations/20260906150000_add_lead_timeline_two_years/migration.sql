-- Adds the "Within 2 years" step to the lead timeline.
-- Purely additive: no existing row changes, no value is removed. THREE_MONTHS
-- and SIX_MONTHS stay in the type because four leads still carry them, even
-- though the forms no longer offer them.
ALTER TYPE "LeadTimeline" ADD VALUE IF NOT EXISTS 'TWO_YEARS';
