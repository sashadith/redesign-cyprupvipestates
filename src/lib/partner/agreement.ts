/**
 * Partner agreement — DRAFT texts per locale. Rendered on /agreement (public) and accepted at
 * registration (version + timestamp + IP are stored). Replace with the final agreement and bump
 * PARTNER_AGREEMENT_VERSION; never edit a published version's text in place.
 */
import type { PartnerLocale } from "./i18n";

export const PARTNER_AGREEMENT_VERSION = "2026-10-draft";

export type AgreementText = { title: string; intro: string; sections: { heading: string; body: string }[] };

const en: AgreementText = {
  title: "Referral partner agreement",
  intro:
    "This agreement sets out how you (the partner) and Cyprus VIP Estates work together when you introduce clients who are interested in buying property in Cyprus.",
  sections: [
    { heading: "1. What the partner does", body: "You introduce clients to Cyprus VIP Estates, either through your personal referral link or by introducing them to our team directly. You act in your own name and are not our employee or agent." },
    { heading: "2. Two ways of working", body: "Handover: we take over the client completely; by default you receive 30% of the commission we earn on the sale. Fix: you stay involved and accompany the client together with us; by default you receive 50% of our commission. Individual shares may be agreed in writing and then take precedence." },
    { heading: "3. Client protection", body: "A client you introduce is registered to you. The protection lasts 6 months from the last real contact with the client (a call, an email or a message — not an internal note). If a purchase is completed within this period, your commission applies." },
    { heading: "4. When commission is paid", body: "Commission is payable only after the developer has paid our commission to us, and only on the amount we actually received. If a sale is cancelled or our commission is refunded, no partner commission is due, or it is settled accordingly." },
    { heading: "5. Fair sources only", body: "Lead generators, purchased or rented contact lists and unsolicited mass messages are not allowed. Clients must come from your own genuine relationships." },
    { heading: "6. Client data and consent", body: "You may share a client's personal data with us only if the client has agreed to it. Both sides process personal data in line with the GDPR and only for the purpose of the purchase." },
    { heading: "7. Confidentiality", body: "Prices, commission terms, client details and other non-public information you receive from us remain confidential, also after the partnership ends." },
    { heading: "8. Ending the partnership", body: "Either side can end the partnership at any time by written notice. Commission for purchases completed by clients within their protection period remains payable under this agreement." },
    { heading: "9. Applicable law", body: "This agreement is governed by the laws of the Republic of Cyprus." },
  ],
};

const de: AgreementText = {
  title: "Vereinbarung für Empfehlungspartner",
  intro:
    "Diese Vereinbarung regelt die Zusammenarbeit zwischen Ihnen (dem Partner) und Cyprus VIP Estates, wenn Sie Kunden vorstellen, die eine Immobilie auf Zypern kaufen möchten.",
  sections: [
    { heading: "1. Aufgabe des Partners", body: "Sie stellen Cyprus VIP Estates Kunden vor – über Ihren persönlichen Empfehlungslink oder direkt bei unserem Team. Sie handeln im eigenen Namen und sind weder unser Angestellter noch unser Vertreter." },
    { heading: "2. Zwei Arten der Zusammenarbeit", body: "Übergabe: Wir übernehmen den Kunden vollständig; Sie erhalten standardmäßig 30 % unserer Provision aus dem Verkauf. Begleitung: Sie bleiben eingebunden und betreuen den Kunden gemeinsam mit uns; Sie erhalten standardmäßig 50 % unserer Provision. Individuelle Anteile können schriftlich vereinbart werden und gehen dann vor." },
    { heading: "3. Kundenschutz", body: "Ein von Ihnen vorgestellter Kunde wird Ihnen zugeordnet. Der Schutz gilt 6 Monate ab dem letzten echten Kontakt mit dem Kunden (Anruf, E-Mail oder Nachricht – keine interne Notiz). Kommt in diesem Zeitraum ein Kauf zustande, steht Ihnen die Provision zu." },
    { heading: "4. Fälligkeit der Provision", body: "Die Provision wird erst fällig, nachdem der Bauträger unsere Provision an uns gezahlt hat, und nur auf den tatsächlich erhaltenen Betrag. Wird ein Kauf rückgängig gemacht oder unsere Provision erstattet, entfällt die Partnerprovision oder wird entsprechend verrechnet." },
    { heading: "5. Nur faire Quellen", body: "Leadgeneratoren, gekaufte oder gemietete Adresslisten sowie unaufgeforderte Massennachrichten sind nicht zulässig. Kunden müssen aus Ihren eigenen, echten Kontakten stammen." },
    { heading: "6. Kundendaten und Einwilligung", body: "Sie dürfen personenbezogene Daten eines Kunden nur mit dessen Einwilligung an uns weitergeben. Beide Seiten verarbeiten personenbezogene Daten gemäß DSGVO und nur zum Zweck des Kaufs." },
    { heading: "7. Vertraulichkeit", body: "Preise, Provisionsbedingungen, Kundendaten und andere nicht öffentliche Informationen, die Sie von uns erhalten, bleiben vertraulich – auch nach Ende der Partnerschaft." },
    { heading: "8. Beendigung", body: "Jede Seite kann die Partnerschaft jederzeit schriftlich beenden. Provisionen für Käufe, die Kunden innerhalb ihres Schutzzeitraums abschließen, bleiben nach dieser Vereinbarung geschuldet." },
    { heading: "9. Anwendbares Recht", body: "Diese Vereinbarung unterliegt dem Recht der Republik Zypern." },
  ],
};

const pl: AgreementText = {
  title: "Umowa partnera polecającego",
  intro:
    "Niniejsza umowa określa zasady współpracy między Państwem (partnerem) a Cyprus VIP Estates przy polecaniu klientów zainteresowanych zakupem nieruchomości na Cyprze.",
  sections: [
    { heading: "1. Rola partnera", body: "Polecają Państwo klientów Cyprus VIP Estates – za pomocą osobistego linku polecającego lub kontaktując ich bezpośrednio z naszym zespołem. Działają Państwo we własnym imieniu i nie są Państwo naszym pracownikiem ani przedstawicielem." },
    { heading: "2. Dwa modele współpracy", body: "Przekazanie: przejmujemy klienta w całości; domyślnie otrzymują Państwo 30% naszej prowizji od sprzedaży. Współpraca: pozostają Państwo zaangażowani i prowadzą klienta razem z nami; domyślnie otrzymują Państwo 50% naszej prowizji. Indywidualne udziały można uzgodnić na piśmie – mają one wtedy pierwszeństwo." },
    { heading: "3. Ochrona klienta", body: "Polecony przez Państwa klient zostaje przypisany do Państwa. Ochrona trwa 6 miesięcy od ostatniego rzeczywistego kontaktu z klientem (rozmowa, e-mail lub wiadomość – nie notatka wewnętrzna). Jeśli w tym okresie dojdzie do zakupu, przysługuje Państwu prowizja." },
    { heading: "4. Wypłata prowizji", body: "Prowizja jest należna dopiero po zapłaceniu nam naszej prowizji przez dewelopera i wyłącznie od kwoty faktycznie otrzymanej. W przypadku anulowania zakupu lub zwrotu naszej prowizji prowizja partnera nie przysługuje lub zostaje odpowiednio rozliczona." },
    { heading: "5. Wyłącznie uczciwe źródła", body: "Niedozwolone są generatory leadów, kupione lub wynajęte listy kontaktów oraz niezamówione masowe wiadomości. Klienci muszą pochodzić z Państwa własnych, rzeczywistych relacji." },
    { heading: "6. Dane klientów i zgoda", body: "Mogą Państwo przekazywać nam dane osobowe klienta wyłącznie za jego zgodą. Obie strony przetwarzają dane osobowe zgodnie z RODO i wyłącznie w celu realizacji zakupu." },
    { heading: "7. Poufność", body: "Ceny, warunki prowizji, dane klientów i inne niepubliczne informacje otrzymane od nas pozostają poufne – również po zakończeniu współpracy." },
    { heading: "8. Zakończenie współpracy", body: "Każda ze stron może w dowolnym momencie zakończyć współpracę, powiadamiając o tym na piśmie. Prowizje za zakupy dokonane przez klientów w okresie ich ochrony pozostają należne zgodnie z niniejszą umową." },
    { heading: "9. Prawo właściwe", body: "Niniejsza umowa podlega prawu Republiki Cypryjskiej." },
  ],
};

const ru: AgreementText = {
  title: "Соглашение о партнёрстве по рекомендациям",
  intro:
    "Настоящее соглашение определяет порядок сотрудничества между Вами (партнёром) и Cyprus VIP Estates, когда Вы рекомендуете клиентов, заинтересованных в покупке недвижимости на Кипре.",
  sections: [
    { heading: "1. Роль партнёра", body: "Вы рекомендуете клиентов Cyprus VIP Estates — через Вашу персональную реферальную ссылку или напрямую знакомя их с нашей командой. Вы действуете от своего имени и не являетесь нашим сотрудником или представителем." },
    { heading: "2. Два формата работы", body: "Передача: мы полностью берём клиента на себя; по умолчанию Вы получаете 30% нашей комиссии от сделки. Сопровождение: Вы остаётесь вовлечены и ведёте клиента вместе с нами; по умолчанию Вы получаете 50% нашей комиссии. Индивидуальные доли могут быть согласованы письменно и в этом случае имеют приоритет." },
    { heading: "3. Защита клиента", body: "Рекомендованный Вами клиент закрепляется за Вами. Защита действует 6 месяцев с момента последнего реального контакта с клиентом (звонок, письмо или сообщение — не внутренняя заметка). Если покупка состоится в этот период, Вам полагается комиссия." },
    { heading: "4. Выплата комиссии", body: "Комиссия подлежит выплате только после того, как застройщик выплатил нам нашу комиссию, и только с фактически полученной суммы. Если сделка отменена или наша комиссия возвращена, партнёрская комиссия не выплачивается или пересчитывается соответствующим образом." },
    { heading: "5. Только честные источники", body: "Запрещено использовать генераторы лидов, купленные или арендованные базы контактов и непрошеные массовые рассылки. Клиенты должны приходить из Ваших собственных реальных связей." },
    { heading: "6. Данные клиентов и согласие", body: "Вы можете передавать нам персональные данные клиента только с его согласия. Обе стороны обрабатывают персональные данные в соответствии с GDPR и только в целях покупки." },
    { heading: "7. Конфиденциальность", body: "Цены, условия комиссии, данные клиентов и иная непубличная информация, полученная от нас, остаются конфиденциальными, в том числе после окончания партнёрства." },
    { heading: "8. Прекращение партнёрства", body: "Каждая из сторон может в любой момент прекратить партнёрство, письменно уведомив другую сторону. Комиссии за покупки, совершённые клиентами в период их защиты, остаются подлежащими выплате по настоящему соглашению." },
    { heading: "9. Применимое право", body: "Настоящее соглашение регулируется законодательством Республики Кипр." },
  ],
};

const TEXTS: Record<PartnerLocale, AgreementText> = { en, de, pl, ru };

export function agreementText(locale: PartnerLocale): AgreementText {
  return TEXTS[locale] ?? en;
}
