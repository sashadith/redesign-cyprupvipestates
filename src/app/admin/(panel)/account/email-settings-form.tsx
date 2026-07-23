"use client";
import { useFormState, useFormStatus } from "react-dom";
import { updateEmailSettings, sendTestEmail, type EmailSettingsView } from "./actions";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-2 hover:bg-[#142E2D] disabled:opacity-60">
      {pending ? "Saving…" : "Save email settings"}
    </button>
  );
}

function TestEmailButton({ userId }: { userId: string }) {
  const [state, action] = useFormState<{ error?: string; ok?: string } | null>(sendTestEmail.bind(null, userId) as any, null);
  return (
    <form action={action} className="flex items-center gap-3">
      <TestSubmitBtn />
      {state?.error && <span className="text-xs text-[#C0392B]">{state.error}</span>}
      {state?.ok && <span className="text-xs text-[#2D6E62]">{state.ok}</span>}
    </form>
  );
}

function TestSubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-md border border-[#E5E7EB] text-sm px-3 py-1.5 hover:bg-[#F8F9FA] disabled:opacity-60">
      {pending ? "Sending…" : "Send test email"}
    </button>
  );
}

const fieldClass = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";
const labelClass = "block text-sm mb-1";

export default function EmailSettingsForm({ userId, settings }: { userId: string; settings: EmailSettingsView }) {
  const [state, action] = useFormState<{ error?: string; ok?: string } | null>(updateEmailSettings.bind(null, userId) as any, null);

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-4">
      <h2 className="text-sm font-semibold">Email connection</h2>
      <p className="text-xs text-[#9CA3AF]">
        Used to send replies from the CRM (Phase 2). IMAP is stored now for
        reading inbound mail later (Phase 3) — not used yet.
      </p>

      <form action={action} className="space-y-4">
        {state?.error && <p className="text-sm text-[#C0392B] bg-[#C0392B]/10 rounded px-3 py-2">{state.error}</p>}
        {state?.ok && <p className="text-sm text-[#2D6E62] bg-[#2D6E62]/10 rounded px-3 py-2">{state.ok}</p>}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>From name</label>
            <input name="fromName" defaultValue={settings.fromName} placeholder="Sascha Dith" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>From address</label>
            <input name="fromAddress" type="email" defaultValue={settings.fromAddress} placeholder="sascha.dith@cyprusvipestates.com" className={fieldClass} />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">SMTP (sending)</h3>
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className={labelClass}>Host</label>
              <input name="smtpHost" defaultValue={settings.smtpHost} placeholder="smtp.hostinger.com" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Port</label>
              <input name="smtpPort" type="number" defaultValue={settings.smtpPort} placeholder="465" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>User</label>
              <input name="smtpUser" defaultValue={settings.smtpUser} className={fieldClass} />
            </div>
            <div className="sm:col-span-4">
              <label className={labelClass}>
                Password {settings.smtpConfigured && <span className="text-[#2D6E62]">✓ configured</span>}
              </label>
              <input name="smtpPassword" type="password" autoComplete="new-password"
                placeholder={settings.smtpConfigured ? "Leave blank to keep current password" : ""}
                className={fieldClass} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">IMAP (reading — stored now, used in Phase 3)</h3>
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className={labelClass}>Host</label>
              <input name="imapHost" defaultValue={settings.imapHost} placeholder="imap.hostinger.com" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Port</label>
              <input name="imapPort" type="number" defaultValue={settings.imapPort} placeholder="993" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>User</label>
              <input name="imapUser" defaultValue={settings.imapUser} className={fieldClass} />
            </div>
            <div className="sm:col-span-4">
              <label className={labelClass}>
                Password {settings.imapConfigured && <span className="text-[#2D6E62]">✓ configured</span>}
              </label>
              <input name="imapPassword" type="password" autoComplete="new-password"
                placeholder={settings.imapConfigured ? "Leave blank to keep current password" : ""}
                className={fieldClass} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Signature (plain text, per language)</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>English</label>
              <textarea name="signatureEn" rows={3} defaultValue={settings.signature.en} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>German</label>
              <textarea name="signatureDe" rows={3} defaultValue={settings.signature.de} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Polish</label>
              <textarea name="signaturePl" rows={3} defaultValue={settings.signature.pl} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Russian</label>
              <textarea name="signatureRu" rows={3} defaultValue={settings.signature.ru} className={fieldClass} />
            </div>
          </div>
        </div>

        <SubmitBtn />
      </form>

      <div className="pt-2 border-t border-[#E5E7EB]">
        <TestEmailButton userId={userId} />
        {settings.lastTestSentAt && (
          <p className="text-[11px] text-[#9CA3AF] mt-2">
            Last test: {new Date(settings.lastTestSentAt).toLocaleString("en-GB")} — {settings.lastTestOk ? "succeeded" : "failed"}
          </p>
        )}
      </div>
    </div>
  );
}
