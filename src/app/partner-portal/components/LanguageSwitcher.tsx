"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { PartnerLocale } from "@/lib/partner/i18n";
import { setPartnerLanguageAction } from "../langAction";

const NAMES = new Map<string, string>([
  ["en", "English"],
  ["de", "Deutsch"],
  ["pl", "Polski"],
  ["ru", "Русский"],
]);

export function LanguageSwitcher({ current, locales, label }: { current: PartnerLocale; locales: readonly PartnerLocale[]; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="pp-lang">
      <span className="pp-sr">{label}</span>
      <select
        value={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          start(async () => {
            await setPartnerLanguageAction(next);
            router.refresh();
          });
        }}
      >
        {locales.map((l) => (
          <option key={l} value={l}>{NAMES.get(l) ?? l}</option>
        ))}
      </select>
    </label>
  );
}
