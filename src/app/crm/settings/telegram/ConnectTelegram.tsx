"use client";
import { useState, useTransition } from "react";
import { createTelegramLinkAction } from "./actions";

// One click creates a single-use code (valid 30 minutes) and shows the t.me link that hands it to the bot.
export function ConnectTelegram() {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (url) {
    return (
      <p>
        <a className="crm-btn primary" href={url} target="_blank" rel="noreferrer">Open Telegram and press Start</a>
        <span className="crm-hint"> The link works once, for 30 minutes. Reload this page afterwards.</span>
      </p>
    );
  }
  return (
    <p>
      <button
        type="button" className="crm-btn primary" disabled={pending}
        onClick={() => start(async () => {
          setError(null);
          const r = await createTelegramLinkAction();
          if (r.ok) setUrl(r.url);
          else setError(r.error);
        })}
      >
        {pending ? "Creating link…" : "Connect Telegram"}
      </button>
      {error && <span className="crm-err" role="alert"> {error}</span>}
    </p>
  );
}
