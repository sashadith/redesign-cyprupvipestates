// UI strings of the Cyprus tax calculator block (en, de, pl, ru). Hebrew has no guides section and falls back to English.
export type SourceKey = "company" | "dividends" | "interest" | "property" | "crypto" | "pension" | "selfEmployed" | "employment";

export type TaxCalcStrings = {
  title: string;
  lead: string;
  startFrom: string;
  presets: { owner: string; investor: string; pension: string; freelancer: string; employee: string };
  clear: string;
  statusHeading: string;
  statusOptions: { nonDom: { title: string; text: string }; dom: { title: string; text: string } };
  incomeHeading: string;
  incomeHint: string;
  sources: Record<SourceKey, { title: string; hint: string }>;
  fields: {
    companyProfit: string; companyProfitHint: string;
    companySalary: string; companySalaryHint: string;
    companyDividend: string; companyDividendHint: string;
    dividends: string; interest: string;
    propertyGain: string; propertyGainHint: string; propertyMainHome: string;
    cryptoGain: string; cryptoGainHint: string;
    pension: string; pensionS1: string;
    selfEmployed: string; employment: string;
    exemption: string; exemptionHint: string;
  };
  exemption: { none: string; half: string; fifth: string; quarter: string };
  familyHeading: string;
  familyHint: string;
  status: { single: string; singleParent: string; married: string };
  statusLabel: string;
  spouseIncome: string;
  children: string;
  homeInterest: string;
  disasterInsurance: string;
  energyEv: string;
  otherDeductions: string;
  resultHeading: string;
  keepYear: string;
  keepMonth: string;
  retainedTitle: string;
  burdenTitle: string;
  ofPool: string;
  barKept: string;
  barRetained: string;
  barBurden: string;
  breakdownHeading: string;
  lines: {
    corporate: string; employerCharges: string; incomeTax: string; social: string; hrda: string; ghs: string; sdc: string;
    property: string; crypto: string;
  };
  companyHeading: string;
  companyLines: { profit: string; salary: string; charges: string; corporateTax: string; afterTax: string; dividend: string; retained: string };
  bandsHeading: string;
  bandCols: { band: string; rate: string; income: string; tax: string };
  above: string;
  insights: {
    nonDom: string;
    dom: string;
    pensionElected: string;
    pensionNormal: string;
    familyOff: string;
    otherCapped: string;
    dividendCapped: string;
    propertyExempt: string;
  };
  empty: string;
  emptyHint: string;
  seeResult: string;
  notesHeading: string;
  notes: string[];
  disclaimer: string;
  guideLead: string;
};

const EN: TaxCalcStrings = {
  title: "Cyprus tax calculator for 2026",
  lead: "Switch on the sources of your income and see what you keep after Cyprus tax, in under a minute. Built for company owners and investors. Nothing you type leaves your browser.",
  startFrom: "Start from an example",
  presets: { owner: "Company owner", investor: "Investor", pension: "Pension from abroad", freelancer: "Freelancer", employee: "Employee" },
  clear: "Clear all",
  statusHeading: "Your tax status",
  statusOptions: {
    nonDom: { title: "Non-domiciled", text: "Most people who moved to Cyprus. No Special Defence Contribution on dividends and interest. You become domiciled after 17 of the last 20 years as a Cyprus tax resident." },
    dom: { title: "Domiciled in Cyprus", text: "Pays the Special Defence Contribution: 5% on dividends and 17% on interest." },
  },
  incomeHeading: "Where your income comes from",
  incomeHint: "Switch on every source you have. Amounts are euros for the whole year.",
  sources: {
    company: { title: "Your Cyprus company", hint: "The company pays 15% tax on its profit. You take salary and dividends out of it." },
    dividends: { title: "Dividends from other companies", hint: "Shares, funds or a holding company, in Cyprus or abroad." },
    interest: { title: "Interest", hint: "Bank deposits, loans you made, bonds." },
    property: { title: "Gain from selling property in Cyprus", hint: "Capital gains tax of 20% after an exemption." },
    crypto: { title: "Gain from selling crypto-assets", hint: "A flat 8% on the net gain of the year." },
    pension: { title: "Pension from abroad", hint: "Taxed at 5% above €5,000 or on the normal scale, whichever is cheaper." },
    selfEmployed: { title: "Self-employed profit", hint: "Sole trader or freelancer, on actual profit." },
    employment: { title: "Salary from an employer", hint: "Gross pay, before tax and contributions." },
  },
  fields: {
    companyProfit: "Company profit before your pay and tax",
    companyProfitHint: "The profit of the year, before the salary you pay yourself.",
    companySalary: "Salary the company pays you",
    companySalaryHint: "Deductible for the company. Social insurance and GHS apply to it.",
    companyDividend: "Dividend the company pays you",
    companyDividendHint: "Paid out of the profit left after company tax.",
    dividends: "Dividends per year",
    interest: "Interest per year",
    propertyGain: "Taxable gain",
    propertyGainHint: "Sale price minus the indexed cost and the costs of buying and selling.",
    propertyMainHome: "It was my main home for five years or more",
    cryptoGain: "Net gain of the year",
    cryptoGainHint: "Gains from selling, swapping or spending crypto, after losses of the same year.",
    pension: "Pension per year",
    pensionS1: "It comes with an S1 or A1, so no GHS on the pension",
    selfEmployed: "Profit per year",
    employment: "Gross salary per year",
    exemption: "Exemption for people who start work in Cyprus",
    exemptionHint: "The conditions are detailed. Confirm that you qualify with a Cyprus tax adviser before relying on one.",
  },
  exemption: {
    none: "None",
    half: "50% of pay, for pay above €55,000 (first employment after 2021)",
    fifth: "20% of pay, up to €8,550 a year",
    quarter: "25% of pay, up to €25,000 a year (pay above €30,000)",
  },
  familyHeading: "Family and deductions",
  familyHint: "The 2026 family deductions apply only below family income ceilings of €100,000, €150,000 or €200,000, by number of children. A single person without children needs an income of no more than €40,000 for the home and energy items.",
  status: { single: "Single", singleParent: "Single parent or full custody", married: "Married or in a partnership" },
  statusLabel: "Family status",
  spouseIncome: "Income of your spouse or partner per year",
  children: "Number of children",
  homeInterest: "Interest or rent on your main home (up to €2,000)",
  disasterInsurance: "Home insurance against natural disasters (up to €500)",
  energyEv: "Energy efficiency of your main home or an electric vehicle (up to €1,000)",
  otherDeductions: "Other deductible items per year: life insurance, pension fund, medical fund, donations",
  resultHeading: "Your 2026 result",
  keepYear: "You keep personally per year",
  keepMonth: "per month",
  retainedTitle: "Left in your company",
  burdenTitle: "Tax and contributions in total",
  ofPool: "of the total",
  barKept: "You keep",
  barRetained: "Left in the company",
  barBurden: "Tax and contributions",
  breakdownHeading: "Where the tax goes",
  lines: {
    corporate: "Company tax (15%)",
    employerCharges: "Employer contributions on your salary",
    incomeTax: "Income tax",
    social: "Social insurance",
    hrda: "HRDA contribution (self-employed)",
    ghs: "Health system contribution (GHS)",
    sdc: "Special Defence Contribution",
    property: "Capital gains tax on property (20%)",
    crypto: "Tax on crypto gains (8%)",
  },
  companyHeading: "Inside your company",
  companyLines: {
    profit: "Profit before your pay",
    salary: "Your salary",
    charges: "Employer contributions",
    corporateTax: "Company tax (15%)",
    afterTax: "Profit after tax",
    dividend: "Dividend paid to you",
    retained: "Left in the company",
  },
  bandsHeading: "Income tax by band",
  bandCols: { band: "Chargeable income", rate: "Rate", income: "In band", tax: "Tax" },
  above: "above",
  insights: {
    nonDom: "Being non-domiciled saves you €{x} a year compared with a domiciled resident.",
    dom: "A non-domiciled resident would pay €{x} less a year.",
    pensionElected: "The 5% rate on the part of the pension above €5,000 is cheaper than the normal scale, so it is used.",
    pensionNormal: "For this pension the normal scale is cheaper than the 5% rate, so it is used.",
    familyOff: "The family deductions do not apply at this income.",
    otherCapped: "Other deductions are limited to one fifth of chargeable income, so part of what you entered is not counted.",
    dividendCapped: "The dividend is more than the company has left after tax, so it is reduced to €{x}.",
    propertyExempt: "The gain is inside the exemption, so no capital gains tax is due.",
  },
  empty: "Your result appears here.",
  emptyHint: "Pick an example above, or switch on a source of income and enter an amount.",
  seeResult: "See your result",
  notesHeading: "What this calculator assumes",
  notes: [
    "You are a Cyprus tax resident for the whole of 2026. Non-residents are taxed differently.",
    "Company tax is 15% of profit after your salary and the employer contributions on it. Notional interest deduction, deemed distribution and group relief are not modelled.",
    "A dividend is paid out of the profit left after company tax. Social insurance is not charged on dividends; GHS of 2.65% is, up to one annual maximum of €180,000 of income.",
    "Dividends and interest are exempt from income tax. A domiciled resident pays the Special Defence Contribution of 5% on dividends and 17% on interest.",
    "Social insurance: 8.8% of salary up to €68,904 a year; the self-employed pay 16.6% on actual profit up to €68,900 and 0.5% HRDA. The compulsory minimum of a self-employed category can make the real figure higher.",
    "Capital gains tax on property is 20% of the gain above an exemption of €30,000, or €150,000 for a main home; only one of the two exemptions applies to a person. Crypto gains are taxed at 8%.",
    "A pension from abroad is taxed at 5% on the part above €5,000 or on the normal scale, whichever is cheaper.",
    "Deductions: social insurance and GHS on taxable income in full; the other items up to one fifth of chargeable income.",
  ],
  disclaimer: "General information, not tax advice. Rates and rules change; check your own case with a licensed Cyprus tax adviser.",
  guideLead: "How the figures are built:",
};

const DE: TaxCalcStrings = {
  title: "Steuerrechner Zypern 2026",
  lead: "Schalten Sie Ihre Einkommensquellen ein und sehen Sie in unter einer Minute, was nach zypriotischen Steuern bleibt. Gebaut für Unternehmer und Investoren. Ihre Eingaben verlassen den Browser nicht.",
  startFrom: "Mit einem Beispiel starten",
  presets: { owner: "Firmeninhaber", investor: "Investor", pension: "Rente aus dem Ausland", freelancer: "Freiberufler", employee: "Angestellter" },
  clear: "Alles löschen",
  statusHeading: "Ihr Steuerstatus",
  statusOptions: {
    nonDom: { title: "Nicht domiziliert", text: "Die meisten, die nach Zypern gezogen sind. Keine Sonderverteidigungsabgabe auf Dividenden und Zinsen. Nach 17 von 20 Jahren als steuerlich Ansässiger in Zypern werden Sie domiziliert." },
    dom: { title: "In Zypern domiziliert", text: "Zahlt die Sonderverteidigungsabgabe: 5 % auf Dividenden und 17 % auf Zinsen." },
  },
  incomeHeading: "Woher Ihr Einkommen kommt",
  incomeHint: "Schalten Sie jede Quelle ein, die Sie haben. Beträge in Euro für das ganze Jahr.",
  sources: {
    company: { title: "Ihre zypriotische Firma", hint: "Die Firma zahlt 15 % Steuer auf den Gewinn. Gehalt und Dividenden entnehmen Sie daraus." },
    dividends: { title: "Dividenden anderer Unternehmen", hint: "Aktien, Fonds oder eine Holding, in Zypern oder im Ausland." },
    interest: { title: "Zinsen", hint: "Bankguthaben, vergebene Darlehen, Anleihen." },
    property: { title: "Gewinn aus dem Verkauf von Immobilien in Zypern", hint: "Kapitalgewinnsteuer von 20 % nach einem Freibetrag." },
    crypto: { title: "Gewinn aus dem Verkauf von Kryptowerten", hint: "Pauschal 8 % auf den Nettogewinn des Jahres." },
    pension: { title: "Rente aus dem Ausland", hint: "5 % über 5.000 € oder nach dem normalen Tarif, je nachdem, was günstiger ist." },
    selfEmployed: { title: "Gewinn aus selbständiger Tätigkeit", hint: "Einzelunternehmer oder Freiberufler, auf den tatsächlichen Gewinn." },
    employment: { title: "Gehalt von einem Arbeitgeber", hint: "Brutto, vor Steuern und Beiträgen." },
  },
  fields: {
    companyProfit: "Firmengewinn vor Ihrem Gehalt und der Steuer",
    companyProfitHint: "Der Gewinn des Jahres, vor dem Gehalt, das Sie sich zahlen.",
    companySalary: "Gehalt, das die Firma Ihnen zahlt",
    companySalaryHint: "Für die Firma abzugsfähig. Sozialversicherung und GHS fallen an.",
    companyDividend: "Dividende, die die Firma Ihnen zahlt",
    companyDividendHint: "Aus dem Gewinn nach Firmensteuer.",
    dividends: "Dividenden pro Jahr",
    interest: "Zinsen pro Jahr",
    propertyGain: "Steuerpflichtiger Gewinn",
    propertyGainHint: "Verkaufspreis minus indexierte Anschaffungskosten und die Kosten für Kauf und Verkauf.",
    propertyMainHome: "Es war mindestens fünf Jahre meine Hauptwohnung",
    cryptoGain: "Nettogewinn des Jahres",
    cryptoGainHint: "Gewinne aus Verkauf, Tausch oder Ausgabe von Krypto, nach Verlusten desselben Jahres.",
    pension: "Rente pro Jahr",
    pensionS1: "Sie kommt mit S1 oder A1, daher kein GHS auf die Rente",
    selfEmployed: "Gewinn pro Jahr",
    employment: "Bruttogehalt pro Jahr",
    exemption: "Befreiung für Personen, die in Zypern erstmals arbeiten",
    exemptionHint: "Die Voraussetzungen sind im Einzelnen geregelt. Lassen Sie sich von einem zypriotischen Steuerberater bestätigen, dass Sie sie erfüllen.",
  },
  exemption: {
    none: "Keine",
    half: "50 % des Gehalts, bei Gehalt über 55.000 € (erste Beschäftigung nach 2021)",
    fifth: "20 % des Gehalts, bis 8.550 € im Jahr",
    quarter: "25 % des Gehalts, bis 25.000 € im Jahr (Gehalt über 30.000 €)",
  },
  familyHeading: "Familie und Abzüge",
  familyHint: "Die Familienabzüge 2026 gelten nur unter Familieneinkommensgrenzen von 100.000 €, 150.000 € oder 200.000 €, je nach Kinderzahl. Eine alleinstehende Person ohne Kinder darf für die Posten Wohnung und Energie höchstens 40.000 € verdienen.",
  status: { single: "Ledig", singleParent: "Alleinerziehend oder volles Sorgerecht", married: "Verheiratet oder in Partnerschaft" },
  statusLabel: "Familienstand",
  spouseIncome: "Einkommen von Ehe- oder Lebenspartner pro Jahr",
  children: "Anzahl der Kinder",
  homeInterest: "Zinsen oder Miete für Ihre Hauptwohnung (bis 2.000 €)",
  disasterInsurance: "Wohngebäudeversicherung gegen Naturgefahren (bis 500 €)",
  energyEv: "Energieeffizienz Ihrer Hauptwohnung oder Elektrofahrzeug (bis 1.000 €)",
  otherDeductions: "Weitere abzugsfähige Posten pro Jahr: Lebensversicherung, Pensionskasse, Krankenkasse, Spenden",
  resultHeading: "Ihr Ergebnis für 2026",
  keepYear: "Sie behalten persönlich pro Jahr",
  keepMonth: "pro Monat",
  retainedTitle: "In Ihrer Firma geblieben",
  burdenTitle: "Steuern und Beiträge zusammen",
  ofPool: "der Gesamtsumme",
  barKept: "Sie behalten",
  barRetained: "In der Firma geblieben",
  barBurden: "Steuern und Beiträge",
  breakdownHeading: "Wohin die Steuer geht",
  lines: {
    corporate: "Firmensteuer (15 %)",
    employerCharges: "Arbeitgeberbeiträge auf Ihr Gehalt",
    incomeTax: "Einkommensteuer",
    social: "Sozialversicherung",
    hrda: "HRDA-Beitrag (Selbständige)",
    ghs: "Gesundheitsbeitrag (GHS)",
    sdc: "Sonderverteidigungsabgabe",
    property: "Kapitalgewinnsteuer auf Immobilien (20 %)",
    crypto: "Steuer auf Kryptogewinne (8 %)",
  },
  companyHeading: "In Ihrer Firma",
  companyLines: {
    profit: "Gewinn vor Ihrem Gehalt",
    salary: "Ihr Gehalt",
    charges: "Arbeitgeberbeiträge",
    corporateTax: "Firmensteuer (15 %)",
    afterTax: "Gewinn nach Steuer",
    dividend: "An Sie gezahlte Dividende",
    retained: "In der Firma geblieben",
  },
  bandsHeading: "Einkommensteuer nach Stufen",
  bandCols: { band: "Steuerpflichtiges Einkommen", rate: "Satz", income: "In der Stufe", tax: "Steuer" },
  above: "über",
  insights: {
    nonDom: "Der Status nicht domiziliert spart Ihnen €{x} im Jahr gegenüber einem domizilierten Ansässigen.",
    dom: "Ein nicht domiziliert Ansässiger würde €{x} im Jahr weniger zahlen.",
    pensionElected: "Der Satz von 5 % auf den Teil der Rente über 5.000 € ist günstiger als der normale Tarif und wird angewendet.",
    pensionNormal: "Für diese Rente ist der normale Tarif günstiger als der Satz von 5 % und wird angewendet.",
    familyOff: "Die Familienabzüge gelten bei diesem Einkommen nicht.",
    otherCapped: "Die weiteren Abzüge sind auf ein Fünftel des steuerpflichtigen Einkommens begrenzt, ein Teil Ihrer Angabe wird daher nicht berücksichtigt.",
    dividendCapped: "Die Dividende ist höher als der Gewinn nach Firmensteuer und wird auf €{x} gekürzt.",
    propertyExempt: "Der Gewinn liegt innerhalb des Freibetrags, es fällt keine Kapitalgewinnsteuer an.",
  },
  empty: "Hier erscheint Ihr Ergebnis.",
  emptyHint: "Wählen Sie oben ein Beispiel oder schalten Sie eine Einkommensquelle ein und geben Sie einen Betrag ein.",
  seeResult: "Ergebnis ansehen",
  notesHeading: "Annahmen des Rechners",
  notes: [
    "Sie sind das ganze Jahr 2026 in Zypern steuerlich ansässig. Nicht Ansässige werden anders besteuert.",
    "Die Firmensteuer beträgt 15 % des Gewinns nach Ihrem Gehalt und den Arbeitgeberbeiträgen darauf. Fiktiver Zinsabzug, fiktive Ausschüttung und Verlustverrechnung im Konzern sind nicht abgebildet.",
    "Eine Dividende wird aus dem Gewinn nach Firmensteuer gezahlt. Auf Dividenden fällt keine Sozialversicherung an, wohl aber GHS von 2,65 % bis zu einem Jahreshöchstbetrag von 180.000 € Einkommen.",
    "Dividenden und Zinsen sind von der Einkommensteuer befreit. Ein domiziliert Ansässiger zahlt die Sonderverteidigungsabgabe von 5 % auf Dividenden und 17 % auf Zinsen.",
    "Sozialversicherung: 8,8 % des Gehalts bis 68.904 € im Jahr; Selbständige zahlen 16,6 % auf den tatsächlichen Gewinn bis 68.900 € und 0,5 % HRDA. Das Pflichtminimum der Kategorie kann den tatsächlichen Betrag erhöhen.",
    "Die Kapitalgewinnsteuer auf Immobilien beträgt 20 % des Gewinns über einem Freibetrag von 30.000 €, bei der Hauptwohnung 150.000 €; für eine Person gilt nur einer der beiden Freibeträge. Kryptogewinne werden mit 8 % besteuert.",
    "Eine Rente aus dem Ausland wird mit 5 % auf den Teil über 5.000 € oder nach dem normalen Tarif besteuert, je nachdem, was günstiger ist.",
    "Abzüge: Sozialversicherung und GHS auf steuerpflichtiges Einkommen voll; die übrigen Posten bis zu einem Fünftel des steuerpflichtigen Einkommens.",
  ],
  disclaimer: "Allgemeine Information, keine Steuerberatung. Sätze und Regeln ändern sich; lassen Sie Ihren Fall von einem zugelassenen zypriotischen Steuerberater prüfen.",
  guideLead: "So entstehen die Zahlen:",
};

const PL: TaxCalcStrings = {
  title: "Kalkulator podatkowy Cypr 2026",
  lead: "Włącz źródła swojego dochodu i zobacz w mniej niż minutę, ile zostaje po cypryjskich podatkach. Stworzony dla właścicieli firm i inwestorów. To, co wpiszesz, nie opuszcza Twojej przeglądarki.",
  startFrom: "Zacznij od przykładu",
  presets: { owner: "Właściciel firmy", investor: "Inwestor", pension: "Emerytura z zagranicy", freelancer: "Freelancer", employee: "Pracownik" },
  clear: "Wyczyść wszystko",
  statusHeading: "Twój status podatkowy",
  statusOptions: {
    nonDom: { title: "Bez domicylu", text: "Większość osób, które przeniosły się na Cypr. Bez Special Defence Contribution od dywidend i odsetek. Domicyl uzyskasz po 17 z ostatnich 20 lat jako rezydent podatkowy Cypru." },
    dom: { title: "Z domicylem na Cyprze", text: "Płaci Special Defence Contribution: 5% od dywidend i 17% od odsetek." },
  },
  incomeHeading: "Skąd pochodzi Twój dochód",
  incomeHint: "Włącz każde źródło, które masz. Kwoty w euro za cały rok.",
  sources: {
    company: { title: "Twoja cypryjska firma", hint: "Firma płaci 15% podatku od zysku. Pensję i dywidendy pobierasz z niej." },
    dividends: { title: "Dywidendy z innych spółek", hint: "Akcje, fundusze lub spółka holdingowa, na Cyprze lub za granicą." },
    interest: { title: "Odsetki", hint: "Lokaty bankowe, udzielone pożyczki, obligacje." },
    property: { title: "Zysk ze sprzedaży nieruchomości na Cyprze", hint: "Podatek od zysków kapitałowych 20% po zwolnieniu." },
    crypto: { title: "Zysk ze sprzedaży kryptoaktywów", hint: "Stałe 8% od zysku netto roku." },
    pension: { title: "Emerytura z zagranicy", hint: "5% powyżej 5 000 € albo normalna skala, zależnie od tego, co tańsze." },
    selfEmployed: { title: "Zysk z działalności na własny rachunek", hint: "Jednoosobowa działalność lub freelancer, od faktycznego zysku." },
    employment: { title: "Wynagrodzenie od pracodawcy", hint: "Brutto, przed podatkami i składkami." },
  },
  fields: {
    companyProfit: "Zysk firmy przed Twoją pensją i podatkiem",
    companyProfitHint: "Zysk roku, przed pensją, którą sobie wypłacasz.",
    companySalary: "Pensja, którą firma Ci wypłaca",
    companySalaryHint: "Koszt uzyskania przychodu firmy. Obejmują ją ubezpieczenie społeczne i GHS.",
    companyDividend: "Dywidenda, którą firma Ci wypłaca",
    companyDividendHint: "Wypłacana z zysku po podatku firmowym.",
    dividends: "Dywidendy rocznie",
    interest: "Odsetki rocznie",
    propertyGain: "Zysk do opodatkowania",
    propertyGainHint: "Cena sprzedaży minus zindeksowany koszt oraz koszty zakupu i sprzedaży.",
    propertyMainHome: "To było moje główne mieszkanie przez co najmniej pięć lat",
    cryptoGain: "Zysk netto roku",
    cryptoGainHint: "Zyski ze sprzedaży, wymiany lub wydania krypto, po stratach z tego samego roku.",
    pension: "Emerytura rocznie",
    pensionS1: "Ma S1 lub A1, więc bez GHS od emerytury",
    selfEmployed: "Zysk rocznie",
    employment: "Wynagrodzenie brutto rocznie",
    exemption: "Zwolnienie dla osób, które zaczynają pracę na Cyprze",
    exemptionHint: "Warunki są szczegółowe. Potwierdź u cypryjskiego doradcy podatkowego, że je spełniasz, zanim na nich oprzesz plan.",
  },
  exemption: {
    none: "Brak",
    half: "50% wynagrodzenia, przy wynagrodzeniu powyżej 55 000 € (pierwsze zatrudnienie po 2021)",
    fifth: "20% wynagrodzenia, do 8 550 € rocznie",
    quarter: "25% wynagrodzenia, do 25 000 € rocznie (wynagrodzenie powyżej 30 000 €)",
  },
  familyHeading: "Rodzina i odliczenia",
  familyHint: "Rodzinne odliczenia 2026 obowiązują tylko poniżej limitów dochodu rodziny 100 000 €, 150 000 € lub 200 000 €, zależnie od liczby dzieci. Osoba samotna bez dzieci może zarabiać najwyżej 40 000 € przy pozycjach dotyczących mieszkania i energii.",
  status: { single: "Osoba samotna", singleParent: "Samotny rodzic lub pełna opieka", married: "Małżeństwo lub związek" },
  statusLabel: "Stan rodzinny",
  spouseIncome: "Roczny dochód małżonka lub partnera",
  children: "Liczba dzieci",
  homeInterest: "Odsetki lub czynsz za główne mieszkanie (do 2 000 €)",
  disasterInsurance: "Ubezpieczenie domu od klęsk żywiołowych (do 500 €)",
  energyEv: "Efektywność energetyczna głównego mieszkania lub pojazd elektryczny (do 1 000 €)",
  otherDeductions: "Inne odliczenia rocznie: ubezpieczenie na życie, fundusz emerytalny, fundusz medyczny, darowizny",
  resultHeading: "Twój wynik za 2026",
  keepYear: "Zostaje Ci osobiście rocznie",
  keepMonth: "miesięcznie",
  retainedTitle: "Zostaje w Twojej firmie",
  burdenTitle: "Podatki i składki łącznie",
  ofPool: "całości",
  barKept: "Zostaje Ci",
  barRetained: "Zostaje w firmie",
  barBurden: "Podatki i składki",
  breakdownHeading: "Dokąd idzie podatek",
  lines: {
    corporate: "Podatek firmowy (15%)",
    employerCharges: "Składki pracodawcy od Twojej pensji",
    incomeTax: "Podatek dochodowy",
    social: "Ubezpieczenie społeczne",
    hrda: "Składka HRDA (działalność na własny rachunek)",
    ghs: "Składka zdrowotna (GHS)",
    sdc: "Special Defence Contribution",
    property: "Podatek od zysków kapitałowych z nieruchomości (20%)",
    crypto: "Podatek od zysków z krypto (8%)",
  },
  companyHeading: "W Twojej firmie",
  companyLines: {
    profit: "Zysk przed Twoją pensją",
    salary: "Twoja pensja",
    charges: "Składki pracodawcy",
    corporateTax: "Podatek firmowy (15%)",
    afterTax: "Zysk po podatku",
    dividend: "Dywidenda wypłacona Tobie",
    retained: "Zostaje w firmie",
  },
  bandsHeading: "Podatek dochodowy według progów",
  bandCols: { band: "Dochód do opodatkowania", rate: "Stawka", income: "W progu", tax: "Podatek" },
  above: "powyżej",
  insights: {
    nonDom: "Brak domicylu oszczędza Ci €{x} rocznie w porównaniu z rezydentem z domicylem.",
    dom: "Rezydent bez domicylu zapłaciłby rocznie o €{x} mniej.",
    pensionElected: "Stawka 5% od części emerytury powyżej 5 000 € jest tańsza niż normalna skala, więc jest stosowana.",
    pensionNormal: "Dla tej emerytury normalna skala jest tańsza niż stawka 5%, więc jest stosowana.",
    familyOff: "Przy tym dochodzie rodzinne odliczenia nie obowiązują.",
    otherCapped: "Inne odliczenia są ograniczone do jednej piątej dochodu do opodatkowania, więc część wpisanej kwoty nie jest liczona.",
    dividendCapped: "Dywidenda jest wyższa niż zysk firmy po podatku, więc zmniejszono ją do €{x}.",
    propertyExempt: "Zysk mieści się w zwolnieniu, więc podatek od zysków kapitałowych nie jest należny.",
  },
  empty: "Tu pojawi się Twój wynik.",
  emptyHint: "Wybierz przykład powyżej albo włącz źródło dochodu i wpisz kwotę.",
  seeResult: "Zobacz wynik",
  notesHeading: "Założenia kalkulatora",
  notes: [
    "Jesteś rezydentem podatkowym Cypru przez cały 2026 rok. Nierezydenci są opodatkowani inaczej.",
    "Podatek firmowy to 15% zysku po Twojej pensji i składkach pracodawcy od niej. Fikcyjny odsetek, domniemana dystrybucja i rozliczenia w grupie nie są uwzględnione.",
    "Dywidenda jest wypłacana z zysku po podatku firmowym. Od dywidend nie płaci się ubezpieczenia społecznego, płaci się GHS 2,65% do rocznego limitu 180 000 € dochodu.",
    "Dywidendy i odsetki są zwolnione z podatku dochodowego. Rezydent z domicylem płaci Special Defence Contribution: 5% od dywidend i 17% od odsetek.",
    "Ubezpieczenie społeczne: 8,8% wynagrodzenia do 68 904 € rocznie; działalność na własny rachunek 16,6% od faktycznego zysku do 68 900 € oraz 0,5% HRDA. Obowiązkowe minimum kategorii może podnieść rzeczywistą kwotę.",
    "Podatek od zysków kapitałowych z nieruchomości to 20% zysku powyżej zwolnienia 30 000 €, a dla głównego mieszkania 150 000 €; dla osoby obowiązuje tylko jedno z dwóch zwolnień. Zyski z krypto są opodatkowane stawką 8%.",
    "Emerytura z zagranicy jest opodatkowana stawką 5% od części powyżej 5 000 € albo według normalnej skali, zależnie od tego, co tańsze.",
    "Odliczenia: ubezpieczenie społeczne i GHS od dochodu podlegającego opodatkowaniu w całości; pozostałe pozycje do jednej piątej dochodu do opodatkowania.",
  ],
  disclaimer: "Informacja ogólna, nie porada podatkowa. Stawki i przepisy się zmieniają; sprawdź swój przypadek u licencjonowanego cypryjskiego doradcy podatkowego.",
  guideLead: "Jak powstają te liczby:",
};

const RU: TaxCalcStrings = {
  title: "Налоговый калькулятор Кипра на 2026 год",
  lead: "Включите источники своего дохода и меньше чем за минуту узнайте, что остаётся после кипрских налогов. Сделан для владельцев компаний и инвесторов. Введённые данные не покидают ваш браузер.",
  startFrom: "Начать с примера",
  presets: { owner: "Владелец компании", investor: "Инвестор", pension: "Пенсия из-за границы", freelancer: "Фрилансер", employee: "Сотрудник" },
  clear: "Очистить всё",
  statusHeading: "Ваш налоговый статус",
  statusOptions: {
    nonDom: { title: "Без домицилия", text: "Большинство переехавших на Кипр. Без специального оборонного взноса с дивидендов и процентов. Домицилий появляется после 17 из последних 20 лет налогового резидентства на Кипре." },
    dom: { title: "Домицилий на Кипре", text: "Платит специальный оборонный взнос: 5% с дивидендов и 17% с процентов." },
  },
  incomeHeading: "Откуда ваш доход",
  incomeHint: "Включите каждый источник, который у вас есть. Суммы в евро за весь год.",
  sources: {
    company: { title: "Ваша кипрская компания", hint: "Компания платит 15% налога с прибыли. Зарплату и дивиденды вы получаете из неё." },
    dividends: { title: "Дивиденды из других компаний", hint: "Акции, фонды или холдинг, на Кипре или за границей." },
    interest: { title: "Проценты", hint: "Банковские вклады, выданные займы, облигации." },
    property: { title: "Прибыль от продажи недвижимости на Кипре", hint: "Налог на прирост капитала 20% после льготы." },
    crypto: { title: "Прибыль от продажи криптоактивов", hint: "Плоские 8% с чистой прибыли за год." },
    pension: { title: "Пенсия из-за границы", hint: "5% с суммы выше €5 000 или обычная шкала, смотря что дешевле." },
    selfEmployed: { title: "Прибыль самозанятого", hint: "ИП или фрилансер, с фактической прибыли." },
    employment: { title: "Зарплата у работодателя", hint: "До налогов и взносов." },
  },
  fields: {
    companyProfit: "Прибыль компании до вашей зарплаты и налога",
    companyProfitHint: "Прибыль за год, до зарплаты, которую вы себе платите.",
    companySalary: "Зарплата, которую компания платит вам",
    companySalaryHint: "Расход компании. С неё платятся социальное страхование и GHS.",
    companyDividend: "Дивиденд, который компания платит вам",
    companyDividendHint: "Выплачивается из прибыли после налога компании.",
    dividends: "Дивиденды в год",
    interest: "Проценты в год",
    propertyGain: "Облагаемая прибыль",
    propertyGainHint: "Цена продажи минус индексированная стоимость и расходы на покупку и продажу.",
    propertyMainHome: "Это было моё основное жильё не менее пяти лет",
    cryptoGain: "Чистая прибыль за год",
    cryptoGainHint: "Прибыль от продажи, обмена или трат крипты, после убытков того же года.",
    pension: "Пенсия в год",
    pensionS1: "Есть форма S1 или A1, поэтому GHS с пенсии нет",
    selfEmployed: "Прибыль в год",
    employment: "Зарплата до налогов в год",
    exemption: "Льгота для тех, кто начинает работать на Кипре",
    exemptionHint: "Условия подробные. Прежде чем рассчитывать на льготу, подтвердите у кипрского налогового консультанта, что вы ей соответствуете.",
  },
  exemption: {
    none: "Нет",
    half: "50% зарплаты, при зарплате выше €55 000 (первая работа после 2021 года)",
    fifth: "20% зарплаты, не более €8 550 в год",
    quarter: "25% зарплаты, не более €25 000 в год (зарплата выше €30 000)",
  },
  familyHeading: "Семья и вычеты",
  familyHint: "Семейные вычеты 2026 года действуют только при доходе семьи ниже €100 000, €150 000 или €200 000, в зависимости от числа детей. Одинокому без детей для вычетов на жильё и энергию нужен доход не выше €40 000.",
  status: { single: "Один человек", singleParent: "Одинокий родитель или полная опека", married: "В браке или партнёрстве" },
  statusLabel: "Семейное положение",
  spouseIncome: "Годовой доход супруга или партнёра",
  children: "Количество детей",
  homeInterest: "Проценты по ипотеке или аренда основного жилья (до €2 000)",
  disasterInsurance: "Страхование дома от стихийных бедствий (до €500)",
  energyEv: "Энергоэффективность основного жилья или электромобиль (до €1 000)",
  otherDeductions: "Другие вычеты в год: страхование жизни, пенсионный фонд, медицинский фонд, пожертвования",
  resultHeading: "Ваш результат на 2026 год",
  keepYear: "Лично остаётся в год",
  keepMonth: "в месяц",
  retainedTitle: "Остаётся в вашей компании",
  burdenTitle: "Налоги и взносы вместе",
  ofPool: "от всей суммы",
  barKept: "Остаётся вам",
  barRetained: "Остаётся в компании",
  barBurden: "Налоги и взносы",
  breakdownHeading: "Куда уходит налог",
  lines: {
    corporate: "Налог компании (15%)",
    employerCharges: "Взносы работодателя с вашей зарплаты",
    incomeTax: "Подоходный налог",
    social: "Социальное страхование",
    hrda: "Взнос HRDA (самозанятые)",
    ghs: "Взнос на здравоохранение (GHS)",
    sdc: "Специальный оборонный взнос",
    property: "Налог на прирост капитала с недвижимости (20%)",
    crypto: "Налог с прибыли от крипты (8%)",
  },
  companyHeading: "Внутри вашей компании",
  companyLines: {
    profit: "Прибыль до вашей зарплаты",
    salary: "Ваша зарплата",
    charges: "Взносы работодателя",
    corporateTax: "Налог компании (15%)",
    afterTax: "Прибыль после налога",
    dividend: "Дивиденд, выплаченный вам",
    retained: "Остаётся в компании",
  },
  bandsHeading: "Подоходный налог по ступеням",
  bandCols: { band: "Налогооблагаемый доход", rate: "Ставка", income: "В ступени", tax: "Налог" },
  above: "свыше",
  insights: {
    nonDom: "Статус без домицилия экономит вам €{x} в год по сравнению с резидентом с домицилием.",
    dom: "Резидент без домицилия заплатил бы на €{x} в год меньше.",
    pensionElected: "Ставка 5% на часть пенсии выше €5 000 дешевле обычной шкалы, поэтому применена она.",
    pensionNormal: "Для этой пенсии обычная шкала дешевле ставки 5%, поэтому применена она.",
    familyOff: "При таком доходе семейные вычеты не действуют.",
    otherCapped: "Другие вычеты ограничены одной пятой налогооблагаемого дохода, поэтому часть введённой суммы не учтена.",
    dividendCapped: "Дивиденд больше, чем остаётся у компании после налога, поэтому он уменьшен до €{x}.",
    propertyExempt: "Прибыль укладывается в льготу, налог на прирост капитала не возникает.",
  },
  empty: "Здесь появится ваш результат.",
  emptyHint: "Выберите пример выше или включите источник дохода и введите сумму.",
  seeResult: "Смотреть результат",
  notesHeading: "Допущения калькулятора",
  notes: [
    "Вы налоговый резидент Кипра весь 2026 год. Нерезиденты облагаются иначе.",
    "Налог компании 15% от прибыли после вашей зарплаты и взносов работодателя с неё. Условный вычет процентов, условное распределение и групповой зачёт убытков не моделируются.",
    "Дивиденд выплачивается из прибыли после налога компании. Социальное страхование с дивидендов не берут, GHS 2,65% берут, до годового максимума €180 000 дохода.",
    "Дивиденды и проценты освобождены от подоходного налога. Резидент с домицилием платит специальный оборонный взнос: 5% с дивидендов и 17% с процентов.",
    "Социальное страхование: 8,8% зарплаты до €68 904 в год; самозанятые платят 16,6% с фактической прибыли до €68 900 и 0,5% HRDA. Обязательный минимум категории может увеличить реальную сумму.",
    "Налог на прирост капитала с недвижимости 20% с прибыли выше льготы €30 000, а для основного жилья €150 000; человеку полагается только одна из двух льгот. Прибыль от крипты облагается по ставке 8%.",
    "Пенсия из-за границы облагается по ставке 5% на часть выше €5 000 или по обычной шкале, смотря что дешевле.",
    "Вычеты: социальное страхование и GHS с облагаемого дохода полностью; остальное до одной пятой налогооблагаемого дохода.",
  ],
  disclaimer: "Общая информация, не налоговая консультация. Ставки и правила меняются; проверьте свой случай у лицензированного налогового консультанта на Кипре.",
  guideLead: "Как получены цифры:",
};

const STRINGS: Record<string, TaxCalcStrings> = { en: EN, de: DE, pl: PL, ru: RU };
export const taxCalcStrings = (lang: string): TaxCalcStrings => STRINGS[lang] ?? EN;
