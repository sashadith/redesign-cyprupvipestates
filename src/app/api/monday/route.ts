// Legacy endpoint — lead capture moved off Monday.com to Postgres + Telegram/email.
// Re-exports the canonical handler so existing frontend forms keep working unchanged.
export { POST } from "@/app/api/leads/route";
