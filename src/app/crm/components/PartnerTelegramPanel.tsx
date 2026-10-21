"use client";
import { useState, useTransition } from "react";
import { partnerTelegramStatusAction, registerPartnerTelegramWebhookAction } from "../partners/telegramActions";
import type { PartnerWebhookInfo } from "@/lib/partner/telegramApi";
import { useToast } from "./Toast";

/** Owner-only panel: webhook status on demand, and (re-)registering the webhook after a deploy. */
export function PartnerTelegramPanel({ configured, linkedCount }: { configured: boolean; linkedCount: number }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ info: PartnerWebhookInfo; expectedUrl: string } | null>(null);

  const check = () => start(async () => {
    const r = await partnerTelegramStatusAction();
    if ("error" in r) toast.show(r.error, "error");
    else setStatus({ info: r.info, expectedUrl: r.expectedUrl });
  });
  const register = () => start(async () => {
    const r = await registerPartnerTelegramWebhookAction();
    if ("error" in r) toast.show(r.error, "error");
    else {
      toast.show(r.notice);
      setStatus(null);
    }
  });

  return (
    <section className="crm-panel crm-pt-bot" aria-labelledby="pt-bot-title" aria-busy={pending}>
      <div className="crm-pt-bot-head">
        <h2 id="pt-bot-title">Telegram bot</h2>
        <span className="crm-pt-bot-count">{linkedCount} partner{linkedCount === 1 ? "" : "s"} linked</span>
      </div>
      {!configured ? (
        <p>Not configured. Set PARTNER_TELEGRAM_BOT_TOKEN, PARTNER_TELEGRAM_BOT_USERNAME and PARTNER_TELEGRAM_WEBHOOK_SECRET, then register the webhook.</p>
      ) : (
        <>
          <div className="crm-pt-actions">
            <button type="button" className="crm-btn" disabled={pending} onClick={check}>Check status</button>
            <button type="button" className="crm-btn primary" disabled={pending} onClick={register}>Register webhook</button>
          </div>
          {status && (
            <dl className="crm-pt-bot-status">
              <div>
                <dt>Webhook URL</dt>
                <dd>
                  {status.info.url || "not set"}
                  {status.info.url && status.info.url !== status.expectedUrl && <span className="crm-pill crm-pt-warn">differs from {status.expectedUrl}</span>}
                </dd>
              </div>
              <div><dt>Pending updates</dt><dd>{status.info.pendingUpdateCount}</dd></div>
              <div>
                <dt>Last error</dt>
                <dd>{status.info.lastErrorMessage ? `${status.info.lastErrorMessage}${status.info.lastErrorDate ? ` (${status.info.lastErrorDate.slice(0, 16).replace("T", " ")} UTC)` : ""}` : "none"}</dd>
              </div>
            </dl>
          )}
        </>
      )}
      {toast.node}
    </section>
  );
}
