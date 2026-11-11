// UI strings of the Cyprus tax calculator block (en, de, pl, ru). Hebrew has no guides section and falls back to English.
export type TaxCalcStrings = {
  title: string;
  lead: string;
  perYear: string;
  perMonth: string;
  amountsIn: string;
  incomeHeading: string;
  employment: string;
  selfEmployed: string;
  foreignPension: string;
  rent: string;
  dividends: string;
  interest: string;
  moreIncome: string;
  domiciled: string;
  domiciledHint: string;
  pensionS1: string;
  exemptionHeading: string;
  exemption: { none: string; half: string; fifth: string; quarter: string };
  exemptionHint: string;
  familyHeading: string;
  status: { single: string; singleParent: string; married: string };
  statusLabel: string;
  spouseIncome: string;
  children: string;
  homeInterest: string;
  disasterInsurance: string;
  energyEv: string;
  otherDeductions: string;
  familyHint: string;
  resultHeading: string;
  netYear: string;
  netMonth: string;
  burden: string;
  effective: string;
  grossTotal: string;
  lines: {
    incomeTax: string;
    social: string;
    hrda: string;
    ghs: string;
    sdc: string;
    exempt: string;
    chargeable: string;
    deductions: string;
  };
  bandsHeading: string;
  bandCols: { band: string; rate: string; income: string; tax: string };
  above: string;
  pensionElected: string;
  pensionNormal: string;
  familyOff: string;
  otherCapped: string;
  empty: string;
  reset: string;
  notesHeading: string;
  notes: string[];
  disclaimer: string;
  guideLead: string;
  barNet: string;
  barTax: string;
  barContrib: string;
};

const EN: TaxCalcStrings = {
  title: "Cyprus tax calculator for 2026",
  lead: "Enter your income to see income tax, social insurance, health contributions (GHS) and what you keep, on the 2026 rates. Nothing you type leaves your browser.",
  perYear: "per year",
  perMonth: "per month",
  amountsIn: "Enter amounts",
  incomeHeading: "Income",
  employment: "Salary from employment (gross)",
  selfEmployed: "Self-employed profit",
  foreignPension: "Pension from abroad",
  rent: "Rent received (gross)",
  dividends: "Dividends",
  interest: "Interest",
  moreIncome: "Dividends, interest and other options",
  domiciled: "I am domiciled in Cyprus (the Special Defence Contribution applies)",
  domiciledHint: "A non-domiciled resident pays no Special Defence Contribution on dividends and interest. A foreigner becomes domiciled after 17 of the last 20 years as a tax resident.",
  pensionS1: "My pension comes with an S1 or A1 (no GHS on the pension)",
  exemptionHeading: "Exemption for people who start work in Cyprus",
  exemption: {
    none: "None",
    half: "50% of pay, for pay above €55,000 (first employment after 2021)",
    fifth: "20% of pay, up to €8,550 a year",
    quarter: "25% of pay, up to €25,000 a year (pay above €30,000)",
  },
  exemptionHint: "The conditions are detailed. Confirm that you qualify with a Cyprus tax adviser before you rely on one.",
  familyHeading: "Family and deductions",
  status: { single: "Single", singleParent: "Single parent or full custody", married: "Married or in a partnership" },
  statusLabel: "Status",
  spouseIncome: "Income of spouse or partner per year",
  children: "Number of children",
  homeInterest: "Interest or rent on the main home (up to €2,000)",
  disasterInsurance: "Home insurance against natural disasters (up to €500)",
  energyEv: "Energy efficiency of the main home or an electric vehicle (up to €1,000)",
  otherDeductions: "Other deductible items per year: life insurance, pension fund, medical fund, donations",
  familyHint: "The 2026 family deductions apply only below family income ceilings of €100,000, €150,000 or €200,000, by number of children. A single person without children needs an income of no more than €40,000 for the home and energy items.",
  resultHeading: "Your 2026 result",
  netYear: "You keep per year",
  netMonth: "per month",
  burden: "Total tax and contributions",
  effective: "of your income",
  grossTotal: "Gross income",
  lines: {
    incomeTax: "Income tax",
    social: "Social insurance",
    hrda: "HRDA contribution (self-employed)",
    ghs: "Health system contribution (GHS)",
    sdc: "Special Defence Contribution",
    exempt: "Exempt part of pay",
    chargeable: "Chargeable income",
    deductions: "Deductions",
  },
  bandsHeading: "Income tax by band",
  bandCols: { band: "Chargeable income", rate: "Rate", income: "In band", tax: "Tax" },
  above: "above",
  pensionElected: "The 5% rate on the part of the pension above €5,000 is cheaper than the normal scale, so it is used.",
  pensionNormal: "The normal scale is cheaper for the pension than the 5% rate, so it is used.",
  familyOff: "The family deductions do not apply at this income.",
  otherCapped: "The other deductions are limited to one fifth of chargeable income, so part of what you entered is not counted.",
  empty: "Enter an income to see the result.",
  reset: "Clear",
  notesHeading: "What this calculator assumes",
  notes: [
    "Tax resident of Cyprus for the whole of 2026. Non-residents are taxed differently.",
    "Social insurance: 8.8% of salary up to €68,904 a year; self-employed 16.6% on actual profit up to €68,900 and 0.5% HRDA. The compulsory minimum of the self-employed category can make the real figure higher.",
    "GHS: 2.65% on salary, pension, rent, dividends and interest, 4% on self-employed profit, with one annual maximum of €180,000 of income.",
    "Rent is taxed after a deemed 20% deduction; the Special Defence Contribution on rent was abolished from 2026.",
    "A pension from abroad is taxed at 5% on the part above €5,000 or on the normal scale, whichever is cheaper.",
    "Deductions: social insurance and GHS in full; the other items up to one fifth of chargeable income. The employer's side is not included.",
  ],
  disclaimer: "General information, not tax advice. Rates and rules change; check your own case with a licensed Cyprus tax adviser.",
  guideLead: "How the figures are built:",
  barNet: "You keep",
  barTax: "Income tax",
  barContrib: "Contributions",
};

const DE: TaxCalcStrings = {
  title: "Steuerrechner Zypern 2026",
  lead: "Geben Sie Ihr Einkommen ein und sehen Sie Einkommensteuer, Sozialversicherung, Gesundheitsbeitrag (GHS) und das Netto nach den Sätzen von 2026. Ihre Eingaben verlassen den Browser nicht.",
  perYear: "pro Jahr",
  perMonth: "pro Monat",
  amountsIn: "Beträge eingeben",
  incomeHeading: "Einkommen",
  employment: "Gehalt aus Anstellung (brutto)",
  selfEmployed: "Gewinn aus selbständiger Tätigkeit",
  foreignPension: "Rente aus dem Ausland",
  rent: "Mieteinnahmen (brutto)",
  dividends: "Dividenden",
  interest: "Zinsen",
  moreIncome: "Dividenden, Zinsen und weitere Optionen",
  domiciled: "Ich habe meinen Domizilstatus in Zypern (Sonderverteidigungsabgabe fällt an)",
  domiciledHint: "Wer nicht domiziliert ist, zahlt auf Dividenden und Zinsen keine Sonderverteidigungsabgabe. Ein Ausländer gilt nach 17 von 20 Jahren als steuerlich Ansässiger als domiziliert.",
  pensionS1: "Meine Rente kommt mit S1 oder A1 (kein GHS auf die Rente)",
  exemptionHeading: "Befreiung für Personen, die in Zypern erstmals arbeiten",
  exemption: {
    none: "Keine",
    half: "50 % des Gehalts, bei Gehalt über 55.000 € (erste Beschäftigung nach 2021)",
    fifth: "20 % des Gehalts, bis 8.550 € im Jahr",
    quarter: "25 % des Gehalts, bis 25.000 € im Jahr (Gehalt über 30.000 €)",
  },
  exemptionHint: "Die Voraussetzungen sind im Einzelnen geregelt. Lassen Sie sich von einem zypriotischen Steuerberater bestätigen, dass Sie sie erfüllen.",
  familyHeading: "Familie und Abzüge",
  status: { single: "Ledig", singleParent: "Alleinerziehend oder volles Sorgerecht", married: "Verheiratet oder in Partnerschaft" },
  statusLabel: "Familienstand",
  spouseIncome: "Einkommen von Ehe- oder Lebenspartner pro Jahr",
  children: "Anzahl der Kinder",
  homeInterest: "Zinsen oder Miete für die Hauptwohnung (bis 2.000 €)",
  disasterInsurance: "Wohngebäudeversicherung gegen Naturgefahren (bis 500 €)",
  energyEv: "Energieeffizienz der Hauptwohnung oder Elektrofahrzeug (bis 1.000 €)",
  otherDeductions: "Weitere abzugsfähige Posten pro Jahr: Lebensversicherung, Pensionskasse, Krankenkasse, Spenden",
  familyHint: "Die Familienabzüge 2026 gelten nur unter Familieneinkommensgrenzen von 100.000 €, 150.000 € oder 200.000 €, je nach Kinderzahl. Eine alleinstehende Person ohne Kinder darf für die Posten Wohnung und Energie höchstens 40.000 € verdienen.",
  resultHeading: "Ihr Ergebnis für 2026",
  netYear: "Sie behalten pro Jahr",
  netMonth: "pro Monat",
  burden: "Steuern und Beiträge zusammen",
  effective: "Ihres Einkommens",
  grossTotal: "Bruttoeinkommen",
  lines: {
    incomeTax: "Einkommensteuer",
    social: "Sozialversicherung",
    hrda: "HRDA-Beitrag (Selbständige)",
    ghs: "Gesundheitsbeitrag (GHS)",
    sdc: "Sonderverteidigungsabgabe",
    exempt: "Befreiter Teil des Gehalts",
    chargeable: "Steuerpflichtiges Einkommen",
    deductions: "Abzüge",
  },
  bandsHeading: "Einkommensteuer nach Stufen",
  bandCols: { band: "Steuerpflichtiges Einkommen", rate: "Satz", income: "In der Stufe", tax: "Steuer" },
  above: "über",
  pensionElected: "Der Satz von 5 % auf den Teil der Rente über 5.000 € ist günstiger als der normale Tarif und wird angewendet.",
  pensionNormal: "Für die Rente ist der normale Tarif günstiger als der Satz von 5 % und wird angewendet.",
  familyOff: "Die Familienabzüge gelten bei diesem Einkommen nicht.",
  otherCapped: "Die weiteren Abzüge sind auf ein Fünftel des steuerpflichtigen Einkommens begrenzt, ein Teil Ihrer Angabe wird daher nicht berücksichtigt.",
  empty: "Geben Sie ein Einkommen ein, um das Ergebnis zu sehen.",
  reset: "Zurücksetzen",
  notesHeading: "Annahmen des Rechners",
  notes: [
    "Steuerlich in Zypern ansässig für das ganze Jahr 2026. Nicht Ansässige werden anders besteuert.",
    "Sozialversicherung: 8,8 % des Gehalts bis 68.904 € im Jahr; Selbständige 16,6 % auf den tatsächlichen Gewinn bis 68.900 € und 0,5 % HRDA. Das Pflichtminimum der Berufskategorie kann den tatsächlichen Betrag erhöhen.",
    "GHS: 2,65 % auf Gehalt, Rente, Miete, Dividenden und Zinsen, 4 % auf den Gewinn Selbständiger, mit einem Jahreshöchstbetrag von 180.000 € Einkommen.",
    "Mieten werden nach einem pauschalen Abzug von 20 % besteuert; die Sonderverteidigungsabgabe auf Mieten entfällt seit 2026.",
    "Eine Rente aus dem Ausland wird mit 5 % auf den Teil über 5.000 € oder nach dem normalen Tarif besteuert, je nachdem, was günstiger ist.",
    "Abzüge: Sozialversicherung und GHS voll; die übrigen Posten bis zu einem Fünftel des steuerpflichtigen Einkommens. Die Arbeitgeberseite ist nicht enthalten.",
  ],
  disclaimer: "Allgemeine Information, keine Steuerberatung. Sätze und Regeln ändern sich; lassen Sie Ihren Fall von einem zugelassenen zypriotischen Steuerberater prüfen.",
  guideLead: "So entstehen die Zahlen:",
  barNet: "Sie behalten",
  barTax: "Einkommensteuer",
  barContrib: "Beiträge",
};

const PL: TaxCalcStrings = {
  title: "Kalkulator podatkowy Cypr 2026",
  lead: "Wpisz dochód, aby zobaczyć podatek dochodowy, składki na ubezpieczenie społeczne, składkę zdrowotną (GHS) i kwotę, która zostaje, według stawek na 2026 rok. To, co wpiszesz, nie opuszcza Twojej przeglądarki.",
  perYear: "rocznie",
  perMonth: "miesięcznie",
  amountsIn: "Wpisuj kwoty",
  incomeHeading: "Dochód",
  employment: "Wynagrodzenie z etatu (brutto)",
  selfEmployed: "Zysk z działalności na własny rachunek",
  foreignPension: "Emerytura z zagranicy",
  rent: "Otrzymany czynsz (brutto)",
  dividends: "Dywidendy",
  interest: "Odsetki",
  moreIncome: "Dywidendy, odsetki i dalsze opcje",
  domiciled: "Mam domicyl na Cyprze (obowiązuje Special Defence Contribution)",
  domiciledHint: "Rezydent bez domicylu nie płaci Special Defence Contribution od dywidend i odsetek. Cudzoziemiec uzyskuje domicyl po 17 z ostatnich 20 lat jako rezydent podatkowy.",
  pensionS1: "Moja emerytura ma S1 lub A1 (bez GHS od emerytury)",
  exemptionHeading: "Zwolnienie dla osób, które zaczynają pracę na Cyprze",
  exemption: {
    none: "Brak",
    half: "50% wynagrodzenia, przy wynagrodzeniu powyżej 55 000 € (pierwsze zatrudnienie po 2021)",
    fifth: "20% wynagrodzenia, do 8 550 € rocznie",
    quarter: "25% wynagrodzenia, do 25 000 € rocznie (wynagrodzenie powyżej 30 000 €)",
  },
  exemptionHint: "Warunki są szczegółowe. Potwierdź u cypryjskiego doradcy podatkowego, że je spełniasz, zanim na nich oprzesz plan.",
  familyHeading: "Rodzina i odliczenia",
  status: { single: "Osoba samotna", singleParent: "Samotny rodzic lub pełna opieka", married: "Małżeństwo lub związek" },
  statusLabel: "Stan rodzinny",
  spouseIncome: "Roczny dochód małżonka lub partnera",
  children: "Liczba dzieci",
  homeInterest: "Odsetki lub czynsz za główne mieszkanie (do 2 000 €)",
  disasterInsurance: "Ubezpieczenie domu od klęsk żywiołowych (do 500 €)",
  energyEv: "Efektywność energetyczna głównego mieszkania lub pojazd elektryczny (do 1 000 €)",
  otherDeductions: "Inne odliczenia rocznie: ubezpieczenie na życie, fundusz emerytalny, fundusz medyczny, darowizny",
  familyHint: "Rodzinne odliczenia 2026 obowiązują tylko poniżej limitów dochodu rodziny 100 000 €, 150 000 € lub 200 000 €, zależnie od liczby dzieci. Osoba samotna bez dzieci może zarabiać najwyżej 40 000 € przy pozycjach dotyczących mieszkania i energii.",
  resultHeading: "Twój wynik za 2026",
  netYear: "Zostaje Ci rocznie",
  netMonth: "miesięcznie",
  burden: "Podatki i składki łącznie",
  effective: "Twojego dochodu",
  grossTotal: "Dochód brutto",
  lines: {
    incomeTax: "Podatek dochodowy",
    social: "Ubezpieczenie społeczne",
    hrda: "Składka HRDA (działalność na własny rachunek)",
    ghs: "Składka zdrowotna (GHS)",
    sdc: "Special Defence Contribution",
    exempt: "Zwolniona część wynagrodzenia",
    chargeable: "Dochód do opodatkowania",
    deductions: "Odliczenia",
  },
  bandsHeading: "Podatek dochodowy według progów",
  bandCols: { band: "Dochód do opodatkowania", rate: "Stawka", income: "W progu", tax: "Podatek" },
  above: "powyżej",
  pensionElected: "Stawka 5% od części emerytury powyżej 5 000 € jest tańsza niż normalna skala, więc jest stosowana.",
  pensionNormal: "Dla emerytury normalna skala jest tańsza niż stawka 5%, więc jest stosowana.",
  familyOff: "Przy tym dochodzie rodzinne odliczenia nie obowiązują.",
  otherCapped: "Inne odliczenia są ograniczone do jednej piątej dochodu do opodatkowania, więc część wpisanej kwoty nie jest liczona.",
  empty: "Wpisz dochód, aby zobaczyć wynik.",
  reset: "Wyczyść",
  notesHeading: "Założenia kalkulatora",
  notes: [
    "Rezydent podatkowy Cypru przez cały 2026 rok. Nierezydenci są opodatkowani inaczej.",
    "Ubezpieczenie społeczne: 8,8% wynagrodzenia do 68 904 € rocznie; działalność na własny rachunek 16,6% od faktycznego zysku do 68 900 € oraz 0,5% HRDA. Obowiązkowe minimum kategorii zawodowej może podnieść rzeczywistą kwotę.",
    "GHS: 2,65% od wynagrodzenia, emerytury, czynszu, dywidend i odsetek, 4% od zysku z działalności na własny rachunek, z jednym rocznym limitem 180 000 € dochodu.",
    "Czynsz jest opodatkowany po zryczałtowanym odliczeniu 20%; Special Defence Contribution od czynszu zniesiono od 2026 roku.",
    "Emerytura z zagranicy jest opodatkowana stawką 5% od części powyżej 5 000 € albo według normalnej skali, zależnie od tego, co tańsze.",
    "Odliczenia: ubezpieczenie społeczne i GHS w całości; pozostałe pozycje do jednej piątej dochodu do opodatkowania. Strona pracodawcy nie jest uwzględniona.",
  ],
  disclaimer: "Informacja ogólna, nie porada podatkowa. Stawki i przepisy się zmieniają; sprawdź swój przypadek u licencjonowanego cypryjskiego doradcy podatkowego.",
  guideLead: "Jak powstają te liczby:",
  barNet: "Zostaje Ci",
  barTax: "Podatek dochodowy",
  barContrib: "Składki",
};

const RU: TaxCalcStrings = {
  title: "Налоговый калькулятор Кипра на 2026 год",
  lead: "Введите доход и получите подоходный налог, социальное страхование, взнос на здравоохранение (GHS) и сумму на руки по ставкам 2026 года. Введённые данные не покидают ваш браузер.",
  perYear: "в год",
  perMonth: "в месяц",
  amountsIn: "Суммы вводить",
  incomeHeading: "Доход",
  employment: "Зарплата по найму (до налогов)",
  selfEmployed: "Прибыль самозанятого",
  foreignPension: "Пенсия из-за границы",
  rent: "Полученная аренда (до налогов)",
  dividends: "Дивиденды",
  interest: "Проценты",
  moreIncome: "Дивиденды, проценты и дополнительные параметры",
  domiciled: "У меня кипрский домицилий (действует специальный оборонный взнос)",
  domiciledHint: "Резидент без домицилия не платит специальный оборонный взнос с дивидендов и процентов. Иностранец получает домицилий после 17 из последних 20 лет налогового резидентства.",
  pensionS1: "Моя пенсия с формой S1 или A1 (без GHS с пенсии)",
  exemptionHeading: "Льгота для тех, кто начинает работать на Кипре",
  exemption: {
    none: "Нет",
    half: "50% зарплаты, при зарплате выше €55 000 (первая работа после 2021 года)",
    fifth: "20% зарплаты, не более €8 550 в год",
    quarter: "25% зарплаты, не более €25 000 в год (зарплата выше €30 000)",
  },
  exemptionHint: "Условия подробные. Прежде чем рассчитывать на льготу, подтвердите у кипрского налогового консультанта, что вы ей соответствуете.",
  familyHeading: "Семья и вычеты",
  status: { single: "Один человек", singleParent: "Одинокий родитель или полная опека", married: "В браке или партнёрстве" },
  statusLabel: "Семейное положение",
  spouseIncome: "Годовой доход супруга или партнёра",
  children: "Количество детей",
  homeInterest: "Проценты по ипотеке или аренда основного жилья (до €2 000)",
  disasterInsurance: "Страхование дома от стихийных бедствий (до €500)",
  energyEv: "Энергоэффективность основного жилья или электромобиль (до €1 000)",
  otherDeductions: "Другие вычеты в год: страхование жизни, пенсионный фонд, медицинский фонд, пожертвования",
  familyHint: "Семейные вычеты 2026 года действуют только при доходе семьи ниже €100 000, €150 000 или €200 000, в зависимости от числа детей. Одинокому без детей для вычетов на жильё и энергию нужен доход не выше €40 000.",
  resultHeading: "Ваш результат на 2026 год",
  netYear: "На руки в год",
  netMonth: "в месяц",
  burden: "Налоги и взносы вместе",
  effective: "от дохода",
  grossTotal: "Доход до налогов",
  lines: {
    incomeTax: "Подоходный налог",
    social: "Социальное страхование",
    hrda: "Взнос HRDA (самозанятые)",
    ghs: "Взнос на здравоохранение (GHS)",
    sdc: "Специальный оборонный взнос",
    exempt: "Освобождённая часть зарплаты",
    chargeable: "Налогооблагаемый доход",
    deductions: "Вычеты",
  },
  bandsHeading: "Подоходный налог по ступеням",
  bandCols: { band: "Налогооблагаемый доход", rate: "Ставка", income: "В ступени", tax: "Налог" },
  above: "свыше",
  pensionElected: "Ставка 5% на часть пенсии выше €5 000 дешевле обычной шкалы, поэтому применена она.",
  pensionNormal: "Для пенсии обычная шкала дешевле ставки 5%, поэтому применена она.",
  familyOff: "При таком доходе семейные вычеты не действуют.",
  otherCapped: "Другие вычеты ограничены одной пятой налогооблагаемого дохода, поэтому часть введённой суммы не учтена.",
  empty: "Введите доход, чтобы увидеть результат.",
  reset: "Очистить",
  notesHeading: "Допущения калькулятора",
  notes: [
    "Налоговый резидент Кипра весь 2026 год. Нерезиденты облагаются иначе.",
    "Социальное страхование: 8,8% зарплаты до €68 904 в год; самозанятые 16,6% с фактической прибыли до €68 900 и 0,5% HRDA. Обязательный минимум профессиональной категории может увеличить реальную сумму.",
    "GHS: 2,65% с зарплаты, пенсии, аренды, дивидендов и процентов, 4% с прибыли самозанятых, с одним годовым максимумом €180 000 дохода.",
    "Аренда облагается после условного вычета 20%; специальный оборонный взнос с аренды отменён с 2026 года.",
    "Пенсия из-за границы облагается по ставке 5% на часть выше €5 000 или по обычной шкале, смотря что дешевле.",
    "Вычеты: социальное страхование и GHS полностью; остальное до одной пятой налогооблагаемого дохода. Сторона работодателя не включена.",
  ],
  disclaimer: "Общая информация, не налоговая консультация. Ставки и правила меняются; проверьте свой случай у лицензированного налогового консультанта на Кипре.",
  guideLead: "Как получены цифры:",
  barNet: "На руки",
  barTax: "Подоходный налог",
  barContrib: "Взносы",
};

const STRINGS: Record<string, TaxCalcStrings> = { en: EN, de: DE, pl: PL, ru: RU };
export const taxCalcStrings = (lang: string): TaxCalcStrings => STRINGS[lang] ?? EN;
