export async function sendTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Not configured (e.g. staging) is a legitimate environment state, not an
  // error — skip silently rather than throw/log. Callers that need to know
  // whether a message actually went out check the return value (null here).
  if (!token || !chatId) return null;

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        link_preview_options: {
          is_disabled: true,
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram request failed: ${errorText}`);
  }

  return response.json();
}
