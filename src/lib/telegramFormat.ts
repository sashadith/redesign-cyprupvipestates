// Converts a short, single-line markdown fragment (bold/italic/code/links)
// to Telegram HTML — for LLM-authored freeform text (e.g. an SEO Advisor
// suggestion title) that might contain markdown emphasis the model wasn't
// told to avoid. Escapes entities first, same rule order as the Claude Code
// hook's converter (~/.claude/hooks/telegram-format.mjs), but scoped to
// inline-only since these are single lines, never headers/tables/code
// blocks. Do NOT run handcrafted alert templates (lead/presentation
// notifications, digest item titles) through this — they're already valid
// HTML and this would double-escape their tags.
export function mdInlineToTelegramHtml(raw: string): string {
  let text = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  text = text.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  text = text.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
  text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<i>$1</i>");
  text = text.replace(/(?<!_)_([^_\n]+)_(?!_)/g, "<i>$1</i>");
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  return text;
}
