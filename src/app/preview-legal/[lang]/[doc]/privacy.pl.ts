import type { LegalDoc } from "./types";

/* Polityka prywatności — polski. Treść odpowiada wersji angielskiej
   (privacy.en.ts), gdzie opisano też, które obowiązkowe informacje RODO
   uzupełniono względem starego tekstu. Identyfikatory kotwic celowo NIE są
   tłumaczone, aby ta sama sekcja miała ten sam adres we wszystkich językach.
   Dostosowano do angielskiej wersji zmienionej 2026-11-02.

   TO NIE JEST porada prawna — przed publikacją wymagana weryfikacja prawnika. */

export const PRIVACY_PL: LegalDoc = {
  metaTitle: "Polityka prywatności — Cyprus VIP Estates",
  metaDescription:
    "Jak Cyprus VIP Estates (SecretBrand Solutions LTD) zbiera, wykorzystuje, udostępnia i chroni Twoje dane osobowe oraz jakie prawa przysługują Ci na mocy RODO.",
  eyebrow: "Informacje prawne",
  title: "Polityka prywatności",
  intro:
    "Ta polityka wyjaśnia, jakie dane osobowe zbieramy, gdy korzystasz z tej witryny lub kontaktujesz się z nami, dlaczego je przetwarzamy, kto je otrzymuje, jak długo je przechowujemy i z jakich praw możesz skorzystać w każdej chwili.",
  updatedLabel: "Ostatnia aktualizacja",
  updated: "2026-11-02",
  tocLabel: "Na tej stronie",

  sections: [
    {
      id: "controller",
      title: "1. Kto jest administratorem",
      blocks: [
        { kind: "p", text: "Administratorem danych osobowych przetwarzanych w tej witrynie jest:" },
        { kind: "list", items: [
          "SecretBrand Solutions LTD, działająca pod marką „Cyprus VIP Estates”",
          "Palaion Patron Germanou 11, 8011 Pafos, Cypr",
          "E-mail: office@cyprusvipestates.com",
          "Telefon: +357 99 278 285",
        ]},
        { kind: "p", text: "W każdej sprawie dotyczącej Twoich danych — dostępu, sprostowania, usunięcia lub czegokolwiek innego z tej polityki — napisz na powyższy adres; wiadomość trafi do osoby odpowiedzialnej." },
      ],
    },
    {
      id: "data-we-collect",
      title: "2. Co zbieramy i dlaczego",
      blocks: [
        { kind: "definitions", items: [
          { term: "Pliki dziennika serwera", text: "Przy każdym żądaniu strony serwer zapisuje żądaną stronę, typ i wersję przeglądarki, system operacyjny, adres odsyłający, czas żądania i adres IP. Jest to technicznie niezbędne do udostępnienia witryny i wykrywania nadużyć. Dane nie są łączone z innymi źródłami. Podstawa prawna: art. 6 ust. 1 lit. f RODO (nasz prawnie uzasadniony interes w bezpiecznej, działającej witrynie)." },
          { term: "Zapytania i formularze", text: "Gdy przesyłasz nam zapytanie — przez formularz kontaktowy, kalkulator ROI, prośbę o jeden z naszych bezpłatnych przewodników lub formularz współpracy partnerskiej — przechowujemy to, co wpiszesz: zwykle imię i nazwisko, adres e-mail, numer telefonu, preferowany kanał kontaktu i treść wiadomości, a także odpowiedzi na pytania nieobowiązkowe, jeśli ich udzielisz (na przykład budżet, termin, rodzaj nieruchomości lub obywatelstwo). Odnotowujemy również stronę, z której wysłano zapytanie, oraz to, w jaki sposób trafiłeś na naszą witrynę (zob. „Atrybucja kampanii”). Odpowiadamy e-mailem, telefonicznie lub przez WhatsApp, przesyłamy przewodnik lub wyliczenie, o które prosiłeś, i przechowujemy zapytanie w naszym systemie obsługi klienta, aby opiekująca się Tobą osoba widziała jego historię. Podstawa prawna: art. 6 ust. 1 lit. b RODO (działania przed zawarciem umowy na Twoje żądanie)." },
          { term: "Korespondencja e-mailowa i przez WhatsApp", text: "Wiadomości, które wymieniasz z nami e-mailem lub przez WhatsApp, są dołączane do Twojego zapytania, aby każdy, kto Ci odpowiada, wiedział, co zostało już omówione. Podstawa prawna: art. 6 ust. 1 lit. b RODO oraz art. 6 ust. 1 lit. f RODO (nasz prawnie uzasadniony interes w posiadaniu pełnej dokumentacji naszego doradztwa)." },
          { term: "Zapytania przez formularze w reklamach na Facebooku i Instagramie", text: "Jeśli wypełnisz formularz kontaktowy w jednej z naszych reklam na Facebooku lub Instagramie, Meta Platforms Ireland Limited przekazuje nam podane tam dane (zwykle imię i nazwisko, dane kontaktowe i Twoje odpowiedzi). Traktujemy je tak samo jak każde inne zapytanie. Podstawa prawna: art. 6 ust. 1 lit. b RODO." },
          { term: "Polecenia od naszych partnerów", text: "Jeśli polecił Cię nam partner — na przykład inny agent lub doradca — Twoje dane otrzymaliśmy od tego partnera. W naszym portalu partnerskim partner może śledzić etap swojego polecenia oraz przygotowane przez nas prezentacje nieruchomości. Podstawa prawna: art. 6 ust. 1 lit. b RODO oraz art. 6 ust. 1 lit. f RODO (nasz prawnie uzasadniony interes we współpracy z partnerami, którzy polecają nam klientów)." },
          { term: "Osobiste prezentacje nieruchomości", text: "Możemy przesłać Ci osobisty link do wybranych nieruchomości. Gdy go otworzysz, zapisujemy, kiedy i jak długo oglądałeś prezentację oraz które nieruchomości oznaczyłeś jako ulubione, a osoba, która ją przygotowała, otrzymuje powiadomienie — dzięki temu możemy nawiązać do tego, co rzeczywiście Cię interesuje. Link wygasa po 30 dniach, chyba że uzgodnimy inaczej. Podstawa prawna: art. 6 ust. 1 lit. b RODO oraz art. 6 ust. 1 lit. f RODO (nasz prawnie uzasadniony interes w dopasowaniu naszego doradztwa do Twoich potrzeb)." },
          { term: "Terminy spotkań", text: "Jeśli proponujesz lub potwierdzasz termin przez naszą stronę rezerwacji, przetwarzamy proponowane godziny, Twoją strefę czasową i dane kontaktowe w celu ustalenia i potwierdzenia spotkania. Jeśli uzgodnimy spotkanie w formie wideorozmowy, dostawca używanej przez nas usługi wideo (na przykład Zoom) przetwarza dane niezbędne do nawiązania połączenia. Podstawa prawna: art. 6 ust. 1 lit. b RODO." },
          { term: "Newsletter", text: "Po zapisaniu się przetwarzamy Twój adres e-mail, aby wysyłać newsletter. Podstawa prawna: art. 6 ust. 1 lit. a RODO (zgoda), którą możesz wycofać w każdej chwili, pisząc na office@cyprusvipestates.com." },
          { term: "Statystyka witryny (własna, bez plików cookie)", text: "Liczymy odsłony na własnym serwerze, bez plików cookie i bez udziału jakichkolwiek podmiotów trzecich. Przy każdej odsłonie zapisujemy stronę i język, domenę witryny, z której do nas trafiłeś, identyfikator przeglądarki i typ urządzenia, kraj ustalony na podstawie adresu IP, ewentualne parametry kampanii zawarte w linku (utm_source, utm_medium, utm_campaign), informację, czy odpowiedziałeś już na baner cookie, oraz kod obliczony z Twojego adresu IP, identyfikatora przeglądarki, daty i tajnego klucza znanego wyłącznie naszemu serwerowi; kod ten zmienia się codziennie, bez tego klucza nie da się go powiązać z Tobą, a sam adres IP nie jest przechowywany. Na stronach projektów odnotowujemy też, jak daleko przewijasz stronę i z których przycisków korzystasz. Statystyki te wykorzystujemy wyłącznie w formie zagregowanej, aby sprawdzić, które treści są przydatne, i nigdy w celu ustalenia Twojej tożsamości. Podstawa prawna: art. 6 ust. 1 lit. f RODO (nasz prawnie uzasadniony interes w zrozumieniu, w jaki sposób korzysta się z witryny)." },
          { term: "Atrybucja kampanii", text: "Jeśli trafiasz do nas przez reklamę, link kampanii lub link polecający partnera, Twoja przeglądarka zapisuje źródło wizyty (parametry kampanii, identyfikatory kliknięć reklam, takie jak gclid lub fbclid, adres odsyłający oraz kod partnera) w pamięci bieżącej karty przeglądarki, która jest czyszczona po zamknięciu karty. Jeśli w trakcie tej wizyty wyślesz zapytanie, źródło zostaje zapisane razem z nim, abyśmy wiedzieli, która kampania lub który partner skierował Cię do nas. Tylko jeśli zaakceptujesz pliki cookie, przechowujemy je również w pliku cookie („cve_attr”) przez 90 dni, aby zapytanie wysłane przez Ciebie później zostało prawidłowo przypisane. Podstawa prawna: art. 6 ust. 1 lit. f RODO (nasz prawnie uzasadniony interes w ustaleniu, od którego partnera lub z której kampanii pochodzi zapytanie) dla pamięci karty oraz art. 6 ust. 1 lit. a RODO (zgoda) dla pliku cookie." },
          { term: "Google Tag Manager, Google Analytics i Google Ads", text: "Tylko jeśli zaakceptujesz pliki cookie, ładujemy Google Tag Manager (Google Ireland Limited), który następnie uruchamia Google Analytics 4 do pomiaru zasięgu oraz Google Ads do pomiaru konwersji i remarketingu. Sam Tag Manager jedynie zarządza pozostałymi tagami; dane przetwarzają uruchamiane przez niego usługi. Podstawa prawna: art. 6 ust. 1 lit. a RODO (zgoda)." },
          { term: "Piksel Meta", text: "Wyłącznie za Twoją zgodą. Dostawca: Meta Platforms Ireland Limited. Mierzy, czy wizyta nastąpiła po jednej z naszych reklam, i pozwala docierać do podobnych odbiorców. Podstawa prawna: art. 6 ust. 1 lit. a RODO (zgoda)." },
          { term: "Meta Conversions API", text: "Tylko jeśli zaakceptowałeś pliki cookie, zgłaszamy również dwa zdarzenia bezpośrednio z naszego serwera do Meta Platforms Ireland Limited: wysłanie zapytania („Lead”) oraz nawiązanie kontaktu przez WhatsApp, telefonicznie lub e-mailem („Contact”). W przypadku zapytania przesyłamy Twój adres e-mail i numer telefonu w formie pseudonimizowanej (jako wartości skrótu SHA-256, nigdy otwartym tekstem); w przypadku obu zdarzeń przesyłamy Twój adres IP, identyfikator przeglądarki, adres strony oraz identyfikatory z plików cookie Meta (_fbp, _fbc). Identyfikator zdarzenia zapewnia, że Meta policzy dane zdarzenie tylko raz, nawet jeśli dotrze ono zarówno z Twojej przeglądarki, jak i z naszego serwera. Meta wykorzystuje te dane do pomiaru i ulepszania naszych reklam; w zakresie tego przetwarzania jesteśmy wraz z Meta współadministratorami (art. 26 RODO). Podstawa prawna: art. 6 ust. 1 lit. a RODO (zgoda)." },
          { term: "LinkedIn Insight Tag", text: "Wyłącznie za Twoją zgodą. Dostawca: LinkedIn Ireland Unlimited Company. Mierzy skuteczność naszych kampanii na LinkedIn i umożliwia tam kierowanie reklam. Podstawa prawna: art. 6 ust. 1 lit. a RODO (zgoda)." },
          { term: "Microsoft Clarity — w tym nagrywanie sesji", text: "Clarity (Microsoft Ireland Operations Limited) pokazuje nam, jak faktycznie korzysta się ze stron: ruch myszy, przewijanie, kliknięcia i interakcje, które można odtworzyć jako zanonimizowane nagranie sesji i zebrać w mapy cieplne. To znacznie więcej niż samo liczenie odsłon, dlatego wymieniamy tę usługę osobno. Skrypt Clarity ładuje się na każdej stronie, ale otrzymuje informację, czy wyraziłeś zgodę: bez zgody działa w ograniczonym trybie Microsoftu, który nie ustawia plików cookie ani nie buduje profilu; za zgodą rejestruje pełną sesję. Podstawa prawna: art. 6 ust. 1 lit. a RODO (zgoda) dla trybu pełnego oraz art. 6 ust. 1 lit. f RODO (nasz uzasadniony interes w rozpoznaniu, gdzie witryna dezorientuje użytkowników) dla trybu ograniczonego. Wobec tego drugiego możesz w każdej chwili wnieść sprzeciw na podstawie art. 21." },
          { term: "Mapy i inne treści osadzone", text: "Aby wyświetlać mapy, niektóre strony pobierają kafelki map bezpośrednio z OpenFreeMap i OpenStreetMap Foundation, a starsze widoki map pobierają obrazy znaczników z sieci dostarczania treści Cloudflare. Pole numeru telefonu pobiera niewielkie obrazki flag państw z GitHub Pages, a niektóre strony osadzają filmy z YouTube (Google). Gdy Twoja przeglądarka pobiera takie treści, dostawca otrzymuje Twój adres IP i informacje o przeglądarce, jak przy każdym żądaniu w internecie. Podstawa prawna: art. 6 ust. 1 lit. f RODO (nasz prawnie uzasadniony interes w przedstawianiu lokalizacji i filmów w użyteczny sposób)." },
        ]},
      ],
    },
    {
      id: "recipients",
      title: "3. Kto otrzymuje Twoje dane",
      blocks: [
        { kind: "callout", text: "Przekazanie Twoich danych deweloperowi lub prawnikowi jest istotną częścią naszej usługi. Następuje wyłącznie w związku z konkretnym zainteresowaniem nieruchomością, które nam zgłosiłeś." },
        { kind: "p", text: "W zależności od zapytania Twoje dane mogą otrzymać:" },
        { kind: "list", items: [
          "Deweloperzy na Cyprze — w celu zarejestrowania Cię jako naszego klienta oraz zorganizowania oglądania i przygotowania ofert dla interesujących Cię nieruchomości. Przy rejestracji przekazujemy Twoje imię i nazwisko, informację o interesującej Cię nieruchomości i budżecie oraz częściowo zamaskowany numer telefonu; jeśli zdecydujesz się na oglądanie lub ofertę, deweloper otrzymuje dane kontaktowe niezbędne do ich realizacji. Podstawa prawna: art. 6 ust. 1 lit. b RODO.",
          "Niezależni prawnicy — do weryfikacji prawnej i sporządzenia umów, jeśli poprosisz o taki kontakt. Działają jako odrębni administratorzy i są związani własną tajemnicą zawodową.",
          "Partner, który Cię polecił, jeśli taki jest — widzi etap swojego polecenia oraz przygotowane przez nas prezentacje (zob. punkt 2).",
          "Komunikatory naszego zespołu — o każdym nowym zapytaniu nasz zespół jest powiadamiany w Telegramie (Telegram FZ-LLC, Zjednoczone Emiraty Arabskie) i WhatsAppie (WhatsApp Ireland Limited). Powiadomienia te nie zawierają Twojego imienia i nazwiska, danych kontaktowych ani treści wiadomości — tylko rodzaj zapytania, wybrane przez Ciebie opcje (np. przedział budżetu lub preferowany sposób kontaktu), wewnętrzny numer referencyjny i link do naszej bazy klientów, która wymaga zalogowania. Jeśli wybierzesz WhatsApp, korespondujemy z Tobą również tym kanałem.",
          "Nasi dostawcy usług IT, działający jako podmioty przetwarzające na podstawie art. 28 RODO i wyłącznie zgodnie z naszymi udokumentowanymi poleceniami: Hostinger International Ltd. (hosting serwera i poczta e-mail), Anthropic (asystent AI, z którego nasz zespół korzysta do streszczania zapytań, przygotowywania projektów odpowiedzi i porządkowania odpowiedzi deweloperów — ma wgląd w treść zapytania i jego historię) oraz dostawca wideorozmów w przypadku spotkań, na które się zgodzisz.",
          "Meta, Google, LinkedIn i Microsoft — w zakresie opisanym w punkcie 2, a tam, gdzie punkt 2 tak stanowi, wyłącznie za Twoją zgodą.",
        ]},
        { kind: "p", text: "Nie sprzedajemy Twoich danych osobowych i nie przekazujemy ich do celów reklamowych osób trzecich." },
      ],
    },
    {
      id: "transfers",
      title: "4. Przekazywanie poza EOG",
      blocks: [
        { kind: "p", text: "Google, Meta, Microsoft i LinkedIn działają poprzez swoje irlandzkie spółki, jednak przetwarzanie na ich infrastrukturze może obejmować przekazanie danych do Stanów Zjednoczonych; to samo dotyczy korzystania przez nas z usług Anthropic, Zoom, Cloudflare i GitHub. Przekazanie to opiera się na decyzji Komisji Europejskiej stwierdzającej odpowiedni stopień ochrony w ramach EU–US Data Privacy Framework, o ile odbiorca posiada certyfikat, a w pozostałych przypadkach na standardowych klauzulach umownych zgodnie z art. 46 ust. 2 lit. c RODO." },
        { kind: "p", text: "Powiadomienia zespołu w Telegramie, którego operator ma siedzibę w Zjednoczonych Emiratach Arabskich — państwie, wobec którego nie wydano decyzji UE stwierdzającej odpowiedni stopień ochrony — nie zawierają Twojego imienia i nazwiska, danych kontaktowych ani treści wiadomości (zob. punkt 3). Łączy je z Tobą jedynie wewnętrzny numer referencyjny, który potrafimy przypisać tylko my. Podobnie powiadomienia, które wysyłamy w Telegramie partnerowi, który Cię polecił, zawierają jedynie numer referencyjny i etap polecenia." },
        { kind: "p", text: "Kopię stosowanych zabezpieczeń możesz uzyskać, kontaktując się z nami w sposób wskazany w punkcie 1." },
      ],
    },
    {
      id: "retention",
      title: "5. Jak długo przechowujemy",
      blocks: [
        { kind: "p", text: "Dane osobowe przechowujemy tylko tak długo, jak wymaga tego cel ich zebrania, a dłużej wyłącznie wtedy, gdy istnieje ustawowy obowiązek przechowywania." },
        { kind: "list", items: [
          "Pliki dziennika serwera: 14 dni, następnie usuwane.",
          "Zapytania, korespondencja i wyświetlenia prezentacji: przez czas kontaktu w sprawie Twojego zapytania, a potem tylko dopóki może z niego jeszcze wyniknąć dalsza rozmowa. Gdy usuwamy zapytanie, zostaje ono trwale usunięte z naszego systemu po upływie 90 dni.",
          "Dane związane z zawartą transakcją: przez okres wymagany cypryjskim prawem handlowym i podatkowym.",
          "Zapisy na newsletter: do momentu wypisania się.",
          "Twój wybór dotyczący plików cookie: przechowywany w Twojej przeglądarce przez 180 dni, po czym ponownie o niego zapytamy. Plik cookie atrybucji kampanii (tylko za zgodą): 90 dni. Pamięć karty: do zamknięcia karty.",
          "Linki, które Ci wysyłamy: linki do pobrania naszych przewodników i osobiste linki do prezentacji wygasają po 30 dniach.",
          "Statystyka witryny: przechowywana wyłącznie w postaci pseudonimizowanych zapisów opisanych w punkcie 2 i usuwana, gdy nie jest już potrzebna do porównywania korzystania z witryny w czasie.",
        ]},
        { kind: "p", text: "Jeśli chcesz wiedzieć, jak długo przechowujemy określoną kategorię Twoich danych, zapytaj nas — poinformujemy Cię." },
      ],
    },
    {
      id: "cookies",
      title: "6. Pliki cookie i zgoda",
      blocks: [
        { kind: "p", text: "Nasz baner cookie daje Ci jeden wybór: zaakceptować wszystkie opcjonalne pliki cookie albo zezwolić tylko na niezbędne. Akceptacja obejmuje opisane poniżej kategorie „Analityczne” i „Marketingowe”; odmowa pozostawia wyłącznie to, co niezbędne." },
        { kind: "definitions", items: [
          { term: "Niezbędne", text: "Wymagane do działania witryny: plik cookie „cookieConsent”, który zapamiętuje Twój wybór przez 180 dni, oraz opisana w punkcie 2 pamięć karty na potrzeby atrybucji kampanii. Język jest częścią adresu strony, więc nie wymaga pliku cookie. Podstawa: art. 6 ust. 1 lit. f RODO." },
          { term: "Analityczne", text: "Google Analytics 4 (przez Google Tag Manager) oraz Microsoft Clarity w trybie pełnym, które ustawiają własne pliki cookie (na przykład _ga, _clck, _clsk). Ustawiane dopiero po Twojej zgodzie." },
          { term: "Marketingowe", text: "Google Ads, piksel Meta i Conversions API oraz LinkedIn Insight Tag, które ustawiają własne pliki cookie (na przykład _gcl_au, _fbp, _fbc oraz pliki cookie li_ serwisu LinkedIn), a także nasz plik cookie atrybucji kampanii „cve_attr” (90 dni). Ustawiane dopiero po Twojej zgodzie." },
        ]},
        { kind: "p", text: "Swoją decyzję możesz w każdej chwili zmienić lub wycofać za pomocą linku „Ustawienia cookies” na dole każdej strony; po wycofaniu zgody strona załaduje się ponownie bez narzędzi opcjonalnych. Wycofanie zgody nie wpływa na zgodność z prawem przetwarzania dokonanego wcześniej. Pliki cookie możesz też blokować lub usuwać w ustawieniach przeglądarki — części witryny mogą wtedy nie działać zgodnie z przeznaczeniem." },
      ],
    },
    {
      id: "rights",
      title: "7. Twoje prawa",
      blocks: [
        { kind: "p", text: "Na mocy RODO masz prawo do:" },
        { kind: "list", items: [
          "Dostępu — uzyskania potwierdzenia, czy przetwarzamy Twoje dane, oraz ich kopii (art. 15).",
          "Sprostowania — poprawienia danych nieprawidłowych lub niekompletnych (art. 16).",
          "Usunięcia — usunięcia danych, gdy zachodzi jedna z przesłanek art. 17.",
          "Ograniczenia — żądania, byśmy jedynie przechowywali dane na czas rozstrzygnięcia sporu (art. 18).",
          "Przenoszenia danych — otrzymania przekazanych nam danych w ustrukturyzowanym formacie nadającym się do odczytu maszynowego lub przesłania ich innemu administratorowi (art. 20).",
          "Sprzeciwu — w każdej chwili wobec przetwarzania opartego na prawnie uzasadnionym interesie, a bezwarunkowo wobec marketingu bezpośredniego (art. 21).",
          "Wycofania zgody — w każdej chwili ze skutkiem na przyszłość (art. 7 ust. 3).",
        ]},
        { kind: "p", text: "Aby skorzystać z tych praw, napisz na office@cyprusvipestates.com. Odpowiadamy w ciągu miesiąca; przy złożonych żądaniach możemy przedłużyć ten termin o dwa miesiące, informując o przyczynach." },
        { kind: "callout", text: "Masz również prawo wniesienia skargi do organu nadzorczego. Na Cyprze jest to Office of the Commissioner for Personal Data Protection, Iasonos 1, 1082 Nikozja (commissioner@dataprotection.gov.cy). Skargę możesz też złożyć do organu w kraju swojego zamieszkania lub pracy — w Polsce jest to Prezes Urzędu Ochrony Danych Osobowych." },
      ],
    },
    {
      id: "security",
      title: "8. Bezpieczeństwo",
      blocks: [
        { kind: "p", text: "Witryna działa przez TLS, więc przesyłane do nas treści są szyfrowane w transmisji — przeglądarka pokazuje „https://” i symbol kłódki. Stosujemy środki techniczne i organizacyjne odpowiednie do ryzyka, a dostęp do danych z zapytań mają wyłącznie osoby, które Cię obsługują." },
      ],
    },
    {
      id: "automated-decisions",
      title: "9. Zautomatyzowane decyzje",
      blocks: [
        { kind: "p", text: "Nie stosujemy zautomatyzowanego podejmowania decyzji ani profilowania wywołującego skutki prawne lub w podobny sposób istotnie wpływającego na Ciebie w rozumieniu art. 22 RODO. Nasze oprogramowanie proponuje nieruchomości odpowiadające podanym przez Ciebie preferencjom, a nasz zespół korzysta z asystenta AI do streszczania zapytań i przygotowywania projektów odpowiedzi (zob. punkt 3); wynik zawsze sprawdza człowiek, który decyduje o dalszych krokach." },
      ],
    },
    {
      id: "changes",
      title: "10. Zmiany tej polityki",
      blocks: [
        { kind: "p", text: "Aktualizujemy tę politykę, gdy zmieniają się nasze usługi lub wymogi prawne. Obowiązuje zawsze wersja opublikowana tutaj, a data u góry wskazuje ostatnią zmianę." },
      ],
    },
  ],

  contactTitle: "Pytania o Twoje dane?",
  contactText: "Napisz na office@cyprusvipestates.com lub zadzwoń pod +357 99 278 285. Chętnie wyjaśnimy każdy punkt prostym językiem.",
};
