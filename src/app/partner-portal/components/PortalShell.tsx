import Link from "next/link";
import { badgeText } from "@/lib/partner/news";
import { PARTNER_LOCALES, fmt, type PartnerDict, type PartnerLocale } from "@/lib/partner/i18n";
import { logoutAction } from "../sessionActions";
import { LogoFull, LogoMark } from "./Brand";
import type { ThemeOption } from "@/lib/design/options";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";

/** `active`: the partner is approved (ACTIVE) — pending partners keep the 3a home/profile navigation. */
type Props = { locale: PartnerLocale; t: PartnerDict; loggedIn: boolean; active?: boolean; newsUnread?: number; themes?: { options: ThemeOption[]; choiceId: string | null }; children: React.ReactNode };

export function PortalShell({ locale, t, loggedIn, active = false, newsUnread = 0, themes, children }: Props) {
  return (
    <>
      <header className="pp-top">
        <div className="pp-top-in">
          <Link href={loggedIn ? "/home" : "/"} className="pp-logo">
            <LogoFull className="pp-logo-full" />
            <LogoMark className="pp-logo-mark" />
          </Link>
          <span className="pp-logo-tag">{t.landing.title}</span>
          <div className="pp-tools">
            {loggedIn && active && themes && <ThemeSwitcher variant="compact" options={themes.options} choiceId={themes.choiceId} t={t.theme} />}
            <LanguageSwitcher current={locale} locales={PARTNER_LOCALES} label={t.nav.language} />
            {loggedIn && (
              <form action={logoutAction}>
                <button type="submit" className="pp-logout">{t.nav.logout}</button>
              </form>
            )}
          </div>
          {loggedIn && (
            <nav className="pp-nav" aria-label="Partner">
              {active ? (
                <>
                  <Link href="/home">{t.nav.overview}</Link>
                  <Link href="/submit">{t.nav.submit}</Link>
                  <Link href="/clients">{t.nav.clients}</Link>
                  <Link href="/presentations">{t.nav.presentations}</Link>
                  <Link href="/commissions">{t.nav.commissions}</Link>
                  <Link href="/rating">{t.nav.rating}</Link>
                  <Link href="/news">
                    {t.nav.news}
                    {badgeText(newsUnread) && (
                      <span className="pp-badge" aria-label={fmt(t.news.unreadAria, { n: newsUnread })}>{badgeText(newsUnread)}</span>
                    )}
                  </Link>
                  <Link href="/projects">{t.nav.projects}</Link>
                  <Link href="/calculator">{t.nav.calculator}</Link>
                  <Link href="/materials">{t.nav.materials}</Link>
                </>
              ) : (
                <Link href="/home">{t.nav.home}</Link>
              )}
              <Link href="/profile">{t.nav.profile}</Link>
            </nav>
          )}
        </div>
      </header>
      <main className="pp-main">{children}</main>
      <footer className="pp-foot">
        <div className="pp-foot-in">
          <LogoMark className="pp-foot-mark" />
          <span>© {new Date().getFullYear()} {t.footer.brand}. {t.footer.rights}</span>
          <Link href="/agreement">{t.footer.agreement}</Link>
        </div>
      </footer>
    </>
  );
}
