import { prisma } from "@/lib/prisma";
import { fmt } from "@/lib/partner/i18n";
import { isPayoutBlocked } from "@/lib/partner/bank";
import { ibanLast4 } from "@/lib/partner/bankFlow";
import { loadBankDetails } from "@/lib/partner/bankStore";
import { requirePartner } from "@/lib/partner/session";
import { vatIdMissing } from "@/lib/partner/vat";
import { partnerBotConfigured } from "@/lib/partner/telegramApi";
import { brandDisplayName } from "@/lib/partner/presentationBranding";
import { BankForm, PasswordForm, ProfileForm, SettingsForm, TelegramCard } from "../components/forms";
import { BrandForm, LogoForm } from "../components/presentationForms";
import { dateFmt } from "../components/portalBits";
import { portalContext } from "../portalContext";

export default async function PartnerProfile() {
  const me = await requirePartner();
  const { t, locale } = await portalContext();
  const p = await prisma.partner.findUnique({
    where: { id: me.partner.id },
    select: { firstName: true, lastName: true, company: true, vatId: true, country: true, language: true, phone: true, type: true, emailNotifications: true, digestOptIn: true,
      notifyChannel: true, telegramChatId: true, telegramLinkedAt: true,
      brandName: true, brandPhone: true, brandEmail: true, brandWebsite: true, brandLogoType: true, brandLogoUpdatedAt: true },
  });
  if (!p) return null;
  const P = t.profile;
  const B = t.bank;
  const active = me.partner.status === "ACTIVE";
  // Decrypted server-side for this partner only; the IBAN itself never goes into client props.
  const bank = active ? await loadBankDetails(me.partner.id) : null;
  const d = bank?.state === "ok" ? bank.details : null;
  const last4 = bank?.state === "ok" ? bank.ibanLast4 ?? ibanLast4(bank.details.iban) : null;
  const blockedUntil = bank?.state === "ok" && isPayoutBlocked(bank.blockedUntil, new Date()) ? bank.blockedUntil : null;
  const dates = dateFmt(locale);
  // The chat id itself never leaves the server: the page only needs "linked since".
  const botAvailable = partnerBotConfigured();
  const linked = !!p.telegramChatId;
  const linkedAt = linked ? dates.format(p.telegramLinkedAt ?? new Date()) : null;
  return (
    <div className="pp-stack">
      <section className="pp-card pp-card-wide">
        <h1>{P.title}</h1>
        {vatIdMissing(p) && <p className="pp-alert pp-alert-info" role="status">{P.vatMissing}</p>}
        <ProfileForm
          t={t}
          country={p.country}
          values={{ firstName: p.firstName, lastName: p.lastName, company: p.company ?? "", vatId: p.vatId ?? "", language: String(p.language) }}
        />
      </section>
      <section className="pp-panel">
        <dl className="pp-dl">
          <div><dt>{P.email}</dt><dd>{me.user.email}</dd></div>
          <div><dt>{P.phone}</dt><dd>{p.phone}</dd></div>
          <div><dt>{P.type}</dt><dd>{t.types[p.type]}</dd></div>
        </dl>
        <p className="pp-muted pp-small">{P.lockedNote}</p>
      </section>
      <section className="pp-panel pp-anchor" id="bank" aria-labelledby="bank-title">
        <h2 className="pp-h3" id="bank-title">{B.title}</h2>
        <p className="pp-muted">{B.intro}</p>
        {!active ? (
          <p className="pp-alert pp-alert-neutral">{B.pendingNote}</p>
        ) : bank?.state === "unavailable" ? (
          <p className="pp-alert pp-alert-neutral" role="status">{B.unavailable}</p>
        ) : (
          <>
            {blockedUntil && <p className="pp-alert pp-alert-info">{fmt(B.blockedNote, { date: dates.format(blockedUntil) })}</p>}
            {d && bank?.state === "ok" ? (
              <dl className="pp-dl">
                <div><dt>{B.iban}</dt><dd>{last4 ? `•••• ${last4}` : B.notSet}</dd></div>
                <div><dt>{B.holder}</dt><dd>{d.holder}</dd></div>
                <div><dt>{B.bic}</dt><dd>{d.bic ?? "—"}</dd></div>
                <div><dt>{B.billingName}</dt><dd>{d.billingName}</dd></div>
                <div><dt>{B.billingAddress}</dt><dd className="pp-pre">{d.billingAddress}</dd></div>
                {bank.updatedAt && <div><dt>{B.lastChanged}</dt><dd>{dates.format(bank.updatedAt)}</dd></div>}
              </dl>
            ) : (
              <p className="pp-muted">{B.notSet}</p>
            )}
            <BankForm
              t={t}
              ibanLast4={last4}
              prefill={
                d
                  ? { holder: d.holder, bic: d.bic ?? "", billingName: d.billingName, billingAddress: d.billingAddress }
                  : null
              }
            />
          </>
        )}
      </section>
      {active && (
        <section className="pp-panel pp-anchor" id="branding" aria-labelledby="branding-title">
          <h2 className="pp-h3" id="branding-title">{t.branding.title}</h2>
          <p className="pp-muted">{t.branding.intro}</p>
          <BrandForm
            t={t}
            values={{ brandName: p.brandName, brandPhone: p.brandPhone, brandEmail: p.brandEmail, brandWebsite: p.brandWebsite }}
            fallbackName={brandDisplayName({ brandName: null, company: p.company, firstName: p.firstName, lastName: p.lastName })}
          />
          <LogoForm t={t} logoSrc={p.brandLogoType ? `/profile/logo?v=${p.brandLogoUpdatedAt?.getTime() ?? 0}` : null} />
        </section>
      )}
      {active && (
        <section className="pp-panel pp-anchor" id="telegram" aria-labelledby="telegram-title">
          <h2 className="pp-h3" id="telegram-title">{t.telegram.card.title}</h2>
          <p className="pp-muted">{t.telegram.card.intro}</p>
          <TelegramCard t={t} available={botAvailable} linkedAt={linkedAt} />
        </section>
      )}
      {active && (
        <section className="pp-panel pp-anchor" id="settings" aria-labelledby="settings-title">
          <h2 className="pp-h3" id="settings-title">{t.profileSettings.title}</h2>
          <SettingsForm
            t={t}
            values={{ emailNotifications: p.emailNotifications, digestOptIn: p.digestOptIn }}
            telegram={botAvailable || linked ? { channel: p.notifyChannel, linked } : undefined}
          />
        </section>
      )}
      <section className="pp-panel">
        <h2 className="pp-h3">{P.changePassword}</h2>
        <PasswordForm t={t} />
      </section>
    </div>
  );
}
